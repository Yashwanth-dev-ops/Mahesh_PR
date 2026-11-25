import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { search } from "@/server/learn";
import { APP_NAME } from "@/lib/site";

export const metadata: Metadata = { title: `Search · ${APP_NAME}` };

async function Results({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await connection(); // per-request: session cookie
  const q = String((await searchParams).q ?? "");
  const r = await search(q);
  const count = r.subjects.length + r.chapters.length + r.sections.length;
  return (
    <>
      <form className="ap-searchBox ap-searchBig" role="search" action="/search">
        <label htmlFor="q" className="ap-sr">Search subjects and notes</label>
        <input id="q" name="q" type="search" defaultValue={q} placeholder="Search subjects, chapters and notes" autoComplete="off" />
        <button className="ap-btnInk">Search</button>
      </form>
      {q.trim().length >= 2 && !count && <p className="ap-empty">No results for &ldquo;{q}&rdquo;. Try a shorter word.</p>}
      {r.subjects.length > 0 && <section className="ap-block"><h2 className="ap-h2">Subjects</h2><ul className="ap-results">
        {r.subjects.map((s) => <li key={s.code}><Link className="ap-card ap-result" href={`/subjects/${s.code}`}><span className="ap-code">{s.code}</span> {s.name}</Link></li>)}
      </ul></section>}
      {r.chapters.length > 0 && <section className="ap-block"><h2 className="ap-h2">Chapters</h2><ul className="ap-results">
        {r.chapters.map((c) => <li key={c.code + c.number}><Link className="ap-card ap-result" href={`/subjects/${c.code}/${c.number}`}><span className="ap-meta">{c.name} · Ch {c.number}</span><span>{c.title}</span></Link></li>)}
      </ul></section>}
      {r.sections.length > 0 && <section className="ap-block"><h2 className="ap-h2">In the notes</h2><ul className="ap-results">
        {r.sections.map((s, i) => <li key={i}><Link className="ap-card ap-result" href={`/subjects/${s.code}/${s.number}`}><span className="ap-meta">{s.subject} · Ch {s.number} {s.chapterTitle}</span><span className="ap-chTitle">{s.heading}</span><span className="ap-snippet">{s.body.slice(0, 140)}{s.body.length > 140 ? "…" : ""}</span></Link></li>)}
      </ul></section>}
    </>
  );
}

export default function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  return (
    <>
      <h1 className="ap-h1">Search</h1>
      <Suspense fallback={<p className="ap-meta">Searching…</p>}><Results searchParams={searchParams} /></Suspense>
    </>
  );
}
