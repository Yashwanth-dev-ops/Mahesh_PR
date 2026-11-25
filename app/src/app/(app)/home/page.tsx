import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { SubjectGrid } from "@/components/app/SubjectGrid";
import { NoticeCard } from "@/components/app/bits";
import { getContinue, getMe, getNotices, getSubjects } from "@/server/learn";
import { APP_NAME } from "@/lib/site";

export const metadata: Metadata = { title: `Home · ${APP_NAME}` };

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
const YEAR = ["", "I", "II", "III", "IV"];

async function Home() {
  await connection(); // per-request: session cookie + clock
  const me = await getMe();
  if (!me) return null; // the proxy routes signed-out / inactive accounts
  const [subjects, cont, notices] = await Promise.all([getSubjects(me.year), getContinue(), getNotices(1)]);
  const done = subjects.reduce((a, s) => a + s.done, 0), total = subjects.reduce((a, s) => a + s.chapters, 0);
  const first = subjects.find((s) => s.chapters > 0);

  return (
    <>
      <header className="ap-hello">
        {/* eslint-disable-next-line @next/next/no-img-element -- student photo from Supabase storage */}
        {me.avatarUrl ? <img src={me.avatarUrl} alt="" className="ap-avatar" /> : <span className="ap-avatar" aria-hidden="true">{me.firstName[0]}</span>}
        <div>
          <h1 className="ap-h1">{greeting()}, {me.firstName}</h1>
          <p className="ap-meta">{YEAR[me.year ?? 0]} year · AI-ML · Section {me.section}</p>
        </div>
      </header>

      {notices[0] && (
        <section aria-label="Latest notice" className="ap-group">
          <NoticeCard n={notices[0]} clamp />
          <p className="ap-more"><Link href="/notices">All notices</Link></p>
        </section>
      )}

      <section className="ap-continue" aria-labelledby="cont-h">
        <p className="ap-kicker" id="cont-h">{cont ? "Continue learning" : "Start learning"}</p>
        {cont ? (
          <>
            <p className="ap-contTitle">{cont.subject} · Ch {cont.number} {cont.title}</p>
            <div className="ap-bar" role="img" aria-label={`${done} of ${total} chapters done`}><i style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div>
            <Link className="ap-btnY" href={`/subjects/${cont.code}/${cont.number}`}>{cont.page ? `Resume at page ${cont.page}` : "Resume chapter"}</Link>
          </>
        ) : first ? (
          <>
            <p className="ap-contTitle">{first.name} · Chapter 1</p>
            <Link className="ap-btnY" href={`/subjects/${first.code}/1`}>Open chapter 1</Link>
          </>
        ) : <p className="ap-contTitle">Your subjects will appear here once an admin adds them.</p>}
      </section>

      <section aria-labelledby="subs-h">
        <div className="ap-secHead">
          <h2 id="subs-h" className="ap-h2">Your subjects</h2>
          <p className="ap-meta">{done} of {total} chapters done</p>
        </div>
        <SubjectGrid subjects={subjects} />
        <p className="ap-more"><Link href="/subjects">All subjects</Link></p>
      </section>
    </>
  );
}

export default function HomePage() {
  return <Suspense fallback={<p className="ap-meta">Loading your library…</p>}><Home /></Suspense>;
}
