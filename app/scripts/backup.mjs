// Back up everything the library needs to come back: every stored file + the database (with student accounts).
//
//   node --env-file=.env.local scripts/backup.mjs [--out backups] [--files-only]
//
// Writes backups/backup-YYYY-MM-DD.7z, encrypted (AES-256, file names hidden too) with BACKUP_PASSWORD.
// It opens anywhere with that one password: Windows with 7-Zip or NanaZip, WSL/Linux with `7z x`.
// Check or restore it with scripts/restore.mjs. Run weekly during the pilot.
//
// Inside the archive:
//   manifest.json                      buckets, every file's size + SHA-256, the database files' SHA-256
//   files/<bucket>/<path>              every object in the materials, papers and avatars buckets
//   db/schema.sql                      public schema: tables, functions, row-level security policies
//   db/auth.sql                        accounts (auth.users + auth.identities, passwords stay hashed)
//   db/data.sql                        all rows of the public tables
//
// Needs pg_dump 17+ (sudo apt-get install -y postgresql-client) and 7-Zip (sudo apt-get install -y 7zip).
// The database address comes from supabase/.temp/pooler-url (written by `supabase link`) or DATABASE_URL,
// the password from SUPABASE_DB_PASSWORD. --files-only skips the database (for when pg_dump isn't installed).
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const OUT = resolve(args.includes("--out") ? args[args.indexOf("--out") + 1] : "backups");
const FILES_ONLY = args.includes("--files-only");
const BUCKETS = ["materials", "papers", "avatars"];
const sha = (buf) => createHash("sha256").update(buf).digest("hex");
const has = (cmd) => { try { execFileSync("sh", ["-c", `command -v ${cmd}`], { stdio: "ignore" }); return true; } catch { return false; } };
export const sevenZip = () => ["7z", "7zz", "7za"].find(has);

export function dbConnection(env = process.env, poolerFile = "supabase/.temp/pooler-url") {
  const raw = env.DATABASE_URL || (existsSync(poolerFile) && readFileSync(poolerFile, "utf8").trim());
  if (!raw) throw new Error("No database address: set DATABASE_URL or run `npx supabase link` once.");
  const u = new URL(raw);
  const password = decodeURIComponent(u.password) || env.SUPABASE_DB_PASSWORD;
  if (!password) throw new Error("No database password: set SUPABASE_DB_PASSWORD in .env.local.");
  // Password goes through PGPASSWORD, never on the command line (other users could read it from `ps`).
  return { args: ["--host", u.hostname, "--port", u.port || "5432", "--username", decodeURIComponent(u.username), "--dbname", u.pathname.slice(1) || "postgres"], env: { ...process.env, PGPASSWORD: password } };
}

// Walks a bucket folder by folder (the storage API lists one level at a time, 1000 per page).
async function listAll(store, prefix = "") {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await store.list(prefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`list ${prefix || "/"}: ${error.message}`);
    for (const e of data) {
      const path = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.id === null) out.push(...(await listAll(store, path))); // a folder
      else out.push({ path, contentType: e.metadata?.mimetype ?? "application/octet-stream" });
    }
    if (data.length < 1000) return out;
  }
}

