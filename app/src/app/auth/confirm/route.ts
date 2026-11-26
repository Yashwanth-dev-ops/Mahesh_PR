import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// Email links (password reset) and the Google sign-in return land here.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const token_hash = q.get("token_hash");
  const type = q.get("type") as EmailOtpType | null;
  const code = q.get("code");
  const raw = q.get("next") ?? "/home";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/home"; // only same-site paths
  const go = (path: string) => NextResponse.redirect(new URL(path, request.url));

  // Mail apps open links to scan them, which would spend a one-time code before the person taps it. Set-password
  // links therefore only carry the code to the page; it's checked when they press Save (a scanner never does).
  if (token_hash && type === "recovery" && (next === "/reset-password" || next === "/admin/setup")) return go(`${next}?th=${encodeURIComponent(token_hash)}`);

  const supabase = await supabaseServer();
  const { error } = token_hash && type
    ? await supabase.auth.verifyOtp({ token_hash, type })
    : code ? await supabase.auth.exchangeCodeForSession(code) : { error: new Error("missing token") };
  if (error) return go(next === "/reset-password" ? "/forgot-password" : "/login");
  if (next === "/reset-password") return go(next);

  // Google: first visit has no profile yet; pending/suspended accounts can't stay signed in.
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("status, role").eq("id", user!.id).maybeSingle();
  if (!profile) return go("/signup/complete");
  if (profile.status !== "active") {
    await supabase.auth.signOut();
    return go(`/account-status?s=${profile.status}`);
  }
  return go(next);
}
