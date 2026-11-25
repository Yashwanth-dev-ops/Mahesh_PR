"use client";

import { useEffect, useState } from "react";
import { AUTH_FORM_ID } from "./rules";

export type Head = { kicker?: string; title: string; lead?: string };
type Msg = { error: string } | { head: Head };
const EVENT = "auth-head";
const send = (m: Msg) => window.dispatchEvent(new CustomEvent<Msg>(EVENT, { detail: m }));

/** Shows a form's error in place of the intro line (same spot, same height), so nothing below moves. "" clears it. */
export const setAuthError = (error: string) => send({ error });
/** Swaps the heading for a multi-step form (sign-up step 2). */
export const setAuthHead = (head: Head) => send({ head });

/** Heading + intro line of every sign-in page. The forms talk to it through the two functions above. */
export function AuthHead({ id, ...initial }: Head & { id: string }) {
  const [head, setHead] = useState<Head>(initial);
  const [error, setError] = useState("");

  useEffect(() => {
    const on = (e: Event) => {
      const m = (e as CustomEvent<Msg>).detail;
      if ("error" in m) setError(m.error);
      else { setHead(m.head); setError(""); }
    };
    addEventListener(EVENT, on);
    // Laptops start in the first field; phones don't, or the keyboard would cover the page.
    if (matchMedia("(min-width: 960px) and (pointer: fine)").matches)
      document.querySelector<HTMLInputElement>(`#${AUTH_FORM_ID} input:not([type=hidden]):not([type=file])`)?.focus();
    return () => removeEventListener(EVENT, on);
  }, []);

  return (
    <div className="au-head">
      {head.kicker && <p className="au-kicker">{head.kicker}</p>}
      <h1 id={id} className="au-h1">{head.title}</h1>
      <p className={error ? "au-lead au-leadErr" : "au-lead"} role="status">{error || head.lead}</p>
    </div>
  );
}
