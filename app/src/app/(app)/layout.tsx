import { Suspense } from "react";
import { AppNav, AppTop } from "@/components/app/AppNav";
import "@/components/app/app.css";

// Frame for every signed-in student page. The proxy has already checked the account is active.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ap-shell">
      <a className="ap-skip" href="#main">Skip to content</a>
      <AppTop />
      {/* AppNav reads the URL (active tab); Suspense keeps the rest of the page prerenderable. */}
      <Suspense fallback={<nav className="ap-nav" aria-label="App" />}><AppNav /></Suspense>
      <main id="main" className="ap-main">{children}</main>
    </div>
  );
}
