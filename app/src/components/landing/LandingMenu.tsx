"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// The three-bar menu. Plain state (not the popover API) so it sits on top in every browser, iPhone Safari included.
export function LandingMenu({ nav }: { nav: [string, string][] }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement, prev = root.style.overflow;
    root.style.overflow = "hidden"; // the page behind doesn't scroll
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    addEventListener("keydown", esc);
    return () => { root.style.overflow = prev; removeEventListener("keydown", esc); };
  }, [open]);
  const close = () => setOpen(false);
  return (
    <>
      <button type="button" className="lp-menu" aria-label="Menu" aria-expanded={open} aria-controls="lp-sheet" onClick={() => setOpen(true)}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
      </button>
      {open && (
        <nav id="lp-sheet" className="lp-sheet" aria-label="Menu">
          <button type="button" className="lp-sheetClose" aria-label="Close menu" onClick={close} autoFocus>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
          <ul>{nav.map(([l, h]) => <li key={l}><Link href={h} onClick={close}>{l}</Link></li>)}</ul>
          <div className="lp-sheetActs">
            <Link className="lp-sheetPrimary" href="/login" onClick={close}>Student login</Link>
            <Link className="lp-sheetLine" href="/signup" onClick={close}>Create an account</Link>
          </div>
        </nav>
      )}
    </>
  );
}
