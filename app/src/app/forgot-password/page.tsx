import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotForm } from "@/components/auth/MoreForms";
import { APP_NAME } from "@/lib/site";

export const metadata: Metadata = { title: `Forgot password · ${APP_NAME}` };

export default function ForgotPasswordPage() {
  return (
    <AuthShell id="forgot-title" title="Forgot password" lead="Enter your roll number. We'll email a link to set a new password.">
      <ForgotForm />
      <p className="au-alt">Remembered it? <Link href="/login">Log in</Link></p>
    </AuthShell>
  );
}
