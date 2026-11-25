import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/auth/SignupForm";
import { SIGNUP_STEP1 } from "@/components/auth/rules";
import { GoogleButton } from "@/components/auth/MoreForms";
import { APP_NAME } from "@/lib/site";

export const metadata: Metadata = { title: `Create an account · ${APP_NAME}` };

export default function SignupPage() {
  return (
    <AuthShell id="signup-title" {...SIGNUP_STEP1}>
      <SignupForm />
      <GoogleButton label="Sign up with Google" />
      <p className="au-alt">Already have an account? <Link href="/login">Log in</Link></p>
    </AuthShell>
  );
}
