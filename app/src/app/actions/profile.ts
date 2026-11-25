"use server";

import { revalidatePath } from "next/cache";
import { normPhone, phoneError } from "@/components/auth/rules";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

/** A student corrects their own mobile number (the column isn't writable through the browser API). */
export async function updatePhone(raw: string) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Your session ended. Sign in again." };
  const phone = normPhone(raw);
  const bad = phoneError(phone);
  if (bad) return { ok: false, message: bad };
  const { error } = await supabaseAdmin().from("profiles").update({ phone }).eq("id", user.id);
  revalidatePath("/profile");
  return error ? { ok: false, message: "Couldn't save. Try again." } : { ok: true, message: "Saved." };
}
