"use client";

import { useState } from "react";
import { sendFeedback } from "@/app/actions/learn";

/** Pilot feedback: goes straight to the admin page. */
export function FeedbackForm() {
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const r = await sendFeedback(text, location.pathname).catch(() => ({ ok: false, message: "Couldn't send. Try again." }));
    setBusy(false); setMsg(r.message ?? "");
    if (r.ok) setText("");
  };
  return (
    <form className="ap-card ap-note" onSubmit={submit}>
      <label htmlFor="fb" className="ap-h3">Send feedback</label>
      <p className="ap-meta">Something confusing, broken or missing? Tell us. It goes to your library admin.</p>
      <textarea id="fb" rows={3} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="What should we fix or add?" />
      <button className="ap-btnInk" disabled={busy}>{busy ? "Sending…" : "Send feedback"}</button>
      <p className="ap-meta" role="status">{msg}</p>
    </form>
  );
}
