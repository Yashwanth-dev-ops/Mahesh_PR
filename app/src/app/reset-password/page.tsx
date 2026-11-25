import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetForm } from "@/components/auth/MoreForms";
import { APP_NAME } from "@/lib/site";

export const metadata: Metadata = { title: `New password · ${APP_NAME}` };

// Reached from the reset email; the proxy sends visitors without that session to /login.
export default function ResetPasswordPage() {
  return (
    <AuthShell id="reset-title" title="Set a new password" lead="Choose a new password for your account.">
      <ResetForm />
    </AuthShell>
  );
}
