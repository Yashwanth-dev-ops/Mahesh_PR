import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotForm } from "@/components/auth/MoreForms";
import { APP_NAME } from "@/lib/site";

export const metadata: Metadata = { title: `Forgot password · ${APP_NAME}` };

async function Forgot({ searchParams }: { searchParams: Promise<{ admin?: string }> }) {
  const admin = (await searchParams).admin === "1";
  return (
    <AuthShell id="forgot-title" title="Forgot password" lead={admin ? "Enter your admin email. We'll email a link to set a new password." : "Enter your roll number. We'll email a link to set a new password."}>
      <ForgotForm admin={admin} />
      <p className="au-alt">Remembered it? <Link href={admin ? "/admin/login" : "/login"}>Log in</Link></p>
    </AuthShell>
  );
}

// Reads the session and the URL, so it renders inside Suspense (cacheComponents).
export default function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ admin?: string }> }) {
  return <Suspense fallback={null}><Forgot searchParams={searchParams} /></Suspense>;
}
