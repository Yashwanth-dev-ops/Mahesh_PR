import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { PRIVACY_VERSION } from "@/lib/site";

// Refreshes the Supabase session cookie on every page request and sends signed-out visitors away from
// private pages. Optimistic only: pages still check the user themselves (Next.js auth guide).
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPrivate = ["/home", "/subjects", "/read", "/notes", "/search", "/papers", "/profile", "/notices", "/reset-password", "/signup/complete", "/consent"].some((p) => path.startsWith(p))
    || (path.startsWith("/admin") && !path.startsWith("/admin/login"));
  if (!data.user && isPrivate) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(url);
  }
  if (!data.user) return response;

  // Signed in: send people where their account state allows. Done here, not in pages, because a page can't
  // sign anyone out (no cookie writes) and redirect() inside a streamed page trips a React dev-timing bug.
  const go = (to: string) => {
    const r = NextResponse.redirect(new URL(to, request.url));
    response.cookies.getAll().forEach((c) => r.cookies.set(c)); // keep refreshed/cleared session cookies
    return r;
  };
  const gated = path === "/login" || path === "/signup" || path.startsWith("/signup/complete")
    || ["/home", "/subjects", "/read", "/notes", "/search", "/papers", "/profile", "/notices", "/consent"].some((p) => path.startsWith(p))
    || (path.startsWith("/admin") && !path.startsWith("/admin/login"));
  if (!gated) return response;

  const { data: p } = await supabase.from("profiles").select("status, role, privacy_version").eq("id", data.user.id).maybeSingle();
  if (!p) return path.startsWith("/signup/complete") ? response : go("/signup/complete"); // Google, sign-up not finished
  if (p.status !== "active") {
    await supabase.auth.signOut(); // writes the cleared cookies onto `response` via setAll
    return go(`/account-status?s=${p.status}`);
  }
  // DPDP Act: accounts that haven't agreed to the current privacy notice see /consent once before anything else.
  const agreed = p.privacy_version === PRIVACY_VERSION;
  if (!agreed && !path.startsWith("/consent")) return go("/consent");
  if (agreed && path.startsWith("/consent")) return go("/home");
  if (path.startsWith("/admin") && p.role !== "admin") return go("/home");
  if (path === "/login" || path === "/signup" || path.startsWith("/signup/complete")) return go("/home");
  return response;
}

export const config = {
  // Not the landing page ("/", needs `.+`) or /privacy: nothing there depends on the session, so they're served straight
  // from Vercel's cache without waking a server (the first visitor after a quiet spell waited 3-4 s).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|avatars/|privacy$|.*\\.(?:png|jpg|svg|webp|ico)$).+)"],
};
