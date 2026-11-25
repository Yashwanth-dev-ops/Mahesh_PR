import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { GoogleButton } from "@/components/auth/MoreForms";
import { APP_NAME } from "@/lib/site";

export const metadata: Metadata = { title: `Student login · ${APP_NAME}` };

export default function LoginPage() {
  return (
    <AuthShell id="login-title" title="Student login" lead="Sign in with your roll number and password.">
      <LoginForm />
      <GoogleButton />
      <p className="au-alt">New here? <Link href="/signup">Create an account</Link></p>
    </AuthShell>
  );
}
