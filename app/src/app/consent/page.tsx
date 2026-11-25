import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { acceptPrivacy } from "@/app/actions/privacy";
import { signOut } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth/AuthShell";
import { ConsentField, Field } from "@/components/auth/fields";
import { DeleteAccount } from "@/components/privacy/DeleteAccount";
import { PillButton } from "@/components/ui/PillLinks";
import { APP_NAME } from "@/lib/site";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: `Privacy · ${APP_NAME}` };

/** Shown once to accounts made before the privacy notice (or after it changes). proxy.ts sends people here.
 *  Accounts without a mobile number (made before it was asked at sign-up) add it here, once. */
async function Consent({ searchParams }: { searchParams: Promise<{ phone?: string }> }) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = user ? await supabase.from("profiles").select("phone, role").eq("id", user.id).maybeSingle() : { data: null };
  const askPhone = me?.role !== "admin" && !me?.phone;
  const bad = (await searchParams).phone === "bad";
  return (
    <AuthShell id="consent-title" title={askPhone ? "Privacy notice updated" : "One thing first"}>
      <ul className="au-points">
        <li>We keep your name, roll number, email, mobile number, class, photo and study progress, only to run the library.</li>
        <li>Admins see your name, class and mobile number to approve accounts and reach you. Other students see nothing.</li>
        <li>You can download or delete everything from your Profile, any time.</li>
      </ul>
      <form action={acceptPrivacy} className="au-form">
        {askPhone && <Field name="phone" type="tel" label="Mobile number" hint="Only admins see it" error={bad ? "Enter a 10-digit mobile number." : undefined}
          inputProps={{ autoComplete: "tel-national", inputMode: "tel", maxLength: 16, placeholder: "10-digit number", required: true }} />}
        <ConsentField required />
        <div className="au-actions"><PillButton>Agree and continue</PillButton></div>
      </form>
      <p className="au-alt"><Link href="/privacy" target="_blank" rel="noopener">Read the full notice</Link> · <button form="consent-signout" className="au-linkBtn">Sign out</button></p>
      <form id="consent-signout" action={signOut} hidden />
      <DeleteAccount />
    </AuthShell>
  );
}

// Reads the session and the URL, so it renders inside Suspense (cacheComponents).
export default function ConsentPage({ searchParams }: { searchParams: Promise<{ phone?: string }> }) {
  return <Suspense fallback={null}><Consent searchParams={searchParams} /></Suspense>;
}
