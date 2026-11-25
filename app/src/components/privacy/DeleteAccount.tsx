"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteMyAccount, type DeleteResult } from "@/app/actions/privacy";
import "./privacy-controls.css";

/** "Delete my account" (DPDP Act right to erasure). Closed by default; asks for the roll number to confirm. */
export function DeleteAccount() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  return (
    <details className="pc-box">
      <summary className="pc-summary">Delete my account</summary>
      <form
        className="pc-body"
        action={async (form) => {
          setBusy(true); setMessage("");
          const res: DeleteResult = await deleteMyAccount(form).catch(() => ({ message: "Something went wrong. Try again." }));
          if (res.ok) return router.replace("/account-deleted");
          setBusy(false); setMessage(res.message ?? "");
        }}
      >
        <p>This removes your profile, photo, notes, progress and feedback straight away. It can&apos;t be undone. Copies in the encrypted weekly backups expire within 8 weeks.</p>
        <label htmlFor="pc-confirm" className="pc-label">Type your roll number to confirm</label>
        <input id="pc-confirm" name="confirm" className="pc-input" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={15} required
          aria-describedby={message ? "pc-msg" : undefined} />
        <p id="pc-msg" className="pc-msg" role="status">{message}</p>
        <button type="submit" className="pc-danger" disabled={busy}>{busy ? "Deleting…" : "Delete my account permanently"}</button>
      </form>
    </details>
  );
}
