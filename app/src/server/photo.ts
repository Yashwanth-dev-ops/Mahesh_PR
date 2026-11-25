import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

// A phone photo (2–4 MB) becomes a 512 px WebP of about 30–60 KB: it's only ever shown small, on the library card.
export async function shrinkPhoto(photo: File): Promise<{ body: Blob | Buffer; ext: string; type: string }> {
  try {
    const sharp = (await import("sharp")).default;
    const body = await sharp(Buffer.from(await photo.arrayBuffer())).rotate().resize(512, 512, { fit: "cover" }).webp({ quality: 80 }).toBuffer();
    return { body, ext: "webp", type: "image/webp" };
  } catch {
    return { body: photo, ext: photo.type.split("/")[1], type: photo.type }; // unreadable image: keep it as sent (already checked ≤ 2 MB)
  }
}

export async function savePhoto(userId: string, photo: File) {
  const admin = supabaseAdmin();
  const { body, ext, type } = await shrinkPhoto(photo);
  const path = `${userId}/avatar.${ext}`;
  const up = await admin.storage.from("avatars").upload(path, body, { contentType: type, upsert: true });
  if (up.error) return;
  await admin.from("profiles").update({ avatar_path: path }).eq("id", userId);
  await admin.storage.from("avatars").remove(["jpeg", "png", "webp"].filter((e) => e !== ext).map((e) => `${userId}/avatar.${e}`)); // old copies
}

/** Removes the student's photo (Profile → Delete photo). */
export async function removePhoto(userId: string) {
  const admin = supabaseAdmin();
  await admin.storage.from("avatars").remove(["jpeg", "png", "webp"].map((e) => `${userId}/avatar.${e}`));
  await admin.from("profiles").update({ avatar_path: null }).eq("id", userId);
}
