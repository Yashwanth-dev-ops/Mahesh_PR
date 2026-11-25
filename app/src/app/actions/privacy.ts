"use server";

import { redirect } from "next/navigation";
import { PRIVACY_VERSION } from "@/lib/site";
import { normPhone, phoneError } from "@/components/auth/rules";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { eraseAccount } from "@/server/accounts";

/** DPDP Act: an existing account agrees to the current privacy notice (shown once at /consent). */
export async function acceptPrivacy(form: FormData) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (form.get("consent") !== "yes") redirect("/consent?missing=1");
  const db = supabaseAdmin();
  const { data: cur } = await db.from("profiles").select("role, phone").eq("id", user.id).single();
  const update: { privacy_version: string; privacy_accepted_at: string; phone?: string } = { privacy_version: PRIVACY_VERSION, privacy_accepted_at: new Date().toISOString() };
  if (cur?.role !== "admin" && !cur?.phone) { // students made before sign-up asked for it
    const phone = normPhone(String(form.get("phone") ?? ""));
    if (phoneError(phone)) redirect("/consent?phone=bad");
    update.phone = phone;
  }
  const { data: me } = await db.from("profiles").update(update).eq("id", user.id).select("role").single();
  redirect(me?.role === "admin" ? "/admin" : "/home");
}

export type DeleteResult = { ok?: true; message?: string };

/**
 * DPDP Act right to erasure: deletes the account and everything personal, straight away.
 * Profile, progress, notes and "I know this" go with the account (ON DELETE CASCADE); feedback and the photo are
 * removed here; uploads and notices keep their content but lose the name (ON DELETE SET NULL).
 * Admins can't delete themselves here, so the library is never left without an admin.
 */
export async function deleteMyAccount(form: FormData): Promise<DeleteResult> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { message: "Your session ended. Sign in again." };
  const admin = supabaseAdmin();
  const { data: me } = await admin.from("profiles").select("roll_no, role").eq("id", user.id).maybeSingle();
  if (me?.role === "admin") return { message: "Admin accounts are removed by another admin, so the library always has one." };
  const typed = String(form.get("confirm") ?? "").trim().toUpperCase();
  if (!me || typed !== me.roll_no) return { message: "Type your roll number exactly to confirm." };

  if (!(await eraseAccount(admin, user.id, me.roll_no))) return { message: "We couldn't delete your account. Try again, or write to the contact on the privacy page." };
  await supabase.auth.signOut();
  return { ok: true };
}
