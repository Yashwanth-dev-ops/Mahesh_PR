"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PillButton } from "@/components/ui/PillLinks";
import { Field, PasswordField, focusFirstError } from "./fields";
import { revealFail, revealOk, revealStart } from "./RevealHost";
import { setAuthError } from "./AuthHead";
import { signIn, type LoginResult } from "@/app/actions/auth";
import { AUTH_FORM_ID, rollError } from "./rules";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Errors = { roll?: string; password?: string };

/** `admin` = the admin login page: only admin accounts get in, and they land on /admin. */
export function LoginForm({ admin = false }: { admin?: boolean } = {}) {
  const [errors, setErrors] = useState<Errors>({});
  const clear = (k: keyof Errors) => () => errors[k] && setErrors({ ...errors, [k]: undefined });

  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const onSubmit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    if (busy) return;
    const form = ev.currentTarget;
    const data = new FormData(form);
    const e: Errors = {
      roll: rollError(String(data.get("roll") ?? "").trim().toUpperCase()),
      password: data.get("password") ? undefined : "Enter your password.",
    };
    setErrors(e);
    setAuthError("");
    if (e.roll || e.password) return focusFirstError(form, e);

    setBusy(true);
    // Yellow grows from the button while the account is checked; it opens onto Home or shrinks back.
    revealStart(form.querySelector(".pill-disc"));
    const t0 = Date.now(), still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const res = await signIn(data).catch(() => ({ message: "Something went wrong. Try again." }) as LoginResult);
    if (res.ok) {
      const to = res.to ?? "/home";
      router.prefetch(to); // its code downloads while the flood plays
      await wait(Math.max(0, t0 + (still ? 0 : 800) - Date.now())); // let the flood finish first
      revealOk("Welcome back", res.name ?? "", res.roll ?? "");
      router.push(to); // loads under the greeting; RevealHost keeps the greeting up for its full time
      return;
    }
    revealFail();
    setBusy(false);
    if (res.errors) { setErrors(res.errors); focusFirstError(form, res.errors); }
    setAuthError(res.message ?? "");
    // Wrong details: the password field shakes once (skipped for reduced motion).
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
      form.querySelector<HTMLInputElement>('input[name="password"]')?.animate(
        [{ translate: "0" }, { translate: "-6px 0" }, { translate: "5px 0" }, { translate: "-3px 0" }, { translate: "2px 0" }, { translate: "0" }],
        { duration: 320, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
  };

  return (
    <form id={AUTH_FORM_ID} className="au-form" noValidate onSubmit={onSubmit}>
      {admin && <input type="hidden" name="as" value="admin" />}
      <Field
        name="roll" label="Roll number" error={errors.roll} onEdit={clear("roll")}
        inputProps={{ autoComplete: "username", autoCapitalize: "characters", spellCheck: false, maxLength: 15, placeholder: "e.g. 22AB1A4201" }}
      />
      <PasswordField
        name="password" label="Password" autoComplete="current-password" error={errors.password} onEdit={clear("password")}
        aside={<Link href="/forgot-password" className="au-small">Forgot password?</Link>}
      />
      <div className="au-actions"><PillButton>{busy ? "Signing in…" : "Sign in"}</PillButton></div>
    </form>
  );
}
