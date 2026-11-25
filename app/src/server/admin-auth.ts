import "server-only";
import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import type { Actor } from "./audit";

/** Every admin action starts here: the caller must be a signed-in, active admin. Throws otherwise.
 *  Lives outside the "use server" files so it can never be called from the browser. */
export async function requireAdmin() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not signed in");
  const { data: p } = await supabase.from("profiles").select("role, status, full_name, is_owner").eq("id", user.id).maybeSingle();
  if (p?.role !== "admin" || p.status !== "active") throw new Error("not an admin");
  const actor: Actor = { id: user.id, label: p.full_name };
  return { adminId: user.id, db: supabaseAdmin(), actor, isOwner: p.is_owner as boolean, email: user.email ?? "" };
}

/** This site's origin for links in emails (the request's own origin; NEXT_PUBLIC_SITE_URL as a fallback). */
export async function siteOrigin() {
  const h = await headers();
  return h.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? `https://${h.get("host")}`;
}
