"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

async function me() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Mark a chapter done / not done. */
export async function setChapterDone(chapterId: string, done: boolean) {
  const { supabase, user } = await me();
  if (!user) return { ok: false };
  const { error } = await supabase.from("chapter_progress").upsert({ user_id: user.id, chapter_id: chapterId, done }, { onConflict: "user_id,chapter_id" });
  return { ok: !error };
}

/** Remember the chapter (and page) the student is on, for "Continue learning". Keeps `done` as it is. */
export async function touchChapter(chapterId: string, materialId?: string, page?: number) {
  const { supabase, user } = await me();
  if (!user) return;
  const row: Record<string, unknown> = { user_id: user.id, chapter_id: chapterId };
  if (materialId) row.last_material_id = materialId;
  if (page && page >= 1 && page < 10000) row.last_page = Math.floor(page);
  await supabase.from("chapter_progress").upsert(row, { onConflict: "user_id,chapter_id" });
}

export async function setKnown(questionId: string, known: boolean) {
  const { supabase, user } = await me();
  if (!user) return { ok: false };
  const { error } = known
    ? await supabase.from("known_questions").upsert({ user_id: user.id, question_id: questionId })
    : await supabase.from("known_questions").delete().eq("user_id", user.id).eq("question_id", questionId);
  return { ok: !error };
}

export async function saveNote(subjectId: string, body: string) {
  const { supabase, user } = await me();
  if (!user) return { ok: false, message: "Your session ended. Log in again." };
  if (body.length > 20000) return { ok: false, message: "Notes are limited to 20,000 characters per subject." };
  const { error } = await supabase.from("subject_notes").upsert({ user_id: user.id, subject_id: subjectId, body }, { onConflict: "user_id,subject_id" });
  revalidatePath("/notes");
  return { ok: !error, message: error ? "Couldn't save. Check your connection." : undefined };
}

/** A 10-minute link to one approved material the student is allowed to see (SECURITY.md, DATABASE.md §11). */
export async function materialLink(materialId: string, download = false) {
  const { supabase, user } = await me();
  if (!user) return { url: null };
  // RLS decides visibility: if the student can't select it, they get nothing.
  const { data: m } = await supabase.from("materials").select("id, file_path, url, title, download_count").eq("id", materialId).maybeSingle();
  if (!m) return { url: null };
  if (m.url) return { url: m.url as string };
  const admin = supabaseAdmin();
  const { data } = await admin.storage.from("materials").createSignedUrl(m.file_path!, 600, download ? { download: `${m.title}.pdf` } : undefined);
  // shortcut: read-modify-write counter can drop a count under heavy concurrency; use an RPC increment at scale.
  if (download) await admin.from("materials").update({ download_count: (m.download_count ?? 0) + 1 }).eq("id", m.id);
  return { url: data?.signedUrl ?? null };
}

/** 10-minute link to an approved past paper. */
export async function paperLink(paperId: string) {
  const { supabase, user } = await me();
  if (!user) return { url: null };
  const { data: p } = await supabase.from("question_papers").select("id, file_path, download_count").eq("id", paperId).eq("status", "approved").maybeSingle();
  if (!p) return { url: null };
  const admin = supabaseAdmin();
  const { data } = await admin.storage.from("papers").createSignedUrl(p.file_path, 600, { download: true });
  await admin.from("question_papers").update({ download_count: (p.download_count ?? 0) + 1 }).eq("id", p.id);
  return { url: data?.signedUrl ?? null };
}

/** Pilot feedback from the Profile page. */
export async function sendFeedback(message: string, page: string) {
  const { supabase, user } = await me();
  if (!user) return { ok: false, message: "Your session ended. Log in again." };
  const text = message.trim();
  if (text.length < 3) return { ok: false, message: "Write a few words first." };
  if (text.length > 2000) return { ok: false, message: "Keep it under 2,000 characters." };
  const { error } = await supabase.from("feedback").insert({ user_id: user.id, message: text, page: page.slice(0, 200) });
  return error ? { ok: false, message: "Couldn't send. Try again." } : { ok: true, message: "Thanks! Your feedback reached the admin." };
}
