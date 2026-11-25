import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { NotesEditor } from "@/components/app/NotesEditor";
import { getNotes } from "@/server/learn";
import { APP_NAME } from "@/lib/site";

export const metadata: Metadata = { title: `My notes · ${APP_NAME}` };

async function Notes() {
  await connection();
  const subjects = await getNotes();
  return subjects.length ? <NotesEditor subjects={subjects} /> : <p className="ap-empty">No subjects yet.</p>;
}

export default function NotesPage() {
  return (
    <>
      <h1 className="ap-h1">My notes</h1>
      <p className="ap-meta">Your own notes for each subject. Only you can see them. They save as you type.</p>
      <Suspense fallback={<p className="ap-meta">Loading notes…</p>}><Notes /></Suspense>
    </>
  );
}
