"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "@/app/actions/auth";

const ITEMS = [["/admin", "Dashboard"], ["/admin/students", "Students"], ["/admin/admins", "Admins"], ["/admin#notices", "Notices"], ["/admin#feedback", "Feedback"], ["/admin#content", "Content"], ["/admin/audit", "Audit log"]];
const isCurrent = (path: string, h: string) => (h === "/admin" ? path === "/admin" : !h.includes("#") && path.startsWith(h));

/** Sidebar (laptop) / scrolling strip (tablet) links. Hidden on phones, where AdminTabs takes over. */
export function AdminNav() {
  const path = usePathname();
  return (
    <ul className="ad-sideList">
      {ITEMS.map(([h, l]) => <li key={h}><Link href={h} aria-current={isCurrent(path, h) ? "page" : undefined}>{l}</Link></li>)}
    </ul>
  );
}

const Ico = ({ d }: { d: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const TABS: [string, string, string][] = [
  ["/admin", "Dashboard", "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"],
  ["/admin/students", "Students", "M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 19v-1a4 4 0 0 0-3-3.9M16 3.1a3.5 3.5 0 0 1 0 6.8"],
  ["/admin/admins", "Admins", "M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"],
  ["/admin/audit", "Audit log", "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"],
];

// Phone menus: plain React state (no popover API), so they behave the same in every browser, old iPhones included.
// Only one is open at a time; a tap outside, Escape, or tapping an item closes it.
const OPEN_EVENT = "ad-menu-open";
function useMenu(id: string) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const other = (e: Event) => { if ((e as CustomEvent<string>).detail !== id) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    addEventListener(OPEN_EVENT, other); addEventListener("keydown", esc);
    return () => { removeEventListener(OPEN_EVENT, other); removeEventListener("keydown", esc); };
  }, [id]);
  const toggle = () => setOpen((o) => { if (!o) dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id })); return !o; });
  return { open, toggle, close: () => setOpen(false) };
}
const Scrim = ({ onClose }: { onClose: () => void }) => <button type="button" className="ad-scrim" aria-label="Close menu" onClick={onClose} />;

/** Phones (Figma B6): bottom tab bar, plus "More" for the rest. */
export function AdminTabs() {
  const path = usePathname();
  const m = useMenu("more");
  useEffect(() => m.close(), [path]); // eslint-disable-line react-hooks/exhaustive-deps -- close on navigation
  return (
    <>
      <nav className="ad-tabs" aria-label="Admin">
        {TABS.map(([h, l, d]) => (
          <Link key={h} href={h} className="ad-tab" aria-current={isCurrent(path, h) ? "page" : undefined}><Ico d={d} /><span>{l}</span></Link>
        ))}
        <button type="button" className="ad-tab" aria-expanded={m.open} aria-controls="ad-more" onClick={m.toggle}><Ico d="M5 12h.01M12 12h.01M19 12h.01" /><span>More</span></button>
      </nav>
      {m.open && <>
        <Scrim onClose={m.close} />
        <div id="ad-more" className="ad-pop ad-popUp" role="menu" aria-label="More">
          <Link role="menuitem" href="/admin#notices" onClick={m.close}>Notices</Link>
          <Link role="menuitem" href="/admin#feedback" onClick={m.close}>Feedback</Link>
          <Link role="menuitem" href="/admin#content" onClick={m.close}>Content</Link>
          <hr />
          <form action={signOut}><button role="menuitem">Sign out</button></form>
        </div>
      </>}
    </>
  );
}

/** Phones: the ⋯ in the black top bar (Figma B6) for the Students tools. */
export function AdminTopMenu() {
  const m = useMenu("top");
  return (
    <>
      <button type="button" className="ad-topMore" aria-expanded={m.open} aria-controls="ad-top" aria-label="More actions" onClick={m.toggle}>
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.8" fill="currentColor" /><circle cx="12" cy="12" r="1.8" fill="currentColor" /><circle cx="19" cy="12" r="1.8" fill="currentColor" /></svg>
      </button>
      {m.open && <>
        <Scrim onClose={m.close} />
        <div id="ad-top" className="ad-pop ad-popDown" role="menu" aria-label="More actions">
          <Link role="menuitem" href="/admin/bulk" onClick={m.close}>Bulk register (CSV)</Link>
          <a role="menuitem" href="/admin/students/export" download onClick={m.close}>Export student list (CSV)</a>
        </div>
      </>}
    </>
  );
}
