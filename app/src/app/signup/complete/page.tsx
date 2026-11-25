import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/auth/SignupForm";
import { supabaseServer } from "@/lib/supabase/server";
import { APP_NAME } from "@/lib/site";

export const metadata: Metadata = { title: `Finish sign-up · ${APP_NAME}` };

async function Complete() {
  await connection();
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null; // the proxy handles signed-out visitors and finished profiles
  return <SignupForm googleName={String(user.user_metadata.full_name ?? user.user_metadata.name ?? "")} />;
}

// First Google sign-in: Google gives us name and email, the student adds the rest once.
export default function CompleteSignupPage() {
  return (
    <AuthShell id="complete-title" title="One more step" lead="You only do this once.">
      <Suspense fallback={<p className="au-lead">Loading…</p>}><Complete /></Suspense>
    </AuthShell>
  );
}
