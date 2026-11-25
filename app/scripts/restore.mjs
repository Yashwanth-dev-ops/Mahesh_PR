// Check a backup, or put it back into an EMPTY Supabase project.
//
//   node --env-file=.env.local scripts/restore.mjs <backup.7z | .tar.zst>      check only: every file's SHA-256
//   node --env-file=.env.local scripts/restore.mjs <backup.tar.zst> --into     check, then restore into the project in
//       RESTORE_SUPABASE_URL + RESTORE_SERVICE_ROLE_KEY + RESTORE_DATABASE_URL (password inside it or RESTORE_DB_PASSWORD)
//
// --into refuses to touch the live project (NEXT_PUBLIC_SUPABASE_URL) and any project that already has accounts,
// so it can never overwrite real data. Order: schema → accounts → rows → buckets and files. Needs psql for --into.
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dbConnection, sevenZip } from "./backup.mjs";

const [archive, ...flags] = process.argv.slice(2);
const INTO = flags.includes("--into");
const sha = (buf) => createHash("sha256").update(buf).digest("hex");

/** Every file listed in the manifest must exist with the same SHA-256. Returns the problems (empty = archive OK). */
export function verify(dir, manifest) {
  const bad = [];
  for (const f of manifest.files) {
    const p = join(dir, "files", f.bucket, f.path);
    if (!existsSync(p)) bad.push(`missing ${f.bucket}/${f.path}`);
    else if (sha(readFileSync(p)) !== f.sha256) bad.push(`changed ${f.bucket}/${f.path}`);
  }
  for (const f of manifest.db) {
    const p = join(dir, "db", f.file);
    if (!existsSync(p) || sha(readFileSync(p)) !== f.sha256) bad.push(`database file ${f.file} missing or changed`);
  }
  return bad;
}

async function restore(dir, manifest) {
  const url = process.env.RESTORE_SUPABASE_URL, key = process.env.RESTORE_SERVICE_ROLE_KEY;
  if (!url || !key || !process.env.RESTORE_DATABASE_URL) throw new Error("Set RESTORE_SUPABASE_URL, RESTORE_SERVICE_ROLE_KEY and RESTORE_DATABASE_URL for the empty target project.");
  if (url.replace(/\/$/, "") === (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "")) throw new Error("That's the live project. Restore only into a new, empty project.");
  if (manifest.filesOnly) throw new Error("This backup has no database (it was made with --files-only).");
  const target = createClient(url, key, { auth: { persistSession: false } });
  const { data: users } = await target.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (users?.users?.length) throw new Error("The target project already has accounts. Restore only into an empty project.");

  const conn = dbConnection({ DATABASE_URL: process.env.RESTORE_DATABASE_URL, SUPABASE_DB_PASSWORD: process.env.RESTORE_DB_PASSWORD }, "/nonexistent");
  const files = ["schema.sql", "auth.sql", "data.sql"].flatMap((f) => ["--file", join(dir, "db", f)]);
  execFileSync("psql", [...conn.args, "--set", "ON_ERROR_STOP=1", "--single-transaction", "--quiet", ...files], { env: conn.env, stdio: ["ignore", "ignore", "inherit"] });
  console.log("database restored");

  for (const b of manifest.buckets) {
    const { error } = await target.storage.createBucket(b.name, { public: b.public, fileSizeLimit: b.fileSizeLimit ?? undefined, allowedMimeTypes: b.allowedMimeTypes ?? undefined });
    if (error && !/exists/i.test(error.message)) throw new Error(`bucket ${b.name}: ${error.message}`);
  }
  for (const f of manifest.files) {
    const { error } = await target.storage.from(f.bucket).upload(f.path, readFileSync(join(dir, "files", f.bucket, f.path)), { contentType: f.contentType, upsert: false });
    if (error) throw new Error(`upload ${f.bucket}/${f.path}: ${error.message}`);
  }
  console.log(`${manifest.files.length} files uploaded. Point .env.local at the new project to use it.`);
}

async function main() {
  if (!archive || !existsSync(archive)) throw new Error("Usage: restore.mjs <backup.tar.zst> [--into]");
  const dir = mkdtempSync(join(tmpdir(), "library-restore-"));
  try {
    if (archive.endsWith(".7z")) {
      const zip = sevenZip();
      if (!zip) throw new Error("7-Zip isn't installed. Run: sudo apt-get install -y 7zip");
      try { execFileSync(zip, ["x", "-y", `-p${process.env.BACKUP_PASSWORD ?? ""}`, `-o${dir}`, archive], { stdio: "ignore" }); }
      catch { throw new Error("Couldn't open it: wrong BACKUP_PASSWORD, or the file is damaged."); }
    } else execFileSync("tar", ["-I", "zstd", "-xf", archive, "-C", dir]); // older .tar.zst backups
    const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
    const bad = verify(dir, manifest);
    if (bad.length) throw new Error(`archive is damaged:\n  ${bad.slice(0, 20).join("\n  ")}`);
    const mb = (manifest.files.reduce((s, f) => s + f.size, 0) / 1048576).toFixed(1);
    console.log(`Archive OK: made ${manifest.createdAt}, ${manifest.files.length} files (${mb} MB), database: ${manifest.filesOnly ? "not included" : manifest.db.map((d) => d.file).join(", ")}`);
    if (INTO) await restore(dir, manifest);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((e) => { console.error("Restore failed:", e.message); process.exit(1); });
