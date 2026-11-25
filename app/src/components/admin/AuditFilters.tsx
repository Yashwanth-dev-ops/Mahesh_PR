"use client";

import { useRef } from "react";

/** Audit filters apply the moment a choice changes (no Apply step); the search applies on Enter. */
export function AuditFilters({ children }: { children: React.ReactNode }) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} className="ad-filters" method="get" onChange={(e) => { if ((e.target as HTMLElement).tagName === "SELECT") form.current?.requestSubmit(); }}>
      {children}
    </form>
  );
}
