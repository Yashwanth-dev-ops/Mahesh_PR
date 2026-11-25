import "server-only";
import type { supabaseAdmin } from "@/lib/supabase/admin";

type Db = ReturnType<typeof supabaseAdmin>;

/**
 * Deletes an account and everything personal, straight away (DPDP right to erasure; also an admin's "Delete account").
 * Profile, progress, notes and "I know this" go with the account (ON DELETE CASCADE); feedback and the photo are
 * removed here; uploads and notices keep their content but lose the name (ON DELETE SET NULL).
 */
export async function eraseAccount(db: Db, userId: string, rollNo: string | null) {
  await db.from("feedback").delete().eq("user_id", userId);
  const { data: files } = await db.storage.from("avatars").list(userId);
  if (files?.length) await db.storage.from("avatars").remove(files.map((f) => `${userId}/${f.name}`));
  if (rollNo) await db.from("rate_events").delete().like("key", `%:${rollNo}`);
  const { error } = await db.auth.admin.deleteUser(userId);
  return !error;
}

/** A one-time "set your password" link for an account the server made (bulk registration, admin invite).
 *  Lands on /auth/confirm, which signs them in and sends them to `next`. Valid for the project's OTP expiry (24 h). */
export async function setPasswordLink(db: Db, email: string, origin: string, next: string) {
  const { data, error } = await db.auth.admin.generateLink({ type: "recovery", email });
  if (error || !data.properties?.hashed_token) return null;
  return `${origin}/auth/confirm?token_hash=${data.properties.hashed_token}&type=recovery&next=${encodeURIComponent(next)}`;
}

/** Admin accounts have no roll number, but the column is required and unique: give them an internal one. */
export const adminRoll = () => "ADM" + crypto.randomUUID().replace(/-/g, "").slice(0, 9).toUpperCase();
