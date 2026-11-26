import type { Metadata } from "next";
import { Suspense } from "react";
import { completeAdminSetup } from "@/app/actions/team";
import { AuthShell } from "@/components/auth/AuthShell";
import { ConsentField, PasswordField } from "@/components/auth/fields";
import { PillButton } from "@/components/ui/PillLinks";
import { APP_NAME } from "@/lib/site";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: `Set up your admin account · ${APP_NAME}`, robots: { index: false, follow: false } };

/** Figma M4: the page behind the admin invitation link (the link has already signed them in). */
async function Setup({ searchParams }: { searchParams: Promise<{ e?: string; th?: string }> }) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = user ? await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle() : { data: null };
  const { e, th } = await searchParams;
  return (
    <AuthShell id="setup-title" title="Set up your admin account"
      lead={e === "expired" ? "This invitation link has expired or was already used. Ask the main admin to resend it."
        : me ? `${me.full_name.split(" ")[0]}, choose a password to finish. You'll sign in with ${user?.email} and this password.`
        : th ? "Choose a password to finish. You'll sign in with your email and this password." : "Open the link in your invitation email to continue."}>
      {(me || th) && e !== "expired" && (
        <form action={completeAdminSetup} className="au-form">
          {th && <input type="hidden" name="th" value={th} />}
          <PasswordField name="password" label="Password" autoComplete="new-password" hint="At least 12 characters" error={e === "password" ? "Use 12 to 72 characters." : undefined} />
          <ConsentField required error={e === "consent" ? "Tick the box to continue." : undefined} />
          <div className="au-actions"><PillButton>Create admin account</PillButton></div>
        </form>
      )}
    </AuthShell>
  );
}

// Reads the session and the URL, so it renders inside Suspense (cacheComponents).
export default function AdminSetupPage({ searchParams }: { searchParams: Promise<{ e?: string; th?: string }> }) {
  return <Suspense fallback={null}><Setup searchParams={searchParams} /></Suspense>;
}
