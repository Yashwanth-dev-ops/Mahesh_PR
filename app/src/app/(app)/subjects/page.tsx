import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { SubjectGrid } from "@/components/app/SubjectGrid";
import { getSubjects } from "@/server/learn";
import { APP_NAME } from "@/lib/site";

export const metadata: Metadata = { title: `Subjects · ${APP_NAME}` };
const YEAR = ["", "I", "II", "III", "IV"];

async function All() {
  await connection();
  const subjects = await getSubjects();
  const groups = new Map<string, typeof subjects>();
  for (const s of subjects) {
    const k = `${YEAR[s.year]} year · Semester ${s.semester}`;
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }
  if (!groups.size) return <p className="ap-empty">No subjects yet.</p>;
  return [...groups].map(([label, list]) => (
    <section key={label} aria-label={label} className="ap-group">
      <h2 className="ap-h2">{label}</h2>
      <SubjectGrid subjects={list} />
    </section>
  ));
}

export default function SubjectsPage() {
  return (
    <>
      <h1 className="ap-h1">Subjects</h1>
      <Suspense fallback={<p className="ap-meta">Loading subjects…</p>}><All /></Suspense>
    </>
  );
}
