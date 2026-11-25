import { Suspense } from "react";
import { signOut } from "@/app/actions/auth";
import { AdminNav } from "@/components/admin/AdminNav";
import { APP_NAME } from "@/lib/site";
import "@/components/admin/admin.css";

// Shared shell for every admin page (Figma A9 / B1-B5): black sidebar, warm-white main. The proxy limits /admin to admins.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ad-shell">
      <nav className="ad-side" aria-label="Admin">
        <p className="ad-brand"><span className="ad-mark" aria-hidden="true">{APP_NAME[0]}</span><span>{APP_NAME}<span className="ad-tag">ADMIN</span></span></p>
        {/* AdminNav reads the URL (current page); Suspense keeps the rest prerenderable. */}
        <Suspense fallback={<ul />}><AdminNav /></Suspense>
        <form action={signOut}><button className="ad-sideOut">Sign out</button></form>
      </nav>
      <main className="ad-main">{children}</main>
    </div>
  );
}
