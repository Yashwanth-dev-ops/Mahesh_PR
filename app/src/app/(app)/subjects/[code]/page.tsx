import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Icon, Svg, plural } from "@/components/app/bits";
import { getSubject } from "@/server/learn";
import { APP_NAME } from "@/lib/site";

export const metadata: Metadata = { title: `Subject · ${APP_NAME}` };

async function Subject({ params }: { params: Promise<{ code: string }> }) {
  await connection(); // per-request: session cookie
  const { code } = await params;
  const s = await getSubject(code);
  if (!s) notFound();
  const percent = s.chapters.length ? Math.round((s.done / s.chapters.length) * 100) : 0;
  return (
    <>
      <p className="ap-crumb"><Link href="/subjects"><Svg d={Icon.left} size={16} /> Subjects</Link></p>
      <header className="ap-chHead">
        <p className="ap-code">{s.code} · {s.regulation}</p>
        <h1 className="ap-h1">{s.name}</h1>
        <p className="ap-meta">{plural(s.chapters.length, "chapter")} · {s.done} done · {percent}%</p>
      </header>
      {s.chapters.length ? (
        <ol className="ap-chapters">
          {s.chapters.map((c) => (
            <li key={c.id}>
              <Link href={`/subjects/${s.code}/${c.number}`} className="ap-card ap-chapter">
                <span className="ap-chNum">{String(c.number).padStart(2, "0")}</span>
                <span className="ap-chText">
                  <span className="ap-chTitle">{c.title}</span>
                  <span className="ap-meta">{c.materials ? plural(c.materials, "file") : "Notes only"}</span>
                </span>
                {c.done ? <span className="ap-done"><Svg d={Icon.check} size={16} /> Done</span> : <Svg d={Icon.right} />}
              </Link>
            </li>
          ))}
        </ol>
      ) : <p className="ap-empty">No chapters yet.</p>}
    </>
  );
}

export default function SubjectPage({ params }: { params: Promise<{ code: string }> }) {
  return <Suspense fallback={<p className="ap-meta">Loading chapters…</p>}><Subject params={params} /></Suspense>;
}
