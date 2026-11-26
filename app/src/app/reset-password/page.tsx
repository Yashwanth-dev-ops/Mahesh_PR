import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetForm } from "@/components/auth/MoreForms";
import { APP_NAME } from "@/lib/site";

export const metadata: Metadata = { title: `New password · ${APP_NAME}` };

// Reached from the reset / set-password email with ?th=<one-time code>, or with a session (older links).
async function Reset({ searchParams }: { searchParams: Promise<{ th?: string }> }) {
  const th = (await searchParams).th;
  return (
    <AuthShell id="reset-title" title="Set a new password" lead="Choose a new password for your account.">
      <ResetForm th={th} />
    </AuthShell>
  );
}

export default function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ th?: string }> }) {
  return <Suspense fallback={null}><Reset searchParams={searchParams} /></Suspense>;
}
