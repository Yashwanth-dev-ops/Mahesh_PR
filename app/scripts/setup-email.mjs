// Connect the app's Gmail to Supabase and check it works. Run once after adding SMTP_USER and SMTP_PASS to .env.local.
//
//   npm run setup-email              point Supabase's password-reset email at the Gmail, branded template, 60 emails/hour
//   npm run setup-email -- --test    also send a test "account approved" email to the Gmail address itself
//
// Changes only these Supabase Auth settings (Management API): SMTP host/port/user/password/sender, the recovery
// email subject + template (supabase/templates/recovery.html), and the email rate limit. Prints no secrets.
// Uses the Supabase CLI login (~/.supabase/access-token) or SUPABASE_ACCESS_TOKEN.
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import nodemailer from "nodemailer";

const { SMTP_USER: user, SMTP_PASS: pass } = process.env;
const host = process.env.SMTP_HOST || "smtp.gmail.com", port = Number(process.env.SMTP_PORT || 465);
const APP = "StudyDashBoard";
const tokenFile = `${homedir()}/.supabase/access-token`;
const token = process.env.SUPABASE_ACCESS_TOKEN || (existsSync(tokenFile) && readFileSync(tokenFile, "utf8").trim());
const ref = existsSync("supabase/.temp/project-ref") && readFileSync("supabase/.temp/project-ref", "utf8").trim();

function stop(msg) { console.error(msg); process.exit(1); }
if (!user || !pass) stop("Add SMTP_USER (the Gmail address) and SMTP_PASS (its app password) to .env.local first.");
if (!token || !ref) stop("Supabase CLI isn't logged in / linked: run `npx supabase login` and `npx supabase link` once.");

// 1. Can we log in to Gmail with these details? (No email is sent by verify.)
const mail = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
await mail.verify().catch((e) => stop(`Gmail refused the login (${e.responseCode ?? e.code}). Check the app password and that 2-step verification is on.`));
console.log("Gmail login: ok");

// 2. Point Supabase Auth's emails at it.
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    smtp_host: host, smtp_port: String(port), smtp_user: user, smtp_pass: pass, smtp_admin_email: user, smtp_sender_name: APP,
    rate_limit_email_sent: 60,
    mailer_subjects_recovery: `Reset your ${APP} password`,
    mailer_templates_recovery_content: readFileSync("supabase/templates/recovery.html", "utf8"),
  }),
});
if (!res.ok) stop(`Supabase didn't accept the settings (${res.status}): ${(await res.text()).slice(0, 300)}`);
console.log("Supabase: password-reset email now goes through the Gmail, branded template, up to 60 emails/hour");

// 3. Optional: a real test email to the Gmail itself.
if (process.argv.includes("--test")) {
  await mail.sendMail({ from: { name: APP, address: user }, to: user, subject: `Test: your ${APP} account is approved`, text: "If you can read this, the app can send email." });
  console.log(`Test email sent to ${user.replace(/(.{2}).*(@.*)/, "$1…$2")}: check that inbox (and Spam).`);
}
