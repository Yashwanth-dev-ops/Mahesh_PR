import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { NoticeCard } from "@/components/app/bits";
import { getNotices } from "@/server/learn";
import { APP_NAME } from "@/lib/site";

export const metadata: Metadata = { title: `Notices · ${APP_NAME}` };

async function List() {
  await connection();
  const notices = await getNotices();
  if (!notices.length) return <p className="ap-empty">No notices right now. Exam dates and college news appear here.</p>;
  return <ul className="ap-results">{notices.map((n) => <li key={n.id}><NoticeCard n={n} /></li>)}</ul>;
}

export default function NoticesPage() {
  return (
    <>
      <h1 className="ap-h1">Notices</h1>
      <Suspense fallback={<p className="ap-meta">Loading notices…</p>}><List /></Suspense>
    </>
  );
}
