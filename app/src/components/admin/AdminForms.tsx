"use client";

import { useState } from "react";
import { deleteNotice, importRoster, postNotice, setStudentStatus, type RosterResult } from "@/app/actions/admin";

const FAILED = { ok: false, message: "Something went wrong. Try again." };

/** One pending student with Approve / Reject (or a rejected one with Give access). The row hides its buttons once decided. */
export function PendingRow({ s, rejected }: { s: { id: string; name: string; roll: string; year: number | null; section: string | null; reason: string }; rejected?: boolean }) {
  const [state, setState] = useState<"" | "busy" | string>("");
  const act = async (status: "active" | "suspended") => {
    setState("busy");
    const r = await setStudentStatus(s.id, status).catch(() => FAILED);
    setState(r.ok ? (status === "active" ? "Approved" : "Rejected") : r.message);
  };
  const decided = state === "Approved" || state === "Rejected";
  return (
    <li className="ad-row">
      <div className="ad-rowText">
        <p className="ad-strong">{s.name}</p>
        <p className="ad-meta">{s.roll} · {s.year ? ["", "I", "II", "III", "IV"][s.year] + " year" : "year ?"}{s.section ? ` ${s.section}` : ""} · {s.reason}</p>
      </div>
      {decided ? <span className={state === "Approved" ? "ad-ok" : "ad-meta"} role="status">{state}</span> : (
        <div className="ad-actions">
          {!rejected && <button className="ad-btnLine" disabled={state === "busy"} onClick={() => act("suspended")}>Reject</button>}
          <button className="ad-btnInk" disabled={state === "busy"} onClick={() => act("active")}>{rejected ? "Give access" : "Approve"}</button>
          {state && state !== "busy" && <span className="ad-err" role="status">{state}</span>}
        </div>
      )}
    </li>
  );
}

const CATS = [["notice", "Notice"], ["exam", "Exam"], ["event", "Event"], ["campaign", "Campaign"], ["placement", "Placement"]];

export function NoticeForm() {
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [cat, setCat] = useState("notice");
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    setBusy(true);
    const r = await postNotice(new FormData(form)).catch(() => FAILED);
    setBusy(false); setMsg(r);
    if (r.ok) { form.reset(); setCat("notice"); }
  };
  return (
    <form className="ad-form" onSubmit={submit}>
      <label className="ad-label" htmlFor="n-title">Title</label>
      <input id="n-title" name="title" className="ad-input" maxLength={140} required placeholder="Mid-2 exams start 2 December" />
      <label className="ad-label" htmlFor="n-body">Message</label>
      <textarea id="n-body" name="body" className="ad-input" rows={3} maxLength={4000} placeholder="Check your hall ticket by 28 November. Past papers are in Papers." />
      <fieldset className="ad-fieldset">
        <legend className="ad-label">Category</legend>
        <div className="ad-chips">
          {CATS.map(([v, l]) => (
            <label key={v} className="ad-chip" data-on={cat === v || undefined}>
              <input type="radio" name="category" value={v} checked={cat === v} onChange={() => setCat(v)} />{l}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="ad-formFoot">
        <label className="ad-check"><input type="checkbox" name="pinned" /> Pin to the top of Home</label>
        <label className="ad-check">Shows until <input type="date" name="expires" className="ad-input ad-date" /></label>
        <button className="ad-btnInk" disabled={busy}>{busy ? "Posting…" : "Post notice"}</button>
      </div>
      {msg && <p className={msg.ok ? "ad-ok" : "ad-err"} role="status">{msg.message}</p>}
    </form>
  );
}

export function RosterForm({ count }: { count: number }) {
  const [res, setRes] = useState<RosterResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const r = await importRoster(new FormData(e.currentTarget)).catch(() => FAILED as RosterResult);
    setBusy(false); setRes(r);
  };
  return (
    <form className="ad-form" onSubmit={submit}>
      <label className="ad-drop">
        <input type="file" name="file" accept=".csv,text/csv" onChange={(e) => setName(e.currentTarget.files?.[0]?.name ?? "")} />
        <span className="ad-strong">{name || "Choose CSV file"}</span>
        <span className="ad-mono">roll_no, full_name, year, section</span>
      </label>
      <button className="ad-btnInk" disabled={busy || !name}>{busy ? "Importing…" : "Import roster"}</button>
      {res && <p className={res.ok ? "ad-ok" : "ad-err"} role="status">{res.message}</p>}
      {res?.errors && res.errors.length > 0 && <ul className="ad-errList">{res.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
      <p className="ad-meta">{count} students on the list now.</p>
    </form>
  );
}

export function NoticeDelete({ id }: { id: string }) {
  const [gone, setGone] = useState(false);
  if (gone) return <span className="ad-meta">Deleted</span>;
  return (
    <button className="ad-btnLine ad-small" onClick={async () => {
      if (!confirm("Delete this notice? Students won't see it any more.")) return;
      const r = await deleteNotice(id).catch(() => FAILED); if (r.ok) setGone(true);
    }}>Delete</button>
  );
}
