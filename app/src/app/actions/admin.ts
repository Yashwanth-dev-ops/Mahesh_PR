"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { approvedEmail, sendMail } from "@/lib/email";
import { parseCsv } from "@/lib/csv";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ROLL } from "@/components/auth/rules";
import { requireAdmin, siteOrigin } from "@/server/admin-auth";
import { eraseAccount } from "@/server/accounts";
import { audit } from "@/server/audit";

const fail = (message: string) => ({ ok: false as const, message });

/** Emails "Your account is approved" after the response is sent; a mail failure never undoes the approval. */
async function notifyApproved(db: ReturnType<typeof supabaseAdmin>, ids: string[]) {
  if (!ids.length) return;
  const origin = await siteOrigin();
  after(async () => {
    const { data: people } = await db.from("profiles").select("id, full_name").in("id", ids);
    for (const p of people ?? []) {
      try {
        const { data } = await db.auth.admin.getUserById(p.id);
        if (!data.user?.email) continue;
        const m = approvedEmail(p.full_name.split(" ")[0], `${origin}/login`);
        await sendMail(data.user.email, m.subject, m.text, m.html);
      } catch (e) { console.error("approved email failed:", (e as Error).message); }
    }
  });
}

const who = (p: { full_name: string; roll_no: string }) => `${p.full_name} · ${p.roll_no}`;

/**
 * Change a student's access. active = approve a waiting student or give a blocked one access again; suspended =
 * reject a waiting student or block an active one (can't sign in; reversible). The reason is shown to admins only.
 */
export async function setStudentStatus(profileId: string, status: "active" | "suspended", reason?: string) {
  const auth = await requireAdmin().catch(() => null);
  if (!auth) return fail("Only admins can do this.");
  const why = (reason ?? "").trim().slice(0, 200) || null;
  const { data: before } = await auth.db.from("profiles").select("full_name, roll_no, status").eq("id", profileId).eq("role", "student").maybeSingle();
  if (!before) return fail("That student no longer exists.");
  const { error } = await auth.db.from("profiles").update({ status, status_reason: status === "suspended" ? why : null }).eq("id", profileId).eq("role", "student");
  if (error) return fail("Couldn't update. Try again.");
  const action = status === "active" ? (before.status === "pending" ? "Approved a student" : "Gave access") : (before.status === "pending" ? "Rejected a student" : "Blocked a student");
  await audit(auth.db, auth.actor, action, who(before), status === "suspended" && why ? `reason: ${why}` : before.status === "suspended" ? "was blocked" : null);
  if (status === "active") await notifyApproved(auth.db, [profileId]);
  revalidatePath("/admin", "layout");
  return { ok: true as const, message: status === "active" ? (before.status === "pending" ? "Approved" : "Access given") : (before.status === "pending" ? "Rejected" : "Blocked") };
}

/** Permanently delete a student's account and data. The admin types the roll number to confirm. */
export async function deleteStudent(profileId: string, typedRoll: string) {
  const auth = await requireAdmin().catch(() => null);
  if (!auth) return fail("Only admins can do this.");
  const { data: p } = await auth.db.from("profiles").select("full_name, roll_no").eq("id", profileId).eq("role", "student").maybeSingle();
  if (!p) return fail("That student no longer exists.");
  if (typedRoll.trim().toUpperCase() !== p.roll_no) return fail(`Type ${p.roll_no} exactly to confirm.`);
  if (!(await eraseAccount(auth.db, profileId, p.roll_no))) return fail("Couldn't delete. Try again.");
  await audit(auth.db, auth.actor, "Deleted an account", who(p), "roll number typed to confirm");
  revalidatePath("/admin", "layout");
  return { ok: true as const, message: "Deleted" };
}

export type RosterResult = { ok: boolean; message: string; imported?: number; activated?: number; errors?: string[] };

