import "server-only";
import { supabaseServer } from "@/lib/supabase/server";

// Reads for the student pages. Every query runs as the signed-in user, so RLS decides what they can see.

export type Me = { id: string; fullName: string; firstName: string; rollNo: string; year: number | null; section: string | null; role: "student" | "admin"; avatarUrl: string | null; phone: string | null };

export async function getMe(): Promise<Me | null> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await supabase.from("profiles").select("full_name, roll_no, year, section, role, status, avatar_path, phone").eq("id", user.id).maybeSingle();
  if (!p || p.status !== "active") return null;
  return {
    id: user.id, fullName: p.full_name, firstName: p.full_name.split(" ")[0], rollNo: p.roll_no, year: p.year, section: p.section, role: p.role, phone: p.phone,
    avatarUrl: p.avatar_path ? supabase.storage.from("avatars").getPublicUrl(p.avatar_path).data.publicUrl : null,
  };
}

export type SubjectCard = { id: string; code: string; name: string; year: number; semester: number; chapters: number; materials: number; done: number; percent: number };

/** Active subjects with chapter/material counts and this student's progress. `year` limits to one year. */
export async function getSubjects(year?: number | null): Promise<SubjectCard[]> {
  const supabase = await supabaseServer();
  let q = supabase.from("subjects").select("id, code, name, year, semester").eq("is_active", true).order("year").order("semester").order("code");
  if (year) q = q.eq("year", year);
  const [subs, stats, mine] = await Promise.all([q, supabase.from("subject_stats").select("*"), supabase.from("my_subject_progress").select("*")]);
  const st = new Map((stats.data ?? []).map((r) => [r.subject_id, r]));
  const pr = new Map((mine.data ?? []).map((r) => [r.subject_id, r.done_chapters as number]));
  return (subs.data ?? []).map((s) => {
    const chapters = st.get(s.id)?.chapter_count ?? 0, done = Math.min(pr.get(s.id) ?? 0, chapters);
    return { ...s, chapters, materials: st.get(s.id)?.material_count ?? 0, done, percent: chapters ? Math.round((done / chapters) * 100) : 0 };
  });
}

export type ContinueItem = { code: string; subject: string; number: number; title: string; materialId: string | null; page: number | null };

/** The chapter the student touched last (for "Continue learning"). */
export async function getContinue(): Promise<ContinueItem | null> {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("chapter_progress")
    .select("last_material_id, last_page, chapters(number, title, subjects(code, name))")
    .order("updated_at", { ascending: false }).limit(1).maybeSingle();
  const ch = data?.chapters as unknown as { number: number; title: string; subjects: { code: string; name: string } } | null;
  if (!ch) return null;
  return { code: ch.subjects.code, subject: ch.subjects.name, number: ch.number, title: ch.title, materialId: data!.last_material_id, page: data!.last_page };
}

export async function getSubject(code: string) {
  const supabase = await supabaseServer();
  const { data: s } = await supabase.from("subjects").select("id, code, name, year, semester, regulation, description").eq("code", code.toUpperCase()).maybeSingle();
  if (!s) return null;
  const { data: chapters } = await supabase.from("chapters").select("id, number, title, materials(count), chapter_progress(done)")
    .eq("subject_id", s.id).eq("materials.status", "approved").order("number");
  const list = (chapters ?? []).map((c) => ({
    id: c.id, number: c.number, title: c.title,
    materials: (c.materials as unknown as { count: number }[])[0]?.count ?? 0,
    done: (c.chapter_progress as unknown as { done: boolean }[]).some((p) => p.done),
  }));
  return { ...s, chapters: list, done: list.filter((c) => c.done).length };
}

export async function getChapter(code: string, number: number) {
  const supabase = await supabaseServer();
  const subject = await getSubject(code);
  if (!subject) return null;
  const ch = subject.chapters.find((c) => c.number === number);
  if (!ch) return null;
  const [sections, materials, questions, known] = await Promise.all([
    supabase.from("chapter_sections").select("id, position, heading, body").eq("chapter_id", ch.id).order("position"),
    supabase.from("materials").select("id, title, type, mime, size_bytes, page_count, url, download_count").eq("chapter_id", ch.id).eq("status", "approved").order("created_at"),
    supabase.from("important_questions").select("id, question, answer").eq("chapter_id", ch.id).order("position"),
    supabase.from("known_questions").select("question_id"),
  ]);
  const i = subject.chapters.indexOf(ch);
  return {
    subject: { id: subject.id, code: subject.code, name: subject.name },
    chapter: ch,
    sections: sections.data ?? [],
    materials: materials.data ?? [],
    questions: questions.data ?? [],
    known: (known.data ?? []).map((k) => k.question_id as string),
    prev: subject.chapters[i - 1] ?? null,
    next: subject.chapters[i + 1] ?? null,
    total: subject.chapters.length,
  };
}

export async function getNotes() {
  const supabase = await supabaseServer();
  const [subjects, notes] = await Promise.all([
    supabase.from("subjects").select("id, code, name").eq("is_active", true).order("code"),
    supabase.from("subject_notes").select("subject_id, body, updated_at"),
  ]);
  const byId = new Map((notes.data ?? []).map((n) => [n.subject_id, n]));
  return (subjects.data ?? []).map((s) => ({ ...s, body: byId.get(s.id)?.body ?? "", updatedAt: byId.get(s.id)?.updated_at ?? null }));
}

