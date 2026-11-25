"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [["/admin", "Dashboard"], ["/admin/students", "Students"], ["/admin/admins", "Admins"], ["/admin#notices", "Notices"], ["/admin#feedback", "Feedback"], ["/admin#content", "Content"], ["/admin/audit", "Audit log"]];

export function AdminNav() {
  const path = usePathname();
  const current = (h: string) => (h === "/admin" ? path === "/admin" : !h.includes("#") && path.startsWith(h));
  return (
    <ul>
      {ITEMS.map(([h, l]) => <li key={h}><Link href={h} aria-current={current(h) ? "page" : undefined}>{l}</Link></li>)}
    </ul>
  );
}
