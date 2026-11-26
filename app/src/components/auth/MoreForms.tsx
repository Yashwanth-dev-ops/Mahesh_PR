"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { requestPasswordReset, signInWithGoogle, updatePassword, type FormResult } from "@/app/actions/auth";
import { PillButton } from "@/components/ui/PillLinks";
import { Field, PasswordField, focusFirstError } from "./fields";
import { AUTH_FORM_ID } from "./rules";
import { setAuthError } from "./AuthHead";

const FAILED: FormResult = { message: "Something went wrong. Try again." };

// Submit helper shared by the small auth forms: run the action, show field errors or the message.
function useAction(action: (d: FormData) => Promise<FormResult>, onOk: () => void) {
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [busy, setBusy] = useState(false);
  const onSubmit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    if (busy) return;
    const form = ev.currentTarget;
    setBusy(true); setAuthError("");
    const res = await action(new FormData(form)).catch(() => FAILED);
    setBusy(false);
    setErrors(res.errors ?? {});
    if (res.errors) return focusFirstError(form, res.errors);
    if (res.ok) return onOk();
    setAuthError(res.message ?? "");
  };
  const clear = (k: string) => () => errors[k] && setErrors({ ...errors, [k]: undefined });
  return { errors, busy, onSubmit, clear };
}

export function ForgotForm({ admin = false }: { admin?: boolean } = {}) {
  const [sent, setSent] = useState(false);
  const f = useAction(requestPasswordReset, () => setSent(true));
  if (sent) {
    return (
      <div className="au-done" role="status">
        <p className="au-doneTitle">Check your email</p>
        <p>{admin ? "If that email belongs to an admin account, we've sent a reset link to it." : "If that roll number has an account, we've sent a reset link to the email on it."} The link works for 24 hours.</p>
        <Link href={admin ? "/admin/login" : "/login"} className="au-small">Back to log in</Link>
      </div>
    );
  }
  return (
    <form id={AUTH_FORM_ID} className="au-form" noValidate onSubmit={f.onSubmit}>
      {admin ? (
        <Field name="email" type="email" label="Admin email" error={f.errors.email} onEdit={f.clear("email")}
          inputProps={{ autoComplete: "username", spellCheck: false, maxLength: 120, placeholder: "you@college.edu" }} />
      ) : (
        <Field
          name="roll" label="Roll number" error={f.errors.roll} onEdit={f.clear("roll")}
          inputProps={{ autoComplete: "username", autoCapitalize: "characters", spellCheck: false, maxLength: 15, placeholder: "e.g. 22AB1A4201" }}
        />
      )}
      <div className="au-actions"><PillButton>{f.busy ? "Sending…" : "Send reset link"}</PillButton></div>
    </form>
  );
}

export function ResetForm({ th }: { th?: string } = {}) {
  const router = useRouter();
  const f = useAction(updatePassword, () => router.push("/home"));
  return (
    <form id={AUTH_FORM_ID} className="au-form" noValidate onSubmit={f.onSubmit}>
      {th && <input type="hidden" name="th" value={th} />}
      <PasswordField name="password" label="New password" autoComplete="new-password" hint="At least 8 characters" error={f.errors.password} onEdit={f.clear("password")} />
      <PasswordField name="confirm" label="Type it again" autoComplete="new-password" error={f.errors.confirm} onEdit={f.clear("confirm")} />
      <div className="au-actions"><PillButton>{f.busy ? "Saving…" : "Save new password"}</PillButton></div>
    </form>
  );
}

/** "Continue with Google". A plain form, so it works before JavaScript loads; the action redirects to Google. */
export function GoogleButton({ label = "Continue with Google" }: { label?: string } = {}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="au-google">
      <div className="au-or" aria-hidden="true"><span>or</span></div>
      <form action={async () => { setBusy(true); setAuthError(""); const r = await signInWithGoogle().catch(() => FAILED); setBusy(false); setAuthError(r?.message ?? ""); }}>
        <button type="submit" className="au-gbtn" aria-busy={busy || undefined}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
          {busy ? "Opening Google…" : label}
        </button>
      </form>
    </div>
  );
}

/** Message after a Google sign-in for an account that isn't active. */
export function AccountStatus() {
  const s = useSearchParams().get("s");
  return (
    <div className="au-done" role="status">
      <p className="au-doneTitle">{s === "suspended" ? "This account is suspended" : "Waiting for approval"}</p>
      <p>
        {s === "suspended"
          ? "Contact the library admin if you think this is a mistake."
          : "Your roll number and name aren't on the branch list yet, so an admin will check your account. You can sign in once it's approved."}
      </p>
      <Link href="/login" className="au-small">Back to log in</Link>
    </div>
  );
}
