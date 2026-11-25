import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { APP_NAME } from "@/lib/site";

export const metadata: Metadata = { title: `Admin login · ${APP_NAME}` };

export default function AdminLoginPage() {
  return (
    <AuthShell id="admin-login-title" title="Admin login" lead="For library admins only. Use your roll number and password.">
      <LoginForm admin />
      <p className="au-alt">Not an admin? <Link href="/login">Student login</Link></p>
    </AuthShell>
  );
}
