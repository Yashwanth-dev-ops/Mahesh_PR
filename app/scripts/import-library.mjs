// Load the class's real content from a folder. Safe to re-run: same file (by SHA-256) is never added twice.
//
//   node --env-file=.env.local scripts/import-library.mjs <folder> [--dry-run] [--remove-samples]
//
// Folder layout (see scripts/data/library-example):
//   subjects.csv                      code,name,year,semester,regulation
//   <CODE>/NN Chapter title/          chapter folders, numbered
//          notes.md                   optional: "## Heading" then text → readable sections (replaces old ones)
//          questions.md               optional: "Q: …" / "A: …" pairs → important questions (replaces old ones)
//          *.pdf *.pptx *.docx …      files → approved materials
//   <CODE>/papers/YYYY-MM <previous|regular> <regular|supplementary|mid1|mid2>.pdf   → past papers
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, existsSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";

const [root, ...flags] = process.argv.slice(2);
if (root !== "--self-test" && (!root || !existsSync(root))) { console.error("Usage: import-library.mjs <folder> [--dry-run] [--remove-samples]"); process.exit(1); }
const DRY = flags.includes("--dry-run");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const report = { subjects: 0, chapters: 0, sections: 0, questions: 0, files: 0, papers: 0, skippedDuplicates: 0, pdfsShrunk: 0, mbSaved: 0, errors: [] };
const MIME = { ".pdf": "application/pdf", ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation", ".ppt": "application/vnd.ms-powerpoint", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };
const TYPE = { ".pdf": "pdf", ".pptx": "slides", ".ppt": "slides", ".docx": "notes", ".png": "notes", ".jpg": "notes", ".jpeg": "notes" };
const dirs = (p) => readdirSync(p).filter((n) => statSync(join(p, n)).isDirectory()).sort();
const files = (p) => readdirSync(p).filter((n) => statSync(join(p, n)).isFile()).sort();
const sha = (buf) => createHash("sha256").update(buf).digest("hex");
// Shrink a PDF with Ghostscript (150 dpi images: sharp on a phone; scans usually drop 50–80%).
// Keeps the original when Ghostscript is missing, fails, or saves less than 10%. The duplicate check always uses the
// ORIGINAL file's hash, so the same original can never be added twice, compressed or not.
let gsMissing = false;
function shrinkPdf(buf) {
  if (gsMissing) return buf;
  const dir = mkdtempSync(join(tmpdir(), "pdf-shrink-")), src = join(dir, "in.pdf"), out = join(dir, "out.pdf");
  try {
    writeFileSync(src, buf);
    execFileSync("gs", ["-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.5", "-dPDFSETTINGS=/ebook", "-dNOPAUSE", "-dQUIET", "-dBATCH", "-dSAFER", `-sOutputFile=${out}`, src], { stdio: "ignore", timeout: 120000 });
    const small = readFileSync(out);
    if (small.length > buf.length * 0.9) return buf;
    report.pdfsShrunk++; report.mbSaved = +(report.mbSaved + (buf.length - small.length) / 1048576).toFixed(2);
    return small;
  } catch (e) {
    if (e.code === "ENOENT") { gsMissing = true; console.warn("Ghostscript not found: PDFs are stored as they are. Install: sudo apt-get install -y ghostscript"); }
    return buf;
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
const pdfPages = (buf) => (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length || null; // shortcut: rough count, fine for display

// Pure parsers, exported for the self-check at the bottom.
export function parseCsv(text) {
  const [head, ...rows] = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  const keys = head.split(",").map((k) => k.trim().toLowerCase());
  return rows.map((r) => Object.fromEntries(r.split(",").map((v, i) => [keys[i], v.trim()])));
}
export function parseNotes(md) {
  const out = []; let cur = null;
  for (const line of md.split(/\r?\n/)) {
    const h = line.match(/^#{2,3}\s+(.+)/);
    if (h) { cur = { heading: h[1].trim(), body: [] }; out.push(cur); }
    else if (cur) cur.body.push(line);
  }
  return out.map((s) => ({ heading: s.heading, body: s.body.join("\n").trim() }));
}
export function parseQuestions(md) {
  const out = [];
  for (const block of md.split(/\n(?=Q:)/)) {
    const q = block.match(/Q:\s*([\s\S]*?)(?:\nA:|$)/), a = block.match(/\nA:\s*([\s\S]*)/);
    if (q && q[1].trim()) out.push({ question: q[1].trim(), answer: a ? a[1].trim() : "" });
  }
  return out;
}
export function parsePaperName(name) {
  const m = basename(name, extname(name)).match(/^(\d{4})-(\d{1,2})\s+(previous|regular)\s+(regular|supplementary|mid1|mid2)$/i);
  return m ? { exam_year: +m[1], exam_month: +m[2], kind: m[3].toLowerCase(), exam_type: m[4].toLowerCase() } : null;
}
const chapterFolder = (n) => { const m = n.match(/^(\d{1,2})[\s._-]+(.+)$/); return m ? { number: +m[1], title: m[2].trim() } : null; };

async function main() {
  const { data: admin } = await db.from("profiles").select("id").eq("role", "admin").limit(1).single();
  const csv = join(root, "subjects.csv");
  if (!existsSync(csv)) throw new Error("subjects.csv is missing in " + root);
  const subjects = parseCsv(readFileSync(csv, "utf8"));
  if (flags.includes("--remove-samples") && !DRY) {
    const { data: old } = await db.from("subjects").select("id, code").like("description", "Sample%");
    for (const s of old ?? []) if (!subjects.some((x) => x.code?.toUpperCase() === s.code)) { await db.from("subjects").delete().eq("id", s.id); console.log("removed sample", s.code); }
  }
  for (const row of subjects) {
    const code = row.code?.toUpperCase(), year = +row.year, semester = +row.semester;
    if (!/^[A-Z0-9-]{3,12}$/.test(code ?? "") || !row.name || !(year >= 1 && year <= 4) || !(semester >= 1 && semester <= 2)) { report.errors.push(`subjects.csv: bad row ${JSON.stringify(row)}`); continue; }
    const dir = join(root, code);
    let subjectId = "dry";
    if (!DRY) {
      const { data, error } = await db.from("subjects").upsert({ code, name: row.name, year, semester, regulation: row.regulation || "R23", description: null, is_active: true }, { onConflict: "code" }).select("id").single();
      if (error) { report.errors.push(`${code}: ${error.message}`); continue; }
      subjectId = data.id;
    }
    report.subjects++;
    if (!existsSync(dir)) { console.log(`${code}: no folder, subject only`); continue; }

    for (const name of dirs(dir).filter((n) => n.toLowerCase() !== "papers")) {
      const ch = chapterFolder(name);
      if (!ch) { report.errors.push(`${code}/${name}: folder should start with a number, e.g. "01 Introduction"`); continue; }
      const cdir = join(dir, name);
      let chapterId = "dry";
      if (!DRY) {
        const { data, error } = await db.from("chapters").upsert({ subject_id: subjectId, number: ch.number, title: ch.title }, { onConflict: "subject_id,number" }).select("id").single();
        if (error) { report.errors.push(`${code}/${name}: ${error.message}`); continue; }
        chapterId = data.id;
      }
      report.chapters++;
      const list = files(cdir);
      if (list.includes("notes.md")) {
        const secs = parseNotes(readFileSync(join(cdir, "notes.md"), "utf8"));
        if (!DRY) {
          await db.from("chapter_sections").delete().eq("chapter_id", chapterId);
          if (secs.length) { const { error } = await db.from("chapter_sections").insert(secs.map((s, i) => ({ chapter_id: chapterId, position: i + 1, heading: s.heading.slice(0, 160), body: s.body.slice(0, 20000) }))); if (error) report.errors.push(`${code}/${name}/notes.md: ${error.message}`); }
        }
        report.sections += secs.length;
      }
      if (list.includes("questions.md")) {
        const qs = parseQuestions(readFileSync(join(cdir, "questions.md"), "utf8"));
        if (!DRY) {
          await db.from("important_questions").delete().eq("chapter_id", chapterId);
          if (qs.length) { const { error } = await db.from("important_questions").insert(qs.map((q, i) => ({ subject_id: subjectId, chapter_id: chapterId, position: i + 1, question: q.question.slice(0, 500), answer: q.answer.slice(0, 5000) }))); if (error) report.errors.push(`${code}/${name}/questions.md: ${error.message}`); }
        }
        report.questions += qs.length;
      }
      for (const f of list.filter((f) => MIME[extname(f).toLowerCase()])) {
        const orig = readFileSync(join(cdir, f)), hash = sha(orig), ext = extname(f).toLowerCase();
        const { data: dup } = await db.from("materials").select("id").eq("file_hash", hash).neq("status", "rejected").maybeSingle();
        if (dup) { report.skippedDuplicates++; continue; }
        const buf = ext === ".pdf" && !DRY ? shrinkPdf(orig) : orig;
        if (buf.length > 26214400) { report.errors.push(`${code}/${name}/${f}: over 25 MB even after shrinking`); continue; }
        if (!DRY) {
          const path = `${subjectId}/${chapterId}/${hash}${ext}`;
          const up = await db.storage.from("materials").upload(path, buf, { contentType: MIME[ext], upsert: true });
          if (up.error) { report.errors.push(`${code}/${name}/${f}: ${up.error.message}`); continue; }
          const { error } = await db.from("materials").insert({
            chapter_id: chapterId, uploader_id: admin.id, title: basename(f, ext).replace(/[-_]+/g, " ").slice(0, 160), type: TYPE[ext], file_path: path, file_hash: hash,
            mime: MIME[ext], size_bytes: buf.length, page_count: ext === ".pdf" ? pdfPages(buf) : null, status: "approved", reviewed_by: admin.id, reviewed_at: new Date().toISOString(),
          });
          if (error) { report.errors.push(`${code}/${name}/${f}: ${error.message}`); continue; }
        }
        report.files++;
      }
    }

    const pdir = join(dir, "papers");
    if (existsSync(pdir)) for (const f of files(pdir).filter((f) => extname(f).toLowerCase() === ".pdf")) {
      const meta = parsePaperName(f);
      if (!meta) { report.errors.push(`${code}/papers/${f}: name it like "2024-11 regular mid2.pdf"`); continue; }
      const orig = readFileSync(join(pdir, f)), hash = sha(orig);
      const { data: dup } = await db.from("question_papers").select("id").eq("file_hash", hash).neq("status", "rejected").maybeSingle();
      if (dup) { report.skippedDuplicates++; continue; }
      if (!DRY) {
        const buf = shrinkPdf(orig);
        const path = `${subjectId}/${hash}.pdf`;
        const up = await db.storage.from("papers").upload(path, buf, { contentType: "application/pdf", upsert: true });
        if (up.error) { report.errors.push(`${code}/papers/${f}: ${up.error.message}`); continue; }
        const { error } = await db.from("question_papers").insert({ subject_id: subjectId, ...meta, regulation: row.regulation || "R23", file_path: path, file_hash: hash, size_bytes: buf.length, page_count: pdfPages(buf), uploader_id: admin.id, status: "approved", reviewed_by: admin.id, reviewed_at: new Date().toISOString() });
        if (error) { report.errors.push(`${code}/papers/${f}: ${/duplicate|unique/i.test(error.message) ? "a paper for this exam and month already exists" : error.message}`); continue; }
      }
      report.papers++;
    }
  }
  console.log(DRY ? "DRY RUN (nothing written):" : "Imported:", report);
  if (report.errors.length) process.exitCode = 2;
}

// Self-check of the parsers (node scripts/import-library.mjs --self-test)
if (root === "--self-test") {
  const assert = (c, m) => { if (!c) throw new Error("self-test failed: " + m); };
  assert(parseCsv("code,name,year\nAI1,ML,3").at(0).name === "ML", "csv");
  const n = parseNotes("## A\nline1\nline2\n## B\nx"); assert(n.length === 2 && n[0].body === "line1\nline2", "notes");
  const q = parseQuestions("Q: What?\nA: That.\nQ: Two?\nA: Yes"); assert(q.length === 2 && q[1].answer === "Yes", "questions");
  assert(parsePaperName("2024-11 regular mid2.pdf").exam_type === "mid2", "paper"); assert(parsePaperName("notes.pdf") === null, "paper-bad");
  // A PDF path given after --self-test is shrunk to show the saving (the file itself is not changed).
  if (flags[0]) { const a = readFileSync(flags[0]), b = shrinkPdf(a); console.log(`shrink: ${(a.length / 1048576).toFixed(2)} MB → ${(b.length / 1048576).toFixed(2)} MB${b === a ? " (kept original)" : ""}`); }
  console.log("self-test ok");
} else await main();
