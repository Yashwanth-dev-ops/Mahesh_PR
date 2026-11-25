import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PaperRow } from "@/components/app/PaperRow";
import { getPapers } from "@/server/learn";
import { APP_NAME } from "@/lib/site";

export const metadata: Metadata = { title: `Past papers · ${APP_NAME}` };
type SP = Promise<{ subject?: string; kind?: string }>;

async function Papers({ searchParams }: { searchParams: SP }) {
  await connection();
  const sp = await searchParams;
  const kind = sp.kind === "regular" || sp.kind === "previous" ? sp.kind : undefined;
  const d = await getPapers(sp.subject, kind);
  const href = (subject?: string | null, k?: string) => {
    const q = new URLSearchParams(); if (subject) q.set("subject", subject); if (k) q.set("kind", k);
    return `/papers${q.size ? `?${q}` : ""}`;
  };
  return (
    <>
      <nav className="ap-seg" aria-label="Paper type">
        <Link href={href(d.selected)} aria-current={!kind ? "page" : undefined}>All</Link>
        <Link href={href(d.selected, "previous")} aria-current={kind === "previous" ? "page" : undefined}>Previous papers</Link>
        <Link href={href(d.selected, "regular")} aria-current={kind === "regular" ? "page" : undefined}>Regular exam</Link>
      </nav>
      {d.subjects.length > 1 && (
        <nav className="ap-chips" aria-label="Subject">
          <Link href={href(null, kind)} className="ap-chip" aria-current={!d.selected ? "page" : undefined}>All subjects</Link>
          {d.subjects.map((s) => <Link key={s.code} href={href(s.code, kind)} className="ap-chip" aria-current={d.selected === s.code ? "page" : undefined}>{s.name}</Link>)}
        </nav>
      )}
      {d.papers.length ? <ul className="ap-files">{d.papers.map((p) => <PaperRow key={p.id} p={p} />)}</ul>
        : <p className="ap-empty">No past papers here yet. Your admin is adding them before exams.</p>}
    </>
  );
}

export default function PapersPage({ searchParams }: { searchParams: SP }) {
  return (
    <>
      <h1 className="ap-h1">Past papers</h1>
      <Suspense fallback={<p className="ap-meta">Loading papers…</p>}><Papers searchParams={searchParams} /></Suspense>
    </>
  );
}
