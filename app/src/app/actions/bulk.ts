"use server";

import { revalidatePath } from "next/cache";
import { normPhone, phoneError, ROLL } from "@/components/auth/rules";
import { parseCsv } from "@/lib/csv";
import { sendMail, welcomeEmail } from "@/lib/email";
import { setPasswordLink } from "@/server/accounts";
import { requireAdmin, siteOrigin } from "@/server/admin-auth";
import { audit } from "@/server/audit";

// Bulk registration (Figma B4): the admin uploads the class CSV; each student gets an account and an email to
// choose their own password. Gmail allows ~500 emails a day, so these go out at most 60 an hour.
const PER_HOUR = 60, PER_CALL = 15; // one call stays well inside a server function's time limit
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const fail = (message: string) => ({ ok: false as const, message });

export type BulkResult = { ok: boolean; message: string; read?: number; created?: number; skipped?: string[] };
export type SendResult = { ok: boolean; message: string; sent: number; waiting: number; nextAt?: string };

export async function bulkRegister(csv: string): Promise<BulkResult> {
  const a = await requireAdmin().catch(() => null);
  if (!a) return fail("Only admins can do this.");
  if (csv.length > 300_000) return fail("That file is too big for one class. Split it and upload each part.");
  const rows = parseCsv(csv);
  if (!rows.length) return fail("The file has no rows. The first line must be: roll_no,full_name,year,section,email,phone");
  if (rows.length > 500) return fail("Up to 500 students per upload.");

  // Who already has an account, by roll number or by email (never changed by an upload).
  const { data: have } = await a.db.from("profiles").select("roll_no");
  const rollsTaken = new Set((have ?? []).map((p) => p.roll_no));
  const emailsTaken = new Set<string>();
  for (let page = 1; ; page++) {
    const { data } = await a.db.auth.admin.listUsers({ page, perPage: 1000 });
    for (const u of data?.users ?? []) if (u.email) emailsTaken.add(u.email.toLowerCase());
    if (!data || data.users.length < 1000) break;
  }

  const skipped: string[] = [], seen = new Set<string>();
  const good: { roll: string; name: string; year: number; section: string; email: string; phone: string }[] = [];
  rows.forEach((r, i) => {
    const line = `Row ${i + 2}`;
    const roll = (r.roll_no ?? r.roll ?? "").toUpperCase(), name = (r.full_name ?? r.name ?? "").replace(/\s+/g, " ").trim();
    const year = Number(String(r.year ?? "").replace(/[^0-9]/g, "")), section = (r.section ?? "").toUpperCase();
    const email = (r.email ?? "").trim().toLowerCase(), phone = normPhone(r.phone ?? r.mobile ?? "");
    if (!ROLL.test(roll)) return skipped.push(`${line} · roll number "${roll}" isn't 6–15 letters/digits`);
    if (seen.has(roll)) return skipped.push(`${line} · ${roll} is in the file twice`);
    if (rollsTaken.has(roll)) return skipped.push(`${line} · ${roll} already has an account`);
    if (name.length < 2 || name.length > 80) return skipped.push(`${line} · ${roll}: missing name`);
    if (!(year >= 1 && year <= 4)) return skipped.push(`${line} · ${roll}: year must be 1–4`);
    if (!/^[A-Z0-9]{1,3}$/.test(section)) return skipped.push(`${line} · ${roll}: section "${section}" looks wrong`);
    if (!EMAIL.test(email)) return skipped.push(`${line} · ${roll}: email "${email}" looks wrong`);
    if (emailsTaken.has(email)) return skipped.push(`${line} · ${roll}: ${email} already has an account`);
    if (phoneError(phone)) return skipped.push(`${line} · ${roll}: phone "${r.phone ?? ""}" is not a 10-digit mobile`);
    seen.add(roll); emailsTaken.add(email);
    good.push({ roll, name, year, section, email, phone });
  });

  // On the class list first, so the sign-up trigger makes each account active straight away.
  if (good.length) {
    const { error } = await a.db.from("student_roster").upsert(good.map((g) => ({ roll_no: g.roll, full_name: g.name, year: g.year, section: g.section, imported_by: a.adminId })), { onConflict: "roll_no" });
    if (error) return fail("Couldn't save the class list. Try again.");
  }
  let created = 0;
  for (const g of good) {
    const { data, error } = await a.db.auth.admin.createUser({
      email: g.email, email_confirm: true, password: crypto.randomUUID() + crypto.randomUUID(), // replaced by the student's own
      user_metadata: { full_name: g.name, roll_no: g.roll, year: String(g.year), section: g.section, phone: g.phone },
    });
    if (error || !data.user) { skipped.push(`${g.roll}: couldn't create the account (${error?.message ?? "unknown error"})`); continue; }
    await a.db.from("welcome_emails").insert({ user_id: data.user.id });
    created++;
  }
  await audit(a.db, a.actor, "Bulk registration", `class CSV · ${rows.length} rows`, `${created} created, ${skipped.length} skipped`);
  revalidatePath("/admin", "layout");
  return { ok: true, message: `${created} ${created === 1 ? "account" : "accounts"} created.`, read: rows.length, created, skipped: skipped.slice(0, 50) };
}

/** Sends the next waiting set-password emails, inside the hourly limit. The page calls it until nothing is left. */
export async function sendWelcomeEmails(): Promise<SendResult> {
  const a = await requireAdmin().catch(() => null);
  if (!a) return { ok: false, message: "Only admins can do this.", sent: 0, waiting: 0 };
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { data: recent } = await a.db.from("welcome_emails").select("sent_at").gt("sent_at", hourAgo).order("sent_at");
  const room = Math.max(0, PER_HOUR - (recent?.length ?? 0));
  const { data: queue } = await a.db.from("welcome_emails").select("user_id").is("sent_at", null).order("created_at").limit(Math.min(room, PER_CALL));
  const origin = await siteOrigin();
  let sent = 0;
  for (const q of queue ?? []) {
    const { data: u } = await a.db.auth.admin.getUserById(q.user_id);
    const email = u.user?.email, first = String(u.user?.user_metadata?.full_name ?? "").split(" ")[0] || "there";
    const link = email ? await setPasswordLink(a.db, email, origin, "/reset-password") : null;
    if (!email || !link) continue;
    const m = welcomeEmail(first, link);
    const ok = await sendMail(email, m.subject, m.text, m.html).catch((e) => { console.error("welcome email failed:", e.message); return false; });
    if (!ok) break; // Gmail refused (limit or outage): stop and let the admin try later
    await a.db.from("welcome_emails").update({ sent_at: new Date().toISOString() }).eq("user_id", q.user_id);
    sent++;
  }
  const { count } = await a.db.from("welcome_emails").select("user_id", { count: "exact", head: true }).is("sent_at", null);
  const waiting = count ?? 0;
  // When the oldest send in the last hour drops out of the window, room opens again.
  const full = room - sent <= 0 && waiting > 0;
  const oldest = recent?.[0]?.sent_at;
  const nextAt = full && oldest ? new Date(+new Date(oldest) + 3600_000).toISOString() : undefined;
  if (sent) await audit(a.db, a.actor, "Sent set-password emails", `${sent} ${sent === 1 ? "student" : "students"}`, waiting ? `${waiting} still waiting` : "all sent");
  return { ok: true, message: sent ? `${sent} sent.` : waiting ? "Waiting for the hourly limit." : "All sent.", sent, waiting, nextAt };
}
