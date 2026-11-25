"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { readSignup, rollError, validateSignup, hasErrors, type SignupErrors } from "@/components/auth/rules";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { PRIVACY_VERSION } from "@/lib/site";

export type SignupResult = { errors?: SignupErrors; message?: string; ok?: true; status?: "active" | "pending" };
export type LoginResult = { errors?: { roll?: string; password?: string }; message?: string; ok?: true; to?: string; name?: string; roll?: string };
export type FormResult = { errors?: Record<string, string | undefined>; message?: string; ok?: true };

const WRONG = "Roll number or password is wrong.";
const STATUS_MESSAGE = {
  pending: "Your account is waiting for an admin to approve it.",
  suspended: "This account is suspended. Contact the library admin.",
};

const siteOrigin = async () => (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";

// Rate limits (SECURITY.md, migration 20261125000001). Counted in Postgres per roll number, because sign-in runs
// here on the server and Supabase's own per-IP limit would see one address for everybody.
const LIMITS = {
  login: { max: 5, minutes: 15 },   // wrong passwords per roll number
  reset: { max: 3, minutes: 60 },   // reset emails per roll number
  signup: { max: 60, minutes: 60 }, // sign-ups per network: generous, a whole class may sign up on one college Wi-Fi
};
const tooMany = (seconds: number) => {
  const m = Math.ceil(seconds / 60);
  return `Too many tries. Try again in ${m} ${m === 1 ? "minute" : "minutes"}.`;
};
/** Records one attempt. Returns the message to show when over the limit, else null. */
async function overLimit(kind: keyof typeof LIMITS, id: string) {
  const { max, minutes } = LIMITS[kind];
  const { data, error } = await supabaseAdmin().rpc("rate_hit", { p_key: `${kind}:${id}`, p_limit: max, p_window_seconds: minutes * 60 });
  // If the counter itself fails, let the attempt through: the sign-in check behind it still protects the account.
  return !error && typeof data === "number" && data > 0 ? tooMany(data) : null;
}
const clientIp = async () => (await headers()).get("x-forwarded-for")?.split(",")[0].trim() || "unknown";

// A phone photo (2–4 MB) becomes a 512 px WebP of about 30–60 KB: it's only ever shown small, on the library card.
async function shrinkPhoto(photo: File): Promise<{ body: Blob | Buffer; ext: string; type: string }> {
  try {
    const sharp = (await import("sharp")).default;
    const body = await sharp(Buffer.from(await photo.arrayBuffer())).rotate().resize(512, 512, { fit: "cover" }).webp({ quality: 80 }).toBuffer();
    return { body, ext: "webp", type: "image/webp" };
  } catch {
    return { body: photo, ext: photo.type.split("/")[1], type: photo.type }; // unreadable image: keep it as sent (already checked ≤ 2 MB)
  }
}

async function savePhoto(userId: string, photo: File) {
  const admin = supabaseAdmin();
  const { body, ext, type } = await shrinkPhoto(photo);
  const path = `${userId}/avatar.${ext}`;
  const up = await admin.storage.from("avatars").upload(path, body, { contentType: type, upsert: true });
  if (up.error) return;
  await admin.from("profiles").update({ avatar_path: path }).eq("id", userId);
  await admin.storage.from("avatars").remove(["jpeg", "png", "webp"].filter((e) => e !== ext).map((e) => `${userId}/avatar.${e}`)); // old copies
}

/** API.md signUpStudent: roster roll → active (after email confirm), otherwise pending admin approval. */
export async function signUpStudent(form: FormData): Promise<SignupResult> {
  const s = readSignup(form);
  const errors = validateSignup(s);
  if (hasErrors(errors)) return { errors };
  const limited = await overLimit("signup", await clientIp());
  if (limited) return { message: limited };

  const admin = supabaseAdmin();
  const { data: taken } = await admin.from("profiles").select("id").eq("roll_no", s.roll).maybeSingle();
  if (taken) return { errors: { roll: "This roll number already has an account. Forgot password?" } };

  const origin = await siteOrigin();
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email: s.email,
    password: s.password,
    options: {
      emailRedirectTo: `${origin}/auth/confirm`,
      data: { full_name: s.fullName, roll_no: s.roll, year: String(s.year), section: s.section },
    },
  });
  if (error) {
    if (/database error/i.test(error.message)) return { errors: { roll: "This roll number already has an account. Forgot password?" } };
    if (/password/i.test(error.message)) return { errors: { password: error.message } };
    return { message: "We couldn't create your account. Try again in a minute." };
  }
  const user = data.user;
  // With email confirmation on, an existing email comes back as a user with no identities and nothing is created.
  if (!user || user.identities?.length === 0) return { errors: { email: "This email already has an account. Log in instead." } };

  // Stored with the admin client so it works whether or not sign-up returned a session.
  await savePhoto(user.id, s.photo!);
  await admin.from("profiles").update({ privacy_version: PRIVACY_VERSION, privacy_accepted_at: new Date().toISOString() }).eq("id", user.id);

  const { data: profile } = await admin.from("profiles").select("status").eq("id", user.id).single();
  const status = profile?.status === "active" ? "active" : "pending";
  // Email confirmation is off (see migration 0002), so sign-up returns a session: keep it only if active.
  if (status === "pending" && data.session) await supabase.auth.signOut();
  return { ok: true, status };
}

