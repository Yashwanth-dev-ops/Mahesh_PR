import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Icon, Svg } from "@/components/app/bits";
import { ChapterView } from "@/components/app/ChapterView";
import { getChapter } from "@/server/learn";
import { APP_NAME } from "@/lib/site";

export const metadata: Metadata = { title: `Chapter · ${APP_NAME}` };

async function Chapter({ params }: { params: Promise<{ code: string; chapter: string }> }) {
  await connection(); // per-request: session cookie
  const { code, chapter } = await params;
  const n = Number(chapter);
  const d = Number.isInteger(n) && n > 0 ? await getChapter(code, n) : null;
  if (!d) notFound();
  const base = `/subjects/${d.subject.code}`;
  return (
    <>
      <p className="ap-crumb"><Link href={base}><Svg d={Icon.left} size={16} /> {d.subject.name}</Link></p>
      <ChapterView
        key={d.chapter.id}
        chapterId={d.chapter.id}
        label={`Chapter ${d.chapter.number} of ${d.total}`}
        title={d.chapter.title}
        done={d.chapter.done}
        sections={d.sections}
        materials={d.materials}
        questions={d.questions}
        known={d.known}
        prev={d.prev && { href: `${base}/${d.prev.number}`, title: d.prev.title }}
        next={d.next && { href: `${base}/${d.next.number}`, title: d.next.title }}
      />
    </>
  );
}

export default function ChapterPage({ params }: { params: Promise<{ code: string; chapter: string }> }) {
  return <Suspense fallback={<p className="ap-meta">Opening chapter…</p>}><Chapter params={params} /></Suspense>;
}
