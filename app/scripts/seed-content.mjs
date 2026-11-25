// Starter content for the class pilot, from the brother's "AI & ML Study Hub" prototype
// (scripts/data/prototype-content.json): 5 subjects, their chapters, sections and important questions,
// plus one small sample PDF per chapter so the reader has something real to open.
// Run: node --env-file=.env.local scripts/seed-content.mjs   (replaces all subjects marked as samples)
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { notes, questions } = JSON.parse(readFileSync(new URL("./data/prototype-content.json", import.meta.url)));
const SAMPLE = "Sample content for the class pilot. Replace with the real syllabus.";

// shortcut: codes and year/semester are placeholders (prototype has none); the admin editor (phase 5) fixes them.
const META = {
  "Python Programming": ["AI3101", 3, 1],
  "Mathematics for ML": ["AI3102", 3, 1],
  "Machine Learning": ["AI3103", 3, 1],
  "Deep Learning": ["AI3104", 3, 1],
  "Natural Language Processing (NLP)": ["AI3105", 3, 1],
};

function pdf(title, pages) {
  const objs = ["<< /Type /Catalog /Pages 2 0 R >>", `<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + i * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`];
  const font = 3 + pages.length * 2;
  const esc = (s) => s.replace(/[^\x20-\x7e]/g, "-").replace(/[\\()]/g, (c) => "\\" + c);
  pages.forEach((lines, i) => {
    const body = lines.slice(0, 30).map((l, j) => `${j ? "0 -20 Td " : ""}(${esc(l)}) Tj`).join(" ");
    const stream = `BT /F1 22 Tf 56 780 Td (${esc(title)}) Tj /F1 12 Tf 0 -36 Td ${body} ET`;
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${4 + i * 2} 0 R >>`);
    objs.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  let out = "%PDF-1.4\n"; const offs = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  return Buffer.from(out + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`, "latin1");
}
const wrap = (t, n = 80) => t.match(new RegExp(`.{1,${n}}(\\s|$)`, "g"))?.map((s) => s.trim()) ?? [t];

// 1. Remove earlier sample subjects and their stored files (cascade removes chapters/materials/sections).
const { data: old } = await db.from("subjects").select("id").like("description", "Sample%");
for (const s of old ?? []) {
  const { data: files } = await db.from("materials").select("file_path").in("chapter_id",
    ((await db.from("chapters").select("id").eq("subject_id", s.id)).data ?? []).map((c) => c.id));
  const paths = (files ?? []).map((f) => f.file_path).filter(Boolean);
  if (paths.length) await db.storage.from("materials").remove(paths);
  await db.from("subjects").delete().eq("id", s.id);
}

// 2. Insert the prototype's content.
const { data: admin } = await db.from("profiles").select("id").eq("role", "admin").limit(1).single();
let counts = { subjects: 0, chapters: 0, sections: 0, questions: 0, pdfs: 0 };
for (const [name, chapters] of Object.entries(notes)) {
  const [code, year, semester] = META[name];
  const { data: s, error } = await db.from("subjects").insert({ code, name, year, semester, description: SAMPLE }).select("id").single();
  if (error) throw error;
  counts.subjects++;
  const chapterIds = [];
  for (const [i, ch] of chapters.entries()) {
    const title = ch.title.replace(/^Chapter\s*\d+\s*:\s*/i, "");
    const { data: c, error: ce } = await db.from("chapters").insert({ subject_id: s.id, number: i + 1, title }).select("id").single();
    if (ce) throw ce;
    chapterIds.push(c.id); counts.chapters++;
    const { error: se } = await db.from("chapter_sections").insert(ch.sections.map((x, k) => ({ chapter_id: c.id, position: k + 1, heading: x.heading, body: x.text ?? "" })));
    if (se) throw se;
    counts.sections += ch.sections.length;

    const file = pdf(`${name} - Ch ${i + 1}: ${title}`, [ch.sections.flatMap((x) => [x.heading.toUpperCase(), ...wrap(x.text ?? ""), ""])]);
    const hash = createHash("sha256").update(file).digest("hex");
    const path = `${s.id}/${c.id}/${hash}.pdf`;
    const up = await db.storage.from("materials").upload(path, file, { contentType: "application/pdf", upsert: true });
    if (up.error) throw up.error;
    const { error: me } = await db.from("materials").insert({
      chapter_id: c.id, uploader_id: admin.id, title: `${title}: notes (PDF)`, type: "notes", file_path: path, file_hash: hash,
      mime: "application/pdf", size_bytes: file.length, page_count: 1, status: "approved", reviewed_by: admin.id, reviewed_at: new Date().toISOString(),
    });
    if (me) throw me;
    counts.pdfs++;
  }
  // Prototype format: [question, answer, chapterIndex]; an index outside the chapters = general question.
  const rows = (questions[name] ?? []).map(([q, a, idx], k) => ({
    subject_id: s.id, chapter_id: chapterIds[idx] ?? null, position: k + 1, question: q, answer: a ?? "",
  }));
  if (rows.length) { const { error: qe } = await db.from("important_questions").insert(rows); if (qe) throw qe; }
  counts.questions += rows.length;
}
console.log(counts);