/** API.md signIn / adminSignIn: roll number + password. Same error for unknown roll and wrong password.
 *  A hidden `as=admin` field (admin login page) also requires role = admin. */
export async function signIn(form: FormData): Promise<LoginResult> {
  const asAdmin = form.get("as") === "admin";
  const roll = String(form.get("roll") ?? "").trim().toUpperCase();
  const password = String(form.get("password") ?? "");
  const errors = { roll: rollError(roll), password: password ? undefined : "Enter your password." };
  if (hasErrors(errors)) return { errors };

  // Counted before the lookup, so unknown roll numbers are limited exactly like real ones.
  const limited = await overLimit("login", roll);
  if (limited) return { message: limited };
  const { data: email } = await supabaseAdmin().rpc("email_for_roll", { p_roll: roll });
  if (!email) return { message: WRONG };

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (/not confirmed/i.test(error.message)) return { message: "Confirm your email first: open the link we sent you." };
    return { message: WRONG };
  }
  await supabaseAdmin().rpc("rate_clear", { p_key: `login:${roll}` }); // right password: start the count again
  const { data: profile } = await supabase.from("profiles").select("status, role, full_name, roll_no").eq("id", data.user.id).single();
  if (profile?.status !== "active") {
    await supabase.auth.signOut();
    return { message: STATUS_MESSAGE[profile?.status === "suspended" ? "suspended" : "pending"] };
  }
  if (asAdmin && profile.role !== "admin") {
    await supabase.auth.signOut();
    return { message: "This account has no admin access." }; // UX_FLOWS Flow 2: no hint about who the admins are
  }
  return { ok: true, to: asAdmin ? "/admin" : "/home", name: profile.full_name.split(" ")[0], roll: profile.roll_no };
}

/** Forgot password: same answer whether or not the roll number exists. */
export async function requestPasswordReset(form: FormData): Promise<FormResult> {
  const roll = String(form.get("roll") ?? "").trim().toUpperCase();
  const err = rollError(roll);
  if (err) return { errors: { roll: err } };
  const limited = await overLimit("reset", roll);
  if (limited) return { message: limited };
  const { data: email } = await supabaseAdmin().rpc("email_for_roll", { p_roll: roll });
  if (email) {
    const supabase = await supabaseServer();
    // Supabase limits how often reset emails go out; a rate-limit error is hidden behind the same answer.
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${await siteOrigin()}/auth/confirm?next=/reset-password` });
  }
  return { ok: true };
}

/** Set a new password; the reset link signed the user in for this. */
export async function updatePassword(form: FormData): Promise<FormResult> {
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  const errors = {
    password: password.length < 8 ? "Use at least 8 characters." : password.length > 72 ? "Use 72 characters or fewer." : undefined,
    confirm: password && confirm !== password ? "The two passwords don't match." : undefined,
  };
  if (hasErrors(errors)) return { errors };
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { message: "This reset link has expired. Ask for a new one." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { message: /same/i.test(error.message) ? "Choose a password you haven't used here before." : "We couldn't change your password. Try again." };
  return { ok: true };
}

/** Starts Google sign-in. Returns a message instead of redirecting when Google isn't set up yet. */
export async function signInWithGoogle(): Promise<FormResult> {
  // signInWithOAuth only builds a URL; if Google is off, Supabase would show a raw JSON error page instead.
  const settings = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
  }).then((r) => r.json()).catch(() => null);
  if (!settings?.external?.google) return { message: "Google sign-in isn't switched on yet. Use your roll number for now." };
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await siteOrigin()}/auth/confirm?next=/home` },
  });
  if (error || !data.url) return { message: "Couldn't reach Google. Try again." };
  redirect(data.url);
}

/** First Google sign-in: the student adds roll number, year, section and photo once. */
export async function completeProfile(form: FormData): Promise<FormResult & { status?: "active" | "pending" }> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { message: "Your session ended. Sign in with Google again." };

  // Reuse the sign-up rules; email and password come from Google, so give them valid placeholders.
  form.set("email", user.email ?? "x@x.xx");
  form.set("password", "google-account");
  const s = readSignup(form);
  const { email: _e, password: _p, ...errors } = validateSignup(s);
  if (hasErrors(errors)) return { errors };

  const admin = supabaseAdmin();
  if ((await admin.from("profiles").select("id").eq("id", user.id).maybeSingle()).data) return { ok: true };
  const { data: taken } = await admin.from("profiles").select("id").eq("roll_no", s.roll).maybeSingle();
  if (taken) return { errors: { roll: "This roll number already has an account. Log in with it, then link Google later." } };

  const { data: status } = await admin.rpc("roster_status", { p_roll: s.roll, p_name: s.fullName });
  const { error } = await admin.from("profiles").insert({
    id: user.id, full_name: s.fullName, roll_no: s.roll, year: s.year, section: s.section, status: status ?? "pending",
    privacy_version: PRIVACY_VERSION, privacy_accepted_at: new Date().toISOString(),
  });
  if (error) return { message: "We couldn't save your profile. Try again." };
  await savePhoto(user.id, s.photo!);
  if (status !== "active") await supabase.auth.signOut();
  return { ok: true, status: status === "active" ? "active" : "pending" };
}

export async function signOut() {
  await (await supabaseServer()).auth.signOut();
  redirect("/login");
}
