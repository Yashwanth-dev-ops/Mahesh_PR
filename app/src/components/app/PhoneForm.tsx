"use client";

import { useState } from "react";
import { updatePhone } from "@/app/actions/profile";

const show = (p: string) => `${p.slice(0, 5)} ${p.slice(5)}`;

/** Profile: the student's mobile number (only admins see it), with a one-tap change. */
export function PhoneForm({ phone }: { phone: string | null }) {
  const [editing, setEditing] = useState(!phone);
  const [value, setValue] = useState(phone ?? "");
  const [saved, setSaved] = useState(phone);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const r = await updatePhone(value).catch(() => ({ ok: false, message: "Couldn't save. Try again." }));
    setBusy(false); setMsg(r.message);
    if (r.ok) { setSaved(value.replace(/\D/g, "").slice(-10)); setEditing(false); }
  };
  return (
    <form className="ap-card ap-note" onSubmit={save}>
      <label htmlFor="phone" className="ap-h3">Mobile number</label>
      <p className="ap-meta">Only library admins see it, to reach you about your account.</p>
      {editing ? (
        <>
          <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel-national" maxLength={16} className="ap-input"
            value={value} onChange={(e) => { setValue(e.target.value); setMsg(""); }} placeholder="10-digit number" aria-describedby="phone-msg" />
          <button className="ap-btnInk" disabled={busy}>{busy ? "Saving…" : "Save number"}</button>
        </>
      ) : (
        <p className="ap-phoneRow"><span className="ap-mono">{saved ? show(saved) : "—"}</span>
          <button type="button" className="ap-btnLine" onClick={() => { setEditing(true); setMsg(""); }}>Change number</button></p>
      )}
      <p id="phone-msg" className="ap-meta" role="status">{msg}</p>
    </form>
  );
}