/** Search subjects, chapters and sections. Short queries return nothing. */
export async function search(raw: string) {
  // Characters that would break the PostgREST or() filter syntax are dropped.
  const q = raw.replace(/[,()"'\\]/g, " ").trim().slice(0, 60);
  if (q.length < 2) return { subjects: [], chapters: [], sections: [] };
  const like = `%${q.replace(/[%_]/g, (c) => "\\" + c)}%`;
  const supabase = await supabaseServer();
  const [subjects, chapters, sections] = await Promise.all([
    supabase.from("subjects").select("code, name").eq("is_active", true).or(`name.ilike.${like},code.ilike.${like}`).limit(10),
    supabase.from("chapters").select("number, title, subjects(code, name)").ilike("title", like).limit(20),
    supabase.from("chapter_sections").select("heading, body, chapters(number, title, subjects(code, name))").or(`heading.ilike.${like},body.ilike.${like}`).limit(30),
  ]);
  type Ch = { number: number; title: string; subjects: { code: string; name: string } };
  return {
    subjects: subjects.data ?? [],
    chapters: (chapters.data ?? []).map((c) => ({ number: c.number, title: c.title, ...(c.subjects as unknown as Ch["subjects"]) })),
    sections: (sections.data ?? []).map((s) => {
      const ch = s.chapters as unknown as Ch;
      return { heading: s.heading, body: s.body, number: ch.number, chapterTitle: ch.title, code: ch.subjects.code, subject: ch.subjects.name };
    }),
  };
}

/** One material for the reader: where it belongs, a 10-minute file link, and the page to resume at. */
export async function getReadable(materialId: string) {
  const supabase = await supabaseServer();
  const { data: m } = await supabase.from("materials")
    .select("id, title, type, chapter_id, file_path, chapters(number, title, subjects(code, name))").eq("id", materialId).maybeSingle();
  if (!m || m.type === "link" || !m.file_path) return null;
  const ch = m.chapters as unknown as { number: number; title: string; subjects: { code: string; name: string } };
  const [{ data: link }, { data: prog }] = await Promise.all([
    (await import("@/lib/supabase/admin")).supabaseAdmin().storage.from("materials").createSignedUrl(m.file_path, 600),
    supabase.from("chapter_progress").select("last_material_id, last_page").eq("chapter_id", m.chapter_id).maybeSingle(),
  ]);
  return {
    id: m.id, title: m.title, chapterId: m.chapter_id, url: link?.signedUrl ?? null,
    page: prog && prog.last_material_id === m.id ? prog.last_page ?? 1 : 1,
    back: `/subjects/${ch.subjects.code}/${ch.number}`, where: `${ch.subjects.name} · Ch ${ch.number} ${ch.title}`,
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const EXAM = { regular: "Semester exam", supplementary: "Supplementary", mid1: "Mid-1", mid2: "Mid-2" } as const;

/** Approved past papers, newest first, optionally for one subject and kind. */
export async function getPapers(code?: string, kind?: "previous" | "regular") {
  const supabase = await supabaseServer();
  const subjects = (await supabase.from("subjects").select("id, code, name").eq("is_active", true).order("code")).data ?? [];
  let q = supabase.from("question_papers").select("id, subject_id, kind, exam_type, regulation, exam_year, exam_month, size_bytes, page_count")
    .eq("status", "approved").order("exam_year", { ascending: false }).order("exam_month", { ascending: false }).limit(200);
  const subject = code ? subjects.find((s) => s.code === code.toUpperCase()) : undefined;
  if (subject) q = q.eq("subject_id", subject.id);
  if (kind) q = q.eq("kind", kind);
  const papers = (await q).data ?? [];
  const byId = new Map(subjects.map((s) => [s.id, s]));
  const withPapers = new Set((await supabase.from("question_papers").select("subject_id").eq("status", "approved")).data?.map((r) => r.subject_id));
  return {
    subjects: subjects.filter((s) => withPapers.has(s.id)),
    selected: subject?.code ?? null,
    papers: papers.map((p) => ({
      id: p.id, subject: byId.get(p.subject_id)?.name ?? "", code: byId.get(p.subject_id)?.code ?? "",
      title: `${MONTHS[p.exam_month - 1]} ${p.exam_year} · ${EXAM[p.exam_type as keyof typeof EXAM]}`,
      meta: [p.kind === "regular" ? "Regular exam" : "Previous paper", p.regulation, p.page_count && `${p.page_count} ${p.page_count === 1 ? "page" : "pages"}`].filter(Boolean).join(" · "),
    })),
  };
}

export async function getPaperReadable(id: string) {
  const supabase = await supabaseServer();
  const { data: p } = await supabase.from("question_papers").select("id, file_path, exam_type, exam_year, exam_month, subjects(code, name)").eq("id", id).eq("status", "approved").maybeSingle();
  if (!p) return null;
  const s = p.subjects as unknown as { code: string; name: string };
  const { data: link } = await (await import("@/lib/supabase/admin")).supabaseAdmin().storage.from("papers").createSignedUrl(p.file_path, 600);
  return { id: p.id, url: link?.signedUrl ?? null, title: `${s.name} · ${MONTHS[p.exam_month - 1]} ${p.exam_year} ${EXAM[p.exam_type as keyof typeof EXAM]}`, back: `/papers?subject=${s.code}` };
}

export type Notice = { id: string; title: string; body: string; category: string; pinned: boolean; publishAt: string };

/** Live notices (RLS hides scheduled and expired ones), pinned first. */
export async function getNotices(limit = 30): Promise<Notice[]> {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("notices").select("id, title, body, category, pinned, publish_at").order("pinned", { ascending: false }).order("publish_at", { ascending: false }).limit(limit);
  return (data ?? []).map((n) => ({ id: n.id, title: n.title, body: n.body, category: n.category, pinned: n.pinned, publishAt: n.publish_at }));
}
