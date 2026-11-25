import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { APP_NAME } from "@/lib/site";

/*
 * Emails the app sends itself (Supabase sends its own reset email through the same Gmail; see scripts/setup-email.mjs).
 * Settings in .env.local: SMTP_USER (the app's Gmail address), SMTP_PASS (its 16-character app password),
 * optional SMTP_HOST / SMTP_PORT (default Gmail, 465). Without them nothing is sent and a warning is logged.
 */
const host = process.env.SMTP_HOST || "smtp.gmail.com";
const port = Number(process.env.SMTP_PORT || 465);
let transport: Transporter | null = null;

export async function sendMail(to: string, subject: string, text: string, html: string) {
  const { SMTP_USER: user, SMTP_PASS: pass } = process.env;
  if (!user || !pass) { console.warn(`email not sent ("${subject}"): SMTP_USER / SMTP_PASS not set`); return false; }
  transport ??= nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
  await transport.sendMail({ from: { name: APP_NAME, address: user }, to, subject, text, html });
  return true;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** The black/yellow email frame shared with the Supabase reset template (supabase/templates/recovery.html). */
export function emailFrame(title: string, body: string, button: { label: string; url: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f5f3ef;font-family:Arial,Helvetica,sans-serif;color:#08090b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #dedad2;border-radius:16px">
<tr><td style="background:#08090b;border-radius:16px 16px 0 0;padding:20px 24px;color:#f5f3ef;font-weight:bold;font-size:16px">
<span style="display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;background:#ffc900;color:#08090b;border-radius:6px;margin-right:10px">${APP_NAME[0]}</span>${esc(APP_NAME)}</td></tr>
<tr><td style="padding:28px 24px 8px"><h1 style="margin:0 0 12px;font-size:24px;line-height:1.2">${esc(title)}</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:1.55;color:#5a5750">${body}</p>
<a href="${esc(button.url)}" style="display:inline-block;background:#ffc900;color:#08090b;text-decoration:none;font-weight:bold;font-size:16px;padding:14px 24px;border-radius:999px">${esc(button.label)}</a></td></tr>
<tr><td style="padding:24px;font-size:13px;line-height:1.5;color:#5a5750">You get this because you have an account on ${esc(APP_NAME)}. If it wasn't you, ignore this email.</td></tr>
</table></td></tr></table></body></html>`;
}

/** "Your account is approved": sent when an admin approves a pending student. */
export function approvedEmail(firstName: string, loginUrl: string) {
  const subject = `Your ${APP_NAME} account is approved`;
  const text = `Hi ${firstName},\n\nAn admin approved your account. You can sign in now with your roll number and password:\n${loginUrl}\n\n${APP_NAME}`;
  const html = emailFrame("You're in", `Hi ${esc(firstName)}, an admin approved your account. Sign in with your roll number and password.`, { label: "Sign in", url: loginUrl });
  return { subject, text, html };
}
