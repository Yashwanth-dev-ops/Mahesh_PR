import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { AuditFilters } from "@/components/admin/AuditFilters";
import { getAudit, type AuditRow } from "@/server/admin";
import { APP_NAME } from "@/lib/site";

export const metadata: Metadata = { title: `Audit log · Admin · ${APP_NAME}` };
const IST = "Asia/Kolkata";
const time = (iso: string) => new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: IST }).format(new Date(iso));
const full = (iso: string) => new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "medium", timeZone: IST }).format(new Date(iso));
const dayKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: IST }).format(new Date(iso)); // 2026-11-25
function dayLabel(key: string) {
  const today = dayKey(new Date().toISOString()), yest = dayKey(new Date(Date.now() - 86400_000).toISOString());
  const d = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: IST }).format(new Date(`${key}T12:00:00+05:30`));
  return key === today ? `Today · ${d}` : key === yest ? `Yesterday · ${d}` : d;
}
// Group rows under one day heading, so each row shows only its time.
function byDay(rows: AuditRow[]) {
  const out: [string, AuditRow[]][] = [];
  for (const r of rows) { const k = dayKey(r.at); if (out.at(-1)?.[0] === k) out.at(-1)![1].push(r); else out.push([k, [r]]); }
  return out;
}
const BAD = /^(Failed|Deleted|Removed|Blocked|Rejected)/;
type Search = { admin?: string; action?: string; q?: string; days?: string };

// Figma B5: every admin action and admin sign-in. Entries can't be changed or deleted (enforced in the database).
async function Audit({ searchParams }: { searchParams: Promise<Search> }) {
  await connection();
  const s = await searchParams;
  const days = Number(s.days) || 30;
  const d = await getAudit({ admin: s.admin || undefined, action: s.action || undefined, q: s.q || undefined, days });
  if (!d) return <p className="ad-meta">This page is for library admins.</p>;
  return (
    <>
      <AuditFilters>
        <label className="ad-select"><span className="ad-sr">Admin</span>
          <select name="admin" defaultValue={s.admin ?? ""}><option value="">Admin: All</option>{d.admins.map((a) => <option key={a}>{a}</option>)}</select></label>
        <label className="ad-select"><span className="ad-sr">Action</span>
          <select name="action" defaultValue={s.action ?? ""}><option value="">Action: All</option>{d.actions.map((a) => <option key={a}>{a}</option>)}</select></label>
        <label className="ad-select"><span className="ad-sr">When</span>
          <select name="days" defaultValue={String(days)}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="365">Last year</option></select></label>
        <label className="ad-search ad-searchSm"><span className="ad-sr">Search the target</span>
          <input type="search" name="q" defaultValue={s.q ?? ""} placeholder="Search roll number, email or name, then Enter" /></label>
      </AuditFilters>
      <section className="ad-card ad-tableCard" aria-label="Audit log">
        {d.rows.length === 0 ? <p className="ad-empty">Nothing in the log for these filters.</p> : (
          <div className="ad-tableWrap">
            <table className="ad-table ad-audit">
              <thead><tr><th scope="col">Time</th><th scope="col">Admin</th><th scope="col">Action</th><th scope="col">Target</th><th scope="col">Details</th></tr></thead>
              {byDay(d.rows).map(([k, rows]) => (
                <tbody key={k}>
                  <tr className="ad-dayRow"><th scope="colgroup" colSpan={5}>{dayLabel(k)} <span>· {rows.length} {rows.length === 1 ? "entry" : "entries"}</span></th></tr>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="ad-num"><time dateTime={r.at} title={full(r.at)}>{time(r.at)}</time></td>
                      <td>{r.admin === "—" ? <span className="ad-note">Not signed in</span> : r.admin}</td>
                      <td className={BAD.test(r.action) ? "ad-noteBad ad-actionCell" : "ad-actionCell"}>{r.action}</td>
                      <td>{r.target ?? "—"}</td><td className="ad-note">{r.details ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        )}
        <p className="ad-meta ad-tableFoot">Kept for 1 year · {d.rows.length === d.total ? `${d.total} ${d.total === 1 ? "entry" : "entries"}` : `newest ${d.rows.length} of ${d.total} entries`}</p>
      </section>
    </>
  );
}

export default function AuditPage({ searchParams }: { searchParams: Promise<Search> }) {
  return (
    <>
      <header className="ad-header">
        <div>
          <h1 className="ad-h1">Audit log</h1>
          <p className="ad-meta">Every admin action and admin sign-in. Entries can&apos;t be changed or deleted, even by admins.</p>
        </div>
      </header>
      <Suspense fallback={<p className="ad-meta">Loading the log…</p>}><Audit searchParams={searchParams} /></Suspense>
    </>
  );
}
