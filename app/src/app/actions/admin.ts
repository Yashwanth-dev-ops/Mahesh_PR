"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
import { approvedEmail, sendMail } from "@/lib/email";
import { parseCsv } from "@/lib/csv";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { ROLL } from "@/components/auth/rules";

/** Every admin action starts here: the caller must be a signed-in, active admin. */
async function requireAdmin() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not signed in");
  const { data: p } = await supabase.from("profiles").select("role, status").eq("id", user.id).maybeSingle();
  if (p?.role !== "admin" || p.status !== "active") throw new Error("not an admin");
  return { adminId: user.id, db: supabaseAdmin() };
}
const fail = (message: string) => ({ ok: false as const, message });

/** Emails "Your account is approved" after the response is sent; a mail failure never undoes the approval. */
async function notifyApproved(db: ReturnType<typeof supabaseAdmin>, ids: string[]) {
  if (!ids.length) return;
  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
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

/** Approve (active) or reject (suspended, can't sign in; reversible) a pending student. */
export async function setStudentStatus(profileId: string, status: "active" | "suspended") {
  const { db } = await requireAdmin().catch(() => ({ db: null }));
  if (!db) return fail("Only admins can do this.");
  const { error } = await db.from("profiles").update({ status }).eq("id", profileId).eq("role", "student");
  if (!error && status === "active") await notifyApproved(db, [profileId]);
  revalidatePath("/admin");
  return error ? fail("Couldn't update. Try again.") : { ok: true as const, message: status === "active" ? "Approved" : "Rejected" };
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
  await notifyApproved(auth.db, approved);
  revalidatePath("/admin");
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
  revalidatePath("/admin"); revalidatePath("/home"); revalidatePath("/notices");
  return error ? fail("Couldn't post. Try again.") : { ok: true as const, message: "Posted. Students see it now." };
}

export async function deleteNotice(id: string) {
  const auth = await requireAdmin().catch(() => null);
  if (!auth) return fail("Only admins can do this.");
  const { error } = await auth.db.from("notices").delete().eq("id", id);
  revalidatePath("/admin"); revalidatePath("/home"); revalidatePath("/notices");
  return error ? fail("Couldn't delete.") : { ok: true as const, message: "Deleted" };
}
