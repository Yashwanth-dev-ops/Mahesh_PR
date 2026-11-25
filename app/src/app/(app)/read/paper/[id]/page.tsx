import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { preload } from "react-dom";
import { Icon, Svg } from "@/components/app/bits";
import { PdfReader } from "@/components/app/PdfReader";
import { getPaperReadable } from "@/server/learn";
import { APP_NAME } from "@/lib/site";

export const metadata: Metadata = { title: `Past paper · ${APP_NAME}` };

async function Reader({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const p = /^[0-9a-f-]{36}$/.test(id) ? await getPaperReadable(id) : null;
  if (!p) notFound();
  // Start downloading the PDF while the page is still arriving, not after the reader's JavaScript starts.
  if (p.url) preload(p.url, { as: "fetch", crossOrigin: "anonymous" });
  return (
    <>
      <p className="ap-crumb"><Link href={p.back}><Svg d={Icon.left} size={16} /> Past papers</Link></p>
      <h1 className="ap-h2">{p.title}</h1>
      {p.url ? <PdfReader url={p.url} /> : <p className="ap-empty">Couldn&apos;t open this paper. Try again in a minute.</p>}
    </>
  );
}

export default function PaperReadPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<p className="ap-meta">Opening paper…</p>}><Reader params={params} /></Suspense>;
}
