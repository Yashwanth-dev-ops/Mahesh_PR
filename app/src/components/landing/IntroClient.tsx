"use client";

import { useEffect, useState } from "react";

/**
 * Starts the cinematic intro on the first visit of a session (the head script in app/layout.tsx
 * set `<html data-intro="pending">` before paint) and scales the 640 px visual stage to its column.
 */
export function IntroController() {
  useEffect(() => {
    const root = document.documentElement;
    const visual = document.querySelector<HTMLElement>("[data-visual]");
    const stage = document.querySelector<HTMLElement>("[data-stage]");
    if (!visual || !stage) return;

    const fit = () => stage.style.setProperty("--s", String(Math.min(1, visual.clientWidth / 640)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(visual);

    if (root.dataset.intro !== "pending") return () => ro.disconnect();

    let cancelled = false;
    let done: ReturnType<typeof setTimeout> | undefined;
    const start = () => {
      // Only once: StrictMode runs this effect twice in dev.
      if (cancelled || root.dataset.intro !== "pending") return;
      root.dataset.intro = "play";
      try { sessionStorage.setItem("intro-seen", "1"); } catch {}
      // After the last entrance (~5.1 s) drop the intro styles, so finished animations stop holding layers.
      const freezing = /[?&]freeze=/.test(location.search);
      if (!freezing) done = setTimeout(() => { root.dataset.intro = "done"; }, 5300);

      // Dev-only review aid: /?freeze=2000 pins every intro animation at 2000 ms.
      const freeze = process.env.NODE_ENV !== "production" && /[?&]freeze=(\d+)/.exec(location.search);
      if (freeze) requestAnimationFrame(() => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = +freeze[1]; }));
    };
    // Wait for the fonts so letters do not reflow mid-animation (at most 800 ms).
    const t = setTimeout(start, 800);
    document.fonts?.ready.then(() => { clearTimeout(t); start(); });

    return () => { cancelled = true; clearTimeout(t); clearTimeout(done); ro.disconnect(); };
  }, []);

  return null;
}

/** Menu button that reports its state; the menu panel itself comes with the app navigation. */
export function MenuButton({ className }: { className: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button type="button" className={className} aria-expanded={open} aria-label="Menu" onClick={() => setOpen(!open)}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  );
}
