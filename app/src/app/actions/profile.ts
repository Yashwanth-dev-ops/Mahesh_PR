"use server";

import { revalidatePath } from "next/cache";
import { normPhone, phoneError } from "@/components/auth/rules";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { removePhoto, savePhoto } from "@/server/photo";

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

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Profile → Change photo: the cropped photo from the editor (the server still shrinks it to a 512 px WebP). */
export async function updatePhoto(form: FormData) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Your session ended. Sign in again." };
  const photo = form.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return { ok: false, message: "Choose a photo first." };
  if (!PHOTO_TYPES.includes(photo.type)) return { ok: false, message: "Use a JPG, PNG or WebP image." };
  if (photo.size > 2 * 1024 * 1024) return { ok: false, message: "That photo is over 2 MB." };
  await savePhoto(user.id, photo);
  revalidatePath("/", "layout");
  return { ok: true, message: "Photo saved." };
}

/** Profile → Delete photo. */
export async function deletePhoto() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Your session ended. Sign in again." };
  await removePhoto(user.id);
  revalidatePath("/", "layout");
  return { ok: true, message: "Photo deleted." };
}
