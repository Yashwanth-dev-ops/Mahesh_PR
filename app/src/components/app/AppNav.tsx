"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { APP_NAME } from "@/lib/site";
import { Icon, Svg } from "./bits";

// Figma "Pilot v2": bottom tabs on phones (Home, Subjects, Papers, Notes, Profile), Search in the top bar.
const LINKS = [
  { href: "/home", label: "Home", icon: Icon.home },
  { href: "/subjects", label: "Subjects", icon: Icon.subjects },
  { href: "/papers", label: "Papers", icon: Icon.file },
  { href: "/notes", label: "Notes", icon: Icon.notes },
  { href: "/profile", label: "Profile", icon: Icon.user },
];

const isOn = (path: string, href: string) =>
  path === href || path.startsWith(href + "/") || (href === "/subjects" && path.startsWith("/read"));

export function AppTop() {
  return (
    <header className="ap-top">
      <Link href="/home" className="ap-brand"><span className="ap-mark" aria-hidden="true">A</span><span>{APP_NAME}</span></Link>
      <span className="ap-topIcons">
        <Link href="/search" className="ap-iconLink" aria-label="Search"><Svg d={Icon.search} /></Link>
        <Link href="/notices" className="ap-iconLink" aria-label="Notices"><Svg d={Icon.bell} /></Link>
      </span>
    </header>
  );
}

/** Side bar on desktop, bottom tab bar on phones. */
export function AppNav() {
  const path = usePathname();
  return (
    <nav className="ap-nav" aria-label="App">
      <Link href="/home" className="ap-brand ap-brandSide"><span className="ap-mark" aria-hidden="true">A</span><span>{APP_NAME}</span></Link>
      <ul>
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="ap-link" aria-current={isOn(path, l.href) ? "page" : undefined}>
              <Svg d={l.icon} /><span>{l.label}</span>
            </Link>
          </li>
        ))}
        <li className="ap-sideOnly">
          <Link href="/notices" className="ap-link" aria-current={isOn(path, "/notices") ? "page" : undefined}><Svg d={Icon.bell} /><span>Notices</span></Link>
        </li>
        <li className="ap-sideOnly">
          <Link href="/search" className="ap-link" aria-current={isOn(path, "/search") ? "page" : undefined}><Svg d={Icon.search} /><span>Search</span></Link>
        </li>
      </ul>
      <form action={signOut} className="ap-outForm">
        <button className="ap-link ap-out"><Svg d={Icon.out} /><span>Sign out</span></button>
      </form>
    </nav>
  );
}
