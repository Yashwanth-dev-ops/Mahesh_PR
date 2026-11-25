import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { InviteForm, TeamAction } from "@/components/admin/TeamForms";
import { getTeam } from "@/server/admin";
import { APP_NAME } from "@/lib/site";

export const metadata: Metadata = { title: `Admins · Admin · ${APP_NAME}` };
const day = (iso: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date(iso));

// Figma B3: one main admin; only they invite or remove admins. Every change goes to the audit log.
async function Team() {
  await connection();
  const t = await getTeam();
  if (!t) return <p className="ad-meta">This page is for library admins.</p>;
  return (
    <>
      <header className="ad-header">
        <div>
          <h1 className="ad-h1">Admins</h1>
          <p className="ad-meta">Only the main admin can invite or remove admins. Every change goes to the audit log.</p>
        </div>
        <div className="ad-actions"><Link className="ad-btnLine" href="/admin/audit">Audit log</Link></div>
      </header>
      <div className="ad-cols">
        <section className="ad-card" aria-labelledby="team-h">
          <h2 id="team-h" className="ad-h2">People with admin access</h2>
          <ul className="ad-list">
            {t.members.map((m) => (
              <li key={m.id} className="ad-row">
                <div className="ad-rowText">
                  <p className="ad-strong">{m.name}{m.id === t.me ? " (you)" : ""}</p>
                  <p className="ad-meta">{m.email} · since {day(m.since)}{m.isOwner ? " · can't be removed or blocked" : ""}</p>
                </div>
                <span className={`ad-badge ${m.isOwner ? "ad-badge-owner" : "ad-badge-active"}`}>{m.isOwner ? "Main admin" : "Admin"}</span>
                {t.canManage && !m.isOwner && <TeamAction kind="remove" id={m.id} label={m.name} />}
              </li>
            ))}
            {t.invites.map((i) => (
              <li key={i.id} className="ad-row">
                <div className="ad-rowText">
                  <p className="ad-strong">{i.name}</p>
                  <p className="ad-meta">{i.email} · invited {day(i.sent)} · the link works for 24 hours</p>
                </div>
                <span className="ad-badge ad-badge-pending">Invited</span>
                {t.canManage && <div className="ad-actions"><TeamAction kind="resend" id={i.id} label={i.name} /><TeamAction kind="cancel" id={i.id} label={i.name} /></div>}
              </li>
            ))}
          </ul>
        </section>
        {t.canManage ? (
          <section className="ad-card" aria-labelledby="inv-h">
            <h2 id="inv-h" className="ad-h2">Invite an admin</h2>
            <InviteForm />
            <p className="ad-meta">Only you see this card. Other admins can do everything else, but can&apos;t add or remove admins.</p>
          </section>
        ) : (
          <section className="ad-card"><h2 className="ad-h2">Adding admins</h2><p className="ad-meta">Only the main admin can invite or remove admins. Ask them if someone else needs access.</p></section>
        )}
      </div>
      <section className="ad-card">
        <h2 className="ad-h2">Separate logins</h2>
        <p className="ad-meta">Admins sign in at /admin/login with their email and password. Students sign in at /login with their roll number. Each page refuses the other kind of account.</p>
      </section>
    </>
  );
}

export default function AdminsPage() {
  return <Suspense fallback={<p className="ad-meta">Loading admins…</p>}><Team /></Suspense>;
}
