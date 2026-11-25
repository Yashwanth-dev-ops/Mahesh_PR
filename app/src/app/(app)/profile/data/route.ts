import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

/** "Download my data" (DPDP Act right to access): everything we hold about the signed-in student, as one JSON file. */
export async function GET() {
  const { data: { user } } = await (await supabaseServer()).auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const db = supabaseAdmin();
  const mine = <T extends string>(table: T, cols = "*") => db.from(table).select(cols).eq("user_id", user.id);
  const [profile, progress, known, notes, feedback, photos] = await Promise.all([
    db.from("profiles").select("full_name, roll_no, year, section, role, status, avatar_path, created_at, privacy_version, privacy_accepted_at").eq("id", user.id).maybeSingle(),
    mine("chapter_progress"),
    mine("known_questions"),
    mine("subject_notes"),
    mine("feedback", "message, page, created_at"),
    db.storage.from("avatars").list(user.id),
  ]);
  const body = {
    exportedAt: new Date().toISOString(),
    account: { email: user.email, signInMethods: user.identities?.map((i) => i.provider) ?? [], createdAt: user.created_at, lastSignInAt: user.last_sign_in_at },
    profile: profile.data,
    chapterProgress: progress.data ?? [],
    questionsMarkedKnown: known.data ?? [],
    notes: notes.data ?? [],
    feedback: feedback.data ?? [],
    photoFiles: (photos.data ?? []).map((f) => f.name),
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="my-library-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
