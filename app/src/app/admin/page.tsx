import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { signOut } from "@/app/actions/auth";
import { NoticeDelete, NoticeForm, PendingRow, RosterForm } from "@/components/admin/AdminForms";
import { getDashboard } from "@/server/admin";
import { APP_NAME } from "@/lib/site";
import "@/components/admin/admin.css";

export const metadata: Metadata = { title: `Admin · ${APP_NAME}` };
const day = (iso: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date(iso));
const ago = (iso: string) => { const h = Math.round((Date.now() - +new Date(iso)) / 3600000); return h < 1 ? "now" : h < 24 ? `${h}h` : `${Math.round(h / 24)}d`; };

// Figma "A9 Pilot admin": approvals, feedback, notices, roster. The proxy already limits /admin to admins.
async function Dashboard() {
  await connection();
  const d = await getDashboard();
  if (!d) return <p className="ad-meta">This page is for library admins.</p>;
  const today = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date());
  return (
    <>
      <header className="ad-header" id="dashboard">
        <div>
          <h1 className="ad-h1">Dashboard</h1>
          <p className="ad-meta">Class pilot · AI-ML · {today}</p>
        </div>
        <div className="ad-actions">
          <a className="ad-btnLine" href="#roster">Import roster (CSV)</a>
          <a className="ad-btnInk" href="#notice">Post a notice</a>
        </div>
      </header>

      <section className="ad-stats" aria-label="Pilot numbers">
        <div className="ad-stat"><b>{d.stats.students}</b><span>students signed up</span></div>
        <div className="ad-stat ad-statY"><b>{d.stats.waiting}</b><span>waiting for approval</span></div>
        <div className="ad-stat"><b>{d.stats.activeWeek}</b><span>active this week</span></div>
        <div className="ad-stat"><b>{d.stats.newFeedback}</b><span>new feedback (7 days)</span></div>
      </section>

      <div className="ad-cols">
        <section className="ad-card" id="students" aria-labelledby="w-h">
          <div className="ad-cardHead"><h2 id="w-h" className="ad-h2">Waiting for approval</h2></div>
          {d.waiting.length ? <ul className="ad-list">{d.waiting.map((s) => <PendingRow key={s.id} s={s} />)}</ul>
            : <p className="ad-empty">Nobody is waiting. New sign-ups that don&apos;t match the roster appear here.</p>}
        </section>
        <section className="ad-card" id="feedback" aria-labelledby="f-h">
          <div className="ad-cardHead"><h2 id="f-h" className="ad-h2">Latest feedback</h2></div>
          {d.feedback.length ? (
            <ul className="ad-list">
              {d.feedback.map((f) => (
                <li key={f.id} className="ad-fb">
                  <span className="ad-mono">{f.name.slice(0, 1)}</span>
                  <p><span className="ad-strong">{f.name}</span> <span className="ad-meta">· {ago(f.at)}{f.page ? ` · ${f.page}` : ""}</span><br />{f.message}</p>
                </li>
              ))}
            </ul>
          ) : <p className="ad-empty">No feedback yet. Students send it from their Profile page.</p>}
        </section>
      </div>

      <div className="ad-cols">
        <section className="ad-card" id="notice" aria-labelledby="n-h">
          <div className="ad-cardHead"><h2 id="n-h" className="ad-h2">Post a notice</h2></div>
          <NoticeForm />
        </section>
        <section className="ad-card" id="roster" aria-labelledby="r-h">
          <div className="ad-cardHead"><h2 id="r-h" className="ad-h2">Import roster</h2></div>
          <p className="ad-meta">Upload the class list as a CSV file. Students whose roll number and name match are approved automatically, including anyone already waiting.</p>
          <RosterForm count={d.stats.roster} />
        </section>
      </div>

      <section className="ad-card" id="notices" aria-labelledby="nl-h">
        <div className="ad-cardHead"><h2 id="nl-h" className="ad-h2">Notices</h2></div>
        {d.notices.length ? (
          <ul className="ad-list">
            {d.notices.map((n) => (
              <li key={n.id} className="ad-row">
                <div className="ad-rowText">
                  <p className="ad-strong">{n.title}</p>
                  <p className="ad-meta">{n.category} · {day(n.publish_at)}{n.expires_at ? ` → ${day(n.expires_at)}` : ""}{n.pinned ? " · pinned" : ""} · {n.live ? "showing" : "not showing"}</p>
                </div>
                <NoticeDelete id={n.id} />
              </li>
            ))}
          </ul>
        ) : <p className="ad-empty">No notices yet.</p>}
      </section>

      <section className="ad-card" id="content" aria-labelledby="c-h">
        <div className="ad-cardHead"><h2 id="c-h" className="ad-h2">Content</h2></div>
        <p className="ad-meta">For the pilot, subjects, chapters, PDFs and past papers are loaded from a folder with the import script. Send the folder to the developer, or see <code>scripts/import-library.mjs</code> for the layout. Uploading from this page comes after the pilot.</p>
      </section>
    </>
  );
}

export default function AdminPage() {
  return (
    <div className="ad-shell">
      <nav className="ad-side" aria-label="Admin">
        <p className="ad-brand"><span className="ad-mark" aria-hidden="true">A</span><span>{APP_NAME}<span className="ad-tag">ADMIN</span></span></p>
        <ul>
          {[["#dashboard", "Dashboard"], ["#students", "Students"], ["#notices", "Notices"], ["#feedback", "Feedback"], ["#content", "Content"]].map(([h, l]) => <li key={h}><a href={h}>{l}</a></li>)}
        </ul>
        <form action={signOut}><button className="ad-sideOut">Sign out</button></form>
      </nav>
      <main className="ad-main">
        <Suspense fallback={<p className="ad-meta">Loading dashboard…</p>}><Dashboard /></Suspense>
      </main>
    </div>
  );
}
