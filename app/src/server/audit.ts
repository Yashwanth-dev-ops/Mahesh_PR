import "server-only";
import type { supabaseAdmin } from "@/lib/supabase/admin";

type Db = ReturnType<typeof supabaseAdmin>;
export type Actor = { id: string | null; label: string };

/** Append one line to the admin audit log. Never throws: a logging hiccup must not undo the action itself. */
export async function audit(db: Db, actor: Actor, action: string, target?: string | null, details?: string | null) {
  const { error } = await db.from("admin_audit").insert({ admin_id: actor.id, admin_label: actor.label, action, target: target ?? null, details: details ?? null });
  if (error) console.error("audit write failed:", action, error.message);
}
