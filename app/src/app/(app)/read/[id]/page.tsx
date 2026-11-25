import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { preload } from "react-dom";
import { Icon, Svg } from "@/components/app/bits";
import { PdfReader } from "@/components/app/PdfReader";
import { getReadable } from "@/server/learn";
import { APP_NAME } from "@/lib/site";

export const metadata: Metadata = { title: `Reader · ${APP_NAME}` };

async function Reader({ params }: { params: Promise<{ id: string }> }) {
  await connection(); // per-request: session cookie
  const { id } = await params;
  const m = /^[0-9a-f-]{36}$/.test(id) ? await getReadable(id) : null;
  if (!m) notFound();
  // Start downloading the PDF while the page is still arriving, not after the reader's JavaScript starts.
  if (m.url) preload(m.url, { as: "fetch", crossOrigin: "anonymous" });
  return (
    <>
      <p className="ap-crumb"><Link href={m.back}><Svg d={Icon.left} size={16} /> {m.where}</Link></p>
      <h1 className="ap-h2">{m.title}</h1>
      {m.url ? <PdfReader url={m.url} materialId={m.id} chapterId={m.chapterId} startPage={m.page} /> : <p className="ap-empty">Couldn&apos;t open this file. Try again in a minute.</p>}
    </>
  );
}

export default function ReadPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<p className="ap-meta">Opening file…</p>}><Reader params={params} /></Suspense>;
}
