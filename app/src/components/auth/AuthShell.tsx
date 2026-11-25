import Link from "next/link";
import type { ReactNode } from "react";
import { APP_NAME } from "@/lib/site";
import { AuthHead } from "./AuthHead";
import "./auth.css";

/**
 * Shared frame for every sign-in page (Figma "Login redesign", 2026-11-25).
 * One simple centred column; on laptops the logo and Privacy sit in the top corners. Phone: logo on top.
 * Sized so no page scrolls at 1366×607, 1440×900, 390×664 or 360×640.
 */
export function AuthShell({ id, kicker, title, lead, children }: { id: string; kicker?: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <div className="au-page">
      <div className="au-side">
        <header className="au-top">
          <Link href="/" className="au-home">
            <span className="au-mark" aria-hidden="true">{APP_NAME[0]}</span>
            {APP_NAME}
          </Link>
          <Link href="/privacy" className="au-privacy">Privacy</Link>
        </header>
        <main className="au-main">
          <section className="au-panel" aria-labelledby={id}>
            <AuthHead id={id} kicker={kicker} title={title} lead={lead} />
            {children}
          </section>
        </main>
      </div>
    </div>
  );
}
