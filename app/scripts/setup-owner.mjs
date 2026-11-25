// Makes the app's Gmail (SMTP_USER) the one main admin and emails it a link to choose a password.
//   node --env-file=.env.local scripts/setup-owner.mjs https://your-site.example   [--name "Main admin"]
// Safe to re-run: an existing account is promoted, not duplicated, and a fresh link is sent.
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { randomUUID } from "node:crypto";

const [origin, ...rest] = process.argv.slice(2);
if (!/^https?:\/\//.test(origin ?? "")) { console.error("Usage: setup-owner.mjs <site origin, e.g. https://example.vercel.app> [--name \"Main admin\"]"); process.exit(1); }
const name = rest.includes("--name") ? rest[rest.indexOf("--name") + 1] : "Main admin";
const email = process.env.SMTP_USER?.toLowerCase();
if (!email) throw new Error("SMTP_USER is not set in .env.local");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

let user = null;
for (let page = 1; !user; page++) {
  const { data } = await db.auth.admin.listUsers({ page, perPage: 1000 });
  user = data.users.find((u) => u.email?.toLowerCase() === email) ?? null;
  if (data.users.length < 1000) break;
}
if (!user) {
  const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true, password: randomUUID() + randomUUID(), user_metadata: { full_name: name } });
  if (error) throw error;
  user = data.user;
}
const { data: prof } = await db.from("profiles").select("id").eq("id", user.id).maybeSingle();
await db.from("profiles").update({ is_owner: false }).eq("is_owner", true).neq("id", user.id); // only one main admin
const row = { full_name: name, role: "admin", status: "active", is_owner: true };
const { error: pErr } = prof ? await db.from("profiles").update(row).eq("id", user.id)
  : await db.from("profiles").insert({ id: user.id, roll_no: "ADM" + randomUUID().replace(/-/g, "").slice(0, 9).toUpperCase(), ...row });
if (pErr) throw pErr;

const { data: link, error: lErr } = await db.auth.admin.generateLink({ type: "recovery", email });
if (lErr) throw lErr;
const url = `${origin.replace(/\/$/, "")}/auth/confirm?token_hash=${link.properties.hashed_token}&type=recovery&next=${encodeURIComponent("/admin/setup")}`;
const mail = nodemailer.createTransport({ host: process.env.SMTP_HOST || "smtp.gmail.com", port: Number(process.env.SMTP_PORT || 465), secure: true, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
await mail.sendMail({ from: { name: "StudyDashBoard", address: process.env.SMTP_USER }, to: email, subject: "Set your StudyDashBoard main admin password",
  text: `You're the main admin of StudyDashBoard. Choose your password here (works once, for 24 hours):\n${url}\n\nThen sign in at ${origin.replace(/\/$/, "")}/admin/login with this email.` });
await db.from("admin_audit").insert({ admin_id: user.id, admin_label: name, action: "Became the main admin", target: email, details: "set up by the owner script" });
console.log(`Main admin: ${email} (${name}). A set-password link was emailed to it; it works once, for 24 hours.`);
