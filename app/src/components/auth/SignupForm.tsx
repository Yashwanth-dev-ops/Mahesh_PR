"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PillButton } from "@/components/ui/PillLinks";
import { ConsentField, Field, PasswordField, PhotoField, SelectField, focusFirstError } from "./fields";
import { completeProfile, signUpStudent, type SignupResult } from "@/app/actions/auth";
import { revealFail, revealOk, revealStart } from "./RevealHost";
import { setAuthError, setAuthHead, type Head } from "./AuthHead";
import { AUTH_FORM_ID, SIGNUP_STEP1, YEARS, hasErrors, readSignup, validateSignup, type SignupErrors, type SignupKey } from "./rules";

const STEP2: Head = { kicker: "Step 2 of 2", title: "A few more details" };
const STEP1_KEYS: SignupKey[] = ["fullName", "roll", "phone"];

/**
 * Sign-up form. Two steps so neither scrolls on a phone: name + roll number first (they decide instant access),
 * then email, class, password and photo. Both steps live in one <form>, so one submit sends everything.
 * `googleName` = finishing a first Google sign-in: one step, no email/password, name prefilled.
 */
export function SignupForm({ googleName }: { googleName?: string } = {}) {
  const google = googleName !== undefined;
  const [errors, setErrors] = useState<SignupErrors>({});
  const [step, setStep] = useState<1 | 2>(1);
  const clear = (k: SignupKey) => () => errors[k] && setErrors({ ...errors, [k]: undefined });

  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"active" | "pending" | null>(null);
  const router = useRouter();

  const goTo = (n: 1 | 2, form: HTMLFormElement) => {
    setStep(n);
    setAuthHead(n === 1 ? SIGNUP_STEP1 : STEP2);
    requestAnimationFrame(() => form.querySelector<HTMLInputElement>(`[data-step-part="${n}"] input:not([type=file])`)?.focus());
  };

  const onSubmit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    if (busy) return;
    const form = ev.currentTarget;
    const data = new FormData(form);
    const { email: _email, password: _password, ...rest } = validateSignup(readSignup(data));
    const all: SignupErrors = google ? rest : { ...rest, email: _email, password: _password };
    const firstStepBad = !google && STEP1_KEYS.some((k) => all[k]);
    // Step 1 checks only its own two fields; the rest are checked when the account is created.
    const e = !google && step === 1 ? Object.fromEntries(STEP1_KEYS.map((k) => [k, all[k]])) as SignupErrors : all;
    setErrors(e);
    setAuthError("");
    if (hasErrors(e)) {
      if (step === 2 && firstStepBad) goTo(1, form);
      return requestAnimationFrame(() => focusFirstError(form, e));
    }
    if (!google && step === 1) return goTo(2, form);

    setBusy(true);
    revealStart(form.querySelector(".pill-disc"));
    const t0 = Date.now(), still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, Math.max(0, ms)));
    const res = await (google ? completeProfile(data) : signUpStudent(data)).catch(() => ({ message: "Something went wrong. Try again." }) as SignupResult);
    if (res.ok && res.status === "active") {
      // Account works right away: the loader greets them and opens onto the library.
      const s2 = readSignup(data);
      router.prefetch("/home"); // its code downloads while the flood plays
      await wait(t0 + (still ? 0 : 800) - Date.now());
      revealOk("Welcome", s2.fullName.split(" ")[0], s2.roll);
      router.push("/home"); // loads under the greeting; RevealHost keeps the greeting up for its full time
      return;
    }
    revealFail();
    setBusy(false);
    if (res.ok) { if (!google) setAuthHead({ title: SIGNUP_STEP1.title }); return setDone(res.status ?? "pending"); }
    if (res.errors) {
      setErrors(res.errors);
      if (!google && STEP1_KEYS.some((k) => res.errors?.[k])) goTo(1, form);
      const bad = res.errors;
      requestAnimationFrame(() => focusFirstError(form, bad));
    }
    setAuthError(res.message ?? "");
  };

  if (done) {
    return (
      <div className="au-done" role="status">
        {done === "active" ? (
          <>
            <p className="au-doneTitle">Your account is ready</p>
            <p>Your roll number and name match the branch list, so you can start right away.</p>
            <Link href="/home" className="au-small">Go to your library</Link>
          </>
        ) : (
          <>
            <p className="au-doneTitle">Account created</p>
            <p>Your roll number and name aren&apos;t on the branch list yet, so an admin will check your account. You can log in once it&apos;s approved.</p>
            <Link href="/login" className="au-small">Back to log in</Link>
          </>
        )}
      </div>
    );
  }

  const yearSection = (
    <div className="au-pair">
      <SelectField name="year" label="Year" placeholder="Choose" options={YEARS} error={errors.year} onEdit={clear("year")} />
      <Field name="section" label="Section" error={errors.section} onEdit={clear("section")} inputProps={{ autoCapitalize: "characters", maxLength: 3, placeholder: "e.g. A" }} />
    </div>
  );
  const consent = <ConsentField error={errors.consent} onEdit={clear("consent")} />;
  const photo = <PhotoField name="photo" label="Your photo" hint="Goes on your library card" error={errors.photo} onEdit={clear("photo")} />;

  return (
    <form id={AUTH_FORM_ID} className="au-form" noValidate onSubmit={onSubmit} data-step={google ? undefined : step}>
      <div className="au-step" data-step-part="1" hidden={!google && step !== 1}>
        <Field
          name="fullName" label="Full name" error={errors.fullName} onEdit={clear("fullName")}
          inputProps={{ autoComplete: "name", maxLength: 80, defaultValue: googleName, placeholder: "As on your college ID" }}
        />
        <Field
          name="roll" label="Roll number" error={errors.roll} onEdit={clear("roll")}
          inputProps={{ autoComplete: "username", autoCapitalize: "characters", spellCheck: false, maxLength: 15, placeholder: "e.g. 22AB1A4201" }}
        />
        <Field
          name="phone" type="tel" label="Mobile number" hint="Only admins see it" error={errors.phone} onEdit={clear("phone")}
          inputProps={{ autoComplete: "tel-national", inputMode: "tel", maxLength: 16, placeholder: "10-digit number" }}
        />
        {google && yearSection}
        {google && photo}
        {google && consent}
      </div>
      {!google && (
        <div className="au-step" data-step-part="2" hidden={step !== 2}>
          <Field
            name="email" type="email" label="Email" error={errors.email} onEdit={clear("email")} hint="For account messages"
            inputProps={{ autoComplete: "email", inputMode: "email", spellCheck: false, maxLength: 120, placeholder: "you@example.com" }}
          />
          {yearSection}
          <PasswordField name="password" label="Password" autoComplete="new-password" hint="At least 8 characters" error={errors.password} onEdit={clear("password")} />
          {photo}
          {consent}
        </div>
      )}
      <div className="au-actions">
        {!google && step === 2 && <button type="button" className="au-back" onClick={(e) => goTo(1, e.currentTarget.form!)}>Back</button>}
        <PillButton>{busy ? "Saving…" : google ? "Finish sign-up" : step === 1 ? "Continue" : "Create account"}</PillButton>
      </div>
    </form>
  );
}
