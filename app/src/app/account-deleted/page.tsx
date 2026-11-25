import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { APP_NAME } from "@/lib/site";

export const metadata: Metadata = { title: `Account deleted · ${APP_NAME}` };

export default function AccountDeletedPage() {
  return (
    <AuthShell id="deleted-title" title="Account deleted" lead="Your profile, photo, notes, progress and feedback are gone.">
      <div className="au-done" role="status">
        <p className="au-doneTitle">Thanks for using {APP_NAME}</p>
        <p>Copies inside the encrypted weekly backups expire within 8 weeks. You can sign up again any time.</p>
        <Link href="/" className="au-small">Back to the home page</Link>
      </div>
    </AuthShell>
  );
}
