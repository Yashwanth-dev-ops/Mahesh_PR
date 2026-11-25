"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import "./reveal.css";

type Phase = "loading" | "ok" | "leaving" | "closing";
type State = { phase: Phase; x: number; y: number; s: number; title: string; name: string; roll: string } | null;
type Msg = { type: "start"; x: number; y: number } | { type: "ok"; title: string; name: string; roll: string } | { type: "fail" };
const EVENT = "disc-reveal";
const send = (m: Msg) => window.dispatchEvent(new CustomEvent<Msg>(EVENT, { detail: m }));

/** Start the loader from the button's arrow disc (the element whose centre the yellow grows from). */
export function revealStart(from: Element | null) {
  const r = from?.getBoundingClientRect();
  send({ type: "start", x: r ? r.left + r.width / 2 : innerWidth / 2, y: r ? r.top + r.height / 2 : innerHeight / 2 });
}
/** Account found: show the greeting. The caller navigates right after; the host opens onto the new page. */
export const revealOk = (title: string, name: string, roll: string) => send({ type: "ok", title, name, roll });
/** Wrong details or not allowed in: shrink back into the button. */
export const revealFail = () => send({ type: "fail" });

/** Lives in the root layout, so the yellow stays on screen while the app changes page, then opens onto it. */
export function RevealHost() {
  const [st, setSt] = useState<State>(null);
  const path = usePathname();
  const startPath = useRef(path);

  useEffect(() => {
    const on = (e: Event) => {
      const m = (e as CustomEvent<Msg>).detail;
      if (m.type === "start") {
        startPath.current = location.pathname;
        const far = Math.hypot(Math.max(m.x, innerWidth - m.x), Math.max(m.y, innerHeight - m.y));
        setSt({ phase: "loading", x: m.x, y: m.y, s: Math.ceil((far * 2) / 40) + 1, title: "", name: "", roll: "" });
      } else if (m.type === "ok") setSt((s) => s && { ...s, phase: "ok", title: m.title, name: m.name, roll: m.roll });
      else setSt((s) => s && { ...s, phase: "closing" });
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);

  // The next page is on screen: open the yellow onto it.
  useEffect(() => {
    if (st?.phase === "ok" && path !== startPath.current) {
      const t = setTimeout(() => setSt((s) => s && { ...s, phase: "leaving" }), 250); // let the page paint first
      return () => clearTimeout(t);
    }
  }, [path, st?.phase]);

  // Closing/leaving end with their animation; a timer is the backstop (and the whole path under reduced motion).
  useEffect(() => {
    if (st?.phase !== "closing" && st?.phase !== "leaving") return;
    const t = setTimeout(() => setSt(null), st.phase === "leaving" ? 1000 : 500);
    return () => clearTimeout(t);
  }, [st?.phase]);

  if (!st) return null;
  const text = st.name ? `${st.title}, ${st.name}` : st.title;
  let i = 0;
  return (
    <div className="rv" data-phase={st.phase} role="status" aria-live="polite"
      aria-label={st.phase === "loading" ? "Checking your account" : text ? `${text}. Opening your library.` : undefined}
      style={{ "--x": `${st.x}px`, "--y": `${st.y}px`, "--s": String(st.s) } as React.CSSProperties}>
      <div className="rv-disc" />
      <div className="rv-body" aria-hidden="true">
        <div className="rv-badge">
          <svg className="rv-ring" viewBox="0 0 120 120"><circle cx="60" cy="60" r="58" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 6" strokeLinecap="round" /></svg>
          <span className="rv-dot">
            <svg className="rv-check" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </span>
        </div>
        <p className="rv-hi">
          {text && text.split(" ").map((w, wi) => (
            <span key={wi}>{wi > 0 && " "}<span className="w">{[...w].map((c, ci) => <span key={ci} className="c" style={{ "--i": i++ } as React.CSSProperties}>{c}</span>)}</span></span>
          ))}
        </p>
        <p className="rv-sub">{st.phase === "loading" ? "Checking your account…" : st.roll && `${st.roll} · AI-ML`}</p>
      </div>
    </div>
  );
}
