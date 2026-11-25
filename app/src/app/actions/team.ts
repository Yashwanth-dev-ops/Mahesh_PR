"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminInviteEmail, sendMail } from "@/lib/email";
import { PRIVACY_VERSION } from "@/lib/site";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { adminRoll, setPasswordLink } from "@/server/accounts";
import { requireAdmin, siteOrigin } from "@/server/admin-auth";
import { audit } from "@/server/audit";

// Admin team (Figma B3): one main admin invites other admins by email. Everything here is main-admin only,
// except finishing your own invitation.
const fail = (message: string) => ({ ok: false as const, message });
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const owner = async () => { const a = await requireAdmin().catch(() => null); return a?.isOwner ? a : null; };

async function sendInvite(db: ReturnType<typeof supabaseAdmin>, email: string, name: string, inviter: string) {
  const link = await setPasswordLink(db, email, await siteOrigin(), "/admin/setup");
  if (!link) return false;
  const m = adminInviteEmail(name.split(" ")[0], inviter, link);
  return sendMail(email, m.subject, m.text, m.html).catch((e) => { console.error("invite email failed:", e.message); return false; });
}

export async function inviteAdmin(form: FormData) {
  const a = await owner();
  if (!a) return fail("Only the main admin can invite admins.");
  const name = String(form.get("name") ?? "").replace(/\s+/g, " ").trim(), email = String(form.get("email") ?? "").trim().toLowerCase();
  if (name.length < 2 || name.length > 80) return fail("Enter their name.");
  if (!EMAIL.test(email) || email.length > 120) return fail("Enter an email like name@college.edu.");
  const { data: created, error } = await a.db.auth.admin.createUser({ email, email_confirm: true, password: crypto.randomUUID() + crypto.randomUUID(), user_metadata: { full_name: name } });
  if (error || !created.user) return fail(/already|registered|exists/i.test(error?.message ?? "") ? "This email already has an account." : "Couldn't create the invitation. Try again.");
  const id = created.user.id;
  const { error: pErr } = await a.db.from("profiles").insert({ id, full_name: name, roll_no: adminRoll(), role: "admin", status: "active" });
  if (pErr) { await a.db.auth.admin.deleteUser(id); return fail("Couldn't create the invitation. Try again."); }
  await a.db.from("admin_invites").insert({ user_id: id, email, full_name: name, invited_by: a.adminId });
  const sent = await sendInvite(a.db, email, name, a.actor.label);
  await audit(a.db, a.actor, "Invited an admin", email, sent ? "link valid 24 hours" : "email didn't send");
  revalidatePath("/admin/admins");
  return sent ? { ok: true as const, message: `Invitation sent to ${email}.` } : fail("Saved, but the email didn't send. Use Resend invite.");
}

export async function resendInvite(inviteId: string) {
  const a = await owner();
  if (!a) return fail("Only the main admin can do this.");
  const { data: inv } = await a.db.from("admin_invites").select("email, full_name, accepted_at").eq("id", inviteId).maybeSingle();
  if (!inv || inv.accepted_at) return fail("This invitation is no longer open.");
  const sent = await sendInvite(a.db, inv.email, inv.full_name, a.actor.label);
  await audit(a.db, a.actor, "Resent an invite", inv.email, sent ? "link valid 24 hours" : "email didn't send");
  return sent ? { ok: true as const, message: "Sent again." } : fail("The email didn't send. Try again.");
}

export async function cancelInvite(inviteId: string) {
  const a = await owner();
  if (!a) return fail("Only the main admin can do this.");
  const { data: inv } = await a.db.from("admin_invites").select("user_id, email, accepted_at").eq("id", inviteId).maybeSingle();
  if (!inv || inv.accepted_at) return fail("This invitation is no longer open.");
  await a.db.auth.admin.deleteUser(inv.user_id); // the invite row and the unused profile go with it
  await audit(a.db, a.actor, "Cancelled an invite", inv.email);
  revalidatePath("/admin/admins");
  return { ok: true as const, message: "Cancelled" };
}

export async function removeAdmin(profileId: string) {
  const a = await owner();
  if (!a) return fail("Only the main admin can remove admins.");
  if (profileId === a.adminId) return fail("The main admin can't be removed.");
  const { data: p } = await a.db.from("profiles").select("full_name, role, is_owner").eq("id", profileId).maybeSingle();
  if (!p || p.role !== "admin" || p.is_owner) return fail("That isn't an admin you can remove.");
  const { data: u } = await a.db.auth.admin.getUserById(profileId);
  const { error } = await a.db.auth.admin.deleteUser(profileId);
  if (error) return fail("Couldn't remove. Try again.");
  await audit(a.db, a.actor, "Removed an admin", `${p.full_name} · ${u.user?.email ?? ""}`);
  revalidatePath("/admin/admins");
  return { ok: true as const, message: "Removed" };
}

/** The invited person, signed in by the emailed link, sets a password and agrees to the privacy notice. */
export async function completeAdminSetup(form: FormData) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const password = String(form.get("password") ?? "");
  if (password.length < 12 || password.length > 72) redirect("/admin/setup?e=password"); // admins: 12+ characters
  if (form.get("consent") !== "yes") redirect("/admin/setup?e=consent");
  const db = supabaseAdmin();
  const { data: p } = await db.from("profiles").select("full_name, role").eq("id", user.id).maybeSingle();
  if (p?.role !== "admin") redirect("/login");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect("/admin/setup?e=password");
  await db.from("profiles").update({ privacy_version: PRIVACY_VERSION, privacy_accepted_at: new Date().toISOString() }).eq("id", user.id);
  await db.from("admin_invites").update({ accepted_at: new Date().toISOString() }).eq("user_id", user.id).is("accepted_at", null);
  await audit(db, { id: user.id, label: p.full_name }, "Accepted the admin invite", user.email ?? null);
  redirect("/admin");
}
