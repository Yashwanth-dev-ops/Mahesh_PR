import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { AccountStatus } from "@/components/auth/MoreForms";
import { APP_NAME } from "@/lib/site";

export const metadata: Metadata = { title: `Account status · ${APP_NAME}` };

export default function AccountStatusPage() {
  return (
    <AuthShell id="status-title" title="Not quite yet" lead="Your account exists, but you can't sign in right now.">
      <Suspense><AccountStatus /></Suspense>
    </AuthShell>
  );
}