async function main() {
  const zip = sevenZip();
  if (!zip) throw new Error("7-Zip isn't installed. Run: sudo apt-get install -y 7zip");
  const pw = process.env.BACKUP_PASSWORD;
  if (!pw || pw.length < 16) throw new Error("Set BACKUP_PASSWORD (16+ characters) in .env.local, and keep it in your password manager.");
  if (!FILES_ONLY && !has("pg_dump")) throw new Error("pg_dump isn't installed. Run: sudo apt-get install -y postgresql-client  (or add --files-only)");
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const day = new Date().toISOString().slice(0, 10);
  const work = mkdtempSync(join(tmpdir(), "library-backup-"));
  const manifest = { app: "StudyDashBoard library", createdAt: new Date().toISOString(), source: process.env.NEXT_PUBLIC_SUPABASE_URL, buckets: [], files: [], db: [], filesOnly: FILES_ONLY };

  try {
    const { data: buckets, error } = await db.storage.listBuckets();
    if (error) throw new Error(`buckets: ${error.message}`);
    for (const name of BUCKETS) {
      const b = buckets.find((x) => x.name === name);
      if (!b) { console.warn(`bucket ${name} not found, skipped`); continue; }
      manifest.buckets.push({ name, public: b.public, fileSizeLimit: b.file_size_limit ?? null, allowedMimeTypes: b.allowed_mime_types ?? null });
      const store = db.storage.from(name);
      const list = await listAll(store);
      for (const f of list) {
        const { data: blob, error: e } = await store.download(f.path);
        if (e) throw new Error(`download ${name}/${f.path}: ${e.message}`);
        const buf = Buffer.from(await blob.arrayBuffer());
        const dest = join(work, "files", name, f.path);
        mkdirSync(dirname(dest), { recursive: true });
        writeFileSync(dest, buf);
        manifest.files.push({ bucket: name, path: f.path, size: buf.length, sha256: sha(buf), contentType: f.contentType });
      }
      console.log(`${name}: ${list.length} files`);
    }

    if (!FILES_ONLY) {
      const conn = dbConnection();
      mkdirSync(join(work, "db"));
      const dump = (file, extra) => {
        execFileSync("pg_dump", [...conn.args, "--no-owner", "--no-privileges", "--file", join(work, "db", file), ...extra], { env: conn.env, stdio: ["ignore", "ignore", "inherit"] });
        const buf = readFileSync(join(work, "db", file));
        manifest.db.push({ file, size: buf.length, sha256: sha(buf) });
      };
      dump("schema.sql", ["--schema-only", "--schema=public"]);
      dump("auth.sql", ["--data-only", "--table=auth.users", "--table=auth.identities"]);
      dump("data.sql", ["--data-only", "--schema=public"]);
      console.log("database: schema, accounts and data dumped");
    }

    writeFileSync(join(work, "manifest.json"), JSON.stringify(manifest, null, 2));
    mkdirSync(OUT, { recursive: true });
    let out = join(OUT, `backup-${day}.7z`);
    for (let n = 2; existsSync(out); n++) out = join(OUT, `backup-${day}-${n}.7z`); // never overwrite an older backup
    // shortcut: 7-Zip takes the password as an argument, briefly visible to other users of this machine (`ps`);
    // fine on a single-user laptop or the backup container, revisit if the machine is shared.
    execFileSync(zip, ["a", "-t7z", "-mx=7", "-mhe=on", `-p${pw}`, out, "."], { cwd: work, stdio: "ignore" });
    const raw = manifest.files.reduce((s, f) => s + f.size, 0) + manifest.db.reduce((s, f) => s + f.size, 0);
    const mb = (n) => (n / 1048576).toFixed(1) + " MB";
    console.log(`\nSaved ${out}\n  ${manifest.files.length} files + ${manifest.db.length} database files, ${mb(raw)} packed into ${mb(statSync(out).size)}`);
    console.log("  Opens on Windows (7-Zip / NanaZip) and WSL (7z x) with BACKUP_PASSWORD. Check it any time with: npm run restore -- " + out);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (args.includes("--self-test")) {
  const c = dbConnection({ DATABASE_URL: "postgresql://postgres.abc:s%40cret@aws-1.pooler.supabase.com:5432/postgres" }, "/nonexistent");
  console.assert(c.env.PGPASSWORD === "s@cret" && c.args.includes("postgres.abc") && !c.args.join(" ").includes("cret"), "dbConnection");
  const d = dbConnection({ DATABASE_URL: "postgresql://postgres.abc@h:6543/postgres", SUPABASE_DB_PASSWORD: "pw" }, "/nonexistent");
  console.assert(d.env.PGPASSWORD === "pw" && d.args.includes("6543"), "password from env");
  console.log("self-test ok");
} else if (import.meta.url === pathToFileURL(process.argv[1]).href) { // not when restore.mjs imports dbConnection
  main().catch((e) => { console.error("Backup failed:", e.message); process.exit(1); });
}
