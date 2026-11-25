"use client";

import { useEffect, useRef, useState } from "react";
import { saveNote } from "@/app/actions/learn";
import { SubjectIcon } from "./bits";

type S = { id: string; code: string; name: string; body: string };

function Note({ s }: { s: S }) {
  const [body, setBody] = useState(s.body);
  const [state, setState] = useState<"" | "saving" | "saved" | string>("");
  const saved = useRef(s.body);
  useEffect(() => {
    if (body === saved.current) return;
    setState("saving");
    const t = setTimeout(async () => {
      const r = await saveNote(s.id, body).catch(() => ({ ok: false, message: "Couldn't save. Check your connection." }));
      if (r.ok) { saved.current = body; setState("saved"); } else setState(r.message ?? "Couldn't save.");
    }, 900); // autosave after a short pause in typing
    return () => clearTimeout(t);
  }, [body, s.id]);
  const id = `note-${s.code}`;
  return (
    <li className="ap-card ap-note">
      <label htmlFor={id} className="ap-noteHead"><SubjectIcon name={s.name} /><span className="ap-chTitle">{s.name}</span></label>
      <textarea id={id} rows={4} maxLength={20000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write what you want to remember…" />
      <p className="ap-meta" role="status">{state === "saving" ? "Saving…" : state === "saved" ? "Saved" : state}</p>
    </li>
  );
}

export function NotesEditor({ subjects }: { subjects: S[] }) {
  return <ul className="ap-notes">{subjects.map((s) => <Note key={s.id} s={s} />)}</ul>;
}
