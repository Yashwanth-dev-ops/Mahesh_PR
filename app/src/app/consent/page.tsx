import type { Metadata } from "next";
import Link from "next/link";
import { acceptPrivacy } from "@/app/actions/privacy";
import { signOut } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth/AuthShell";
import { ConsentField } from "@/components/auth/fields";
import { DeleteAccount } from "@/components/privacy/DeleteAccount";
import { PillButton } from "@/components/ui/PillLinks";
import { APP_NAME } from "@/lib/site";

export const metadata: Metadata = { title: `Privacy · ${APP_NAME}` };

/** Shown once to accounts made before the privacy notice (or after it changes). proxy.ts sends people here. */
export default function ConsentPage() {
  return (
    <AuthShell id="consent-title" title="One thing first">
      <ul className="au-points">
        <li>We keep your name, roll number, email, class, photo and study progress, only to run the library.</li>
        <li>Admins see your name and class to approve accounts. Other students see nothing.</li>
        <li>You can download or delete everything from your Profile, any time.</li>
      </ul>
      <form action={acceptPrivacy} className="au-form">
        <ConsentField required />
        <div className="au-actions"><PillButton>Agree and continue</PillButton></div>
      </form>
      <p className="au-alt"><Link href="/privacy" target="_blank" rel="noopener">Read the full notice</Link> · <button form="consent-signout" className="au-linkBtn">Sign out</button></p>
      <form id="consent-signout" action={signOut} hidden />
      <DeleteAccount />
    </AuthShell>
  );
}
