"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cancelInvite, inviteAdmin, removeAdmin, resendInvite } from "@/app/actions/team";

const FAILED = { ok: false, message: "Something went wrong. Try again." };

/** Remove admin / Resend invite / Cancel invite: one quiet button with its result in place. */
export function TeamAction({ kind, id, label }: { kind: "remove" | "resend" | "cancel"; id: string; label: string }) {
  const router = useRouter();
  const [state, setState] = useState<"" | "busy" | string>("");
  const go = async () => {
    if (kind === "remove" && !confirm(`Remove ${label}'s admin access? Their admin account is deleted.`)) return;
    setState("busy");
    const fn = kind === "remove" ? removeAdmin : kind === "resend" ? resendInvite : cancelInvite;
    const r = await fn(id).catch(() => FAILED);
    setState(r.message);
    if (r.ok && kind !== "resend") router.refresh();
  };
  const text = { remove: "Remove admin", resend: "Resend invite", cancel: "Cancel invite" }[kind];
  return state && state !== "busy" ? <span className="ad-meta" role="status">{state}</span>
    : <button type="button" className="ad-btnLine ad-small" disabled={state === "busy"} onClick={go}>{state === "busy" ? "…" : text}</button>;
}

/** Main admin only: invite someone by email. */
export function InviteForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    setBusy(true); setMsg(null);
    const r = await inviteAdmin(new FormData(form)).catch(() => FAILED);
    setBusy(false); setMsg({ ok: r.ok, text: r.message });
    if (r.ok) { form.reset(); router.refresh(); }
  };
  return (
    <form className="ad-form" onSubmit={submit}>
      <label className="ad-label" htmlFor="inv-name">Name</label>
      <input id="inv-name" name="name" className="ad-input" maxLength={80} required autoComplete="off" placeholder="e.g. Priya T" />
      <label className="ad-label" htmlFor="inv-email">Email <span className="ad-meta">· where the invitation goes</span></label>
      <input id="inv-email" name="email" type="email" className="ad-input" maxLength={120} required autoComplete="off" placeholder="name@college.edu" />
      <button className="ad-btnInk" disabled={busy}>{busy ? "Sending…" : "Send invitation"}</button>
      <p className={msg ? (msg.ok ? "ad-ok" : "ad-err") : "ad-meta"} role="status">{msg?.text ?? "They get an email with a link to set their own password. The link works once, for 24 hours."}</p>
    </form>
  );
}