/** Upload the class list (roll_no, full_name, year, section). Re-checks pending accounts against it. */
export async function importRoster(form: FormData): Promise<RosterResult> {
  const auth = await requireAdmin().catch(() => null);
  if (!auth) return fail("Only admins can do this.");
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Choose a CSV file first.");
  if (file.size > 1024 * 1024) return fail("That file is over 1 MB. A class list should be much smaller.");
  const rows = parseCsv(await file.text());
  if (!rows.length) return fail("The file has no rows. The first line must be: roll_no,full_name,year,section");

  const errors: string[] = [], good: { roll_no: string; full_name: string; year: number | null; section: string | null; imported_by: string }[] = [];
  rows.forEach((r, i) => {
    const roll = (r.roll_no ?? r.roll ?? "").toUpperCase(), name = (r.full_name ?? r.name ?? "").replace(/\s+/g, " ").trim();
    const year = r.year ? Number(String(r.year).replace(/[^0-9]/g, "")) : null, section = (r.section ?? "").toUpperCase() || null;
    if (!ROLL.test(roll)) return errors.push(`Line ${i + 2}: roll number "${roll}" isn't 6–15 letters/digits`);
    if (name.length < 2 || name.length > 80) return errors.push(`Line ${i + 2}: missing name`);
    if (year !== null && !(year >= 1 && year <= 4)) return errors.push(`Line ${i + 2}: year must be 1–4`);
    if (section && !/^[A-Z0-9]{1,3}$/.test(section)) return errors.push(`Line ${i + 2}: section "${section}" looks wrong`);
    good.push({ roll_no: roll, full_name: name, year, section, imported_by: auth.adminId });
  });
  if (!good.length) return { ok: false, message: "No valid rows to import.", errors: errors.slice(0, 20) };
  const { error } = await auth.db.from("student_roster").upsert(good, { onConflict: "roll_no" });
  if (error) return fail("Couldn't save the list. Try again.");

  // Pending students who now match roll number + name become active.
  const { data: pending } = await auth.db.from("profiles").select("id, roll_no, full_name").eq("status", "pending").eq("role", "student");
  const approved: string[] = [];
  for (const p of pending ?? []) {
    const { data: st } = await auth.db.rpc("roster_status", { p_roll: p.roll_no, p_name: p.full_name });
    if (st === "active") { const { error: e } = await auth.db.from("profiles").update({ status: "active" }).eq("id", p.id); if (!e) approved.push(p.id); }
  }
  const activated = approved.length;
  await audit(auth.db, auth.actor, "Imported the class list", `${good.length} rows`, `${errors.length} skipped, ${activated} waiting students approved`);
  await notifyApproved(auth.db, approved);
  revalidatePath("/admin", "layout");
  return { ok: true, message: `Imported ${good.length} ${good.length === 1 ? "student" : "students"}${errors.length ? `, skipped ${errors.length} rows` : ""}. ${activated} pending ${activated === 1 ? "account was" : "accounts were"} approved.`, imported: good.length, activated, errors: errors.slice(0, 20) };
}

const CATS = ["notice", "exam", "event", "campaign", "placement"] as const;

export async function postNotice(form: FormData) {
  const auth = await requireAdmin().catch(() => null);
  if (!auth) return fail("Only admins can do this.");
  const title = String(form.get("title") ?? "").trim(), body = String(form.get("body") ?? "").trim();
  const category = String(form.get("category") ?? "notice") as (typeof CATS)[number];
  const until = String(form.get("expires") ?? "");
  if (title.length < 3 || title.length > 140) return fail("Give the notice a title (3–140 characters).");
  if (body.length > 4000) return fail("Keep the message under 4,000 characters.");
  if (!CATS.includes(category)) return fail("Choose a category.");
  const expires = until ? new Date(`${until}T23:59:59+05:30`) : null; // end of that day, India time
  if (expires && (isNaN(+expires) || expires <= new Date())) return fail("The end date must be in the future.");
  const { error } = await auth.db.from("notices").insert({ title, body, category, pinned: form.get("pinned") === "on", expires_at: expires?.toISOString() ?? null, created_by: auth.adminId });
  if (!error) await audit(auth.db, auth.actor, "Posted a notice", `“${title}”`, `category: ${category}`);
  revalidatePath("/admin", "layout"); revalidatePath("/home"); revalidatePath("/notices");
  return error ? fail("Couldn't post. Try again.") : { ok: true as const, message: "Posted. Students see it now." };
}

export async function deleteNotice(id: string) {
  const auth = await requireAdmin().catch(() => null);
  if (!auth) return fail("Only admins can do this.");
  const { data: n } = await auth.db.from("notices").select("title").eq("id", id).maybeSingle();
  const { error } = await auth.db.from("notices").delete().eq("id", id);
  if (!error && n) await audit(auth.db, auth.actor, "Deleted a notice", `“${n.title}”`);
  revalidatePath("/admin", "layout"); revalidatePath("/home"); revalidatePath("/notices");
  return error ? fail("Couldn't delete.") : { ok: true as const, message: "Deleted" };
}
