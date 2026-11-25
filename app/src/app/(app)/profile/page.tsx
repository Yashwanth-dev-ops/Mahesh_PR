import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { signOut } from "@/app/actions/auth";
import Link from "next/link";
import { FeedbackForm } from "@/components/app/FeedbackForm";
import { DeleteAccount } from "@/components/privacy/DeleteAccount";
import { getMe, getSubjects } from "@/server/learn";
import { APP_NAME } from "@/lib/site";

export const metadata: Metadata = { title: `Profile · ${APP_NAME}` };
const YEAR = ["", "I", "II", "III", "IV"];

async function Profile() {
  await connection();
  const me = await getMe();
  if (!me) return null;
  const subjects = await getSubjects(me.year);
  const done = subjects.reduce((a, s) => a + s.done, 0), total = subjects.reduce((a, s) => a + s.chapters, 0);
  return (
    <>
      <header className="ap-hello">
        {/* eslint-disable-next-line @next/next/no-img-element -- student photo from Supabase storage */}
        {me.avatarUrl ? <img src={me.avatarUrl} alt="" className="ap-avatar" /> : <span className="ap-avatar" aria-hidden="true">{me.firstName[0]}</span>}
        <div>
          <h1 className="ap-h1">{me.fullName}</h1>
          <p className="ap-meta">{me.rollNo} · {YEAR[me.year ?? 0]} year · AI-ML · Section {me.section}</p>
        </div>
      </header>
      <dl className="ap-stats">
        <div className="ap-card ap-stat"><dt className="ap-caption">Chapters done</dt><dd>{done} <span className="ap-meta">of {total}</span></dd></div>
        <div className="ap-card ap-stat"><dt className="ap-caption">Subjects</dt><dd>{subjects.length}</dd></div>
      </dl>
      <FeedbackForm />
      <form action={signOut}><button className="ap-btnLine ap-wide">Sign out</button></form>
      <section className="ap-block" aria-labelledby="privacy-title">
        <div className="ap-secHead">
          <h2 id="privacy-title" className="ap-h2">Your data</h2>
          <Link href="/privacy" className="ap-meta ap-tapLink">Privacy notice</Link>
        </div>
        <a href="/profile/data" download className="ap-btnLine ap-wide">Download my data</a>
        {me.role === "admin" ? <p className="ap-meta">Admin accounts are removed by another admin.</p> : <DeleteAccount />}
      </section>
    </>
  );
}

export default function ProfilePage() {
  return <Suspense fallback={<p className="ap-meta">Loading profile…</p>}><Profile /></Suspense>;
}
