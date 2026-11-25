"use client";

import { useRef, useState, type ReactNode } from "react";
import { PhotoEditor } from "@/components/photo/PhotoEditor";

type Common = { name: string; label: string; error?: string; hint?: string; aside?: ReactNode; onEdit?: () => void };

// Wires label, hint and error to the control for screen readers.
function describe(name: string, error?: string, hint?: string) {
  return [hint && !error && `${name}-hint`, error && `${name}-err`].filter(Boolean).join(" ") || undefined;
}

// The hint (or the error, which replaces it) sits at the right end of the label line, so neither adds height.
// A field with its own link there (Forgot password?) keeps the link and shows the error under the box instead.
function Wrap({ name, label, error, hint, aside, children }: Common & { children: ReactNode }) {
  const err = error && <p id={`${name}-err`} className="au-err">{error}</p>;
  return (
    <div className="au-field">
      <div className="au-labelRow">
        <label htmlFor={name}>{label}</label>
        {aside ?? (err || (hint && <p id={`${name}-hint`} className="au-hint">{hint}</p>))}
      </div>
      {children}
      {aside && err}
    </div>
  );
}

export function Field({ type = "text", inputProps, ...c }: Common & { type?: string; inputProps?: React.InputHTMLAttributes<HTMLInputElement> }) {
  return (
    <Wrap {...c}>
      <input
        id={c.name} name={c.name} type={type} {...inputProps}
        aria-invalid={c.error ? true : undefined} aria-describedby={describe(c.name, c.error, c.hint)}
        onChange={c.onEdit}
      />
    </Wrap>
  );
}

export function SelectField({ options, placeholder, ...c }: Common & { options: string[]; placeholder: string }) {
  return (
    <Wrap {...c}>
      <select
        id={c.name} name={c.name} defaultValue="" onChange={c.onEdit}
        aria-invalid={c.error ? true : undefined} aria-describedby={describe(c.name, c.error, c.hint)}
      >
        <option value="" disabled>{placeholder}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </Wrap>
  );
}

export function PasswordField({ autoComplete, ...c }: Common & { autoComplete: "current-password" | "new-password" }) {
  const [show, setShow] = useState(false);
  return (
    <Wrap {...c}>
      <div className="au-pw">
        <input
          id={c.name} name={c.name} type={show ? "text" : "password"} autoComplete={autoComplete}
          aria-invalid={c.error ? true : undefined} aria-describedby={describe(c.name, c.error, c.hint)}
          onChange={c.onEdit}
        />
        <button type="button" className="au-show" aria-pressed={show} aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow(!show)}>
          {show ? "Hide" : "Show"}
        </button>
      </div>
    </Wrap>
  );
}

/** Photo picker: a real file input (keyboard and screen-reader friendly) styled as a button, plus the file name. */
export function PhotoField({ name, label, error, hint, onEdit }: Common) {
  const input = useRef<HTMLInputElement>(null);
  const kept = useRef<File | null>(null); // the last saved crop, kept if the editor is cancelled
  const [editing, setEditing] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const put = (f: File | null) => { // what the form will send
    const dt = new DataTransfer(); if (f) dt.items.add(f); input.current!.files = dt.files;
  };
  return (
    <Wrap name={name} label={label} error={error} hint={hint}>
      <div className="au-file">
        <input
          ref={input} id={name} name={name} type="file" accept="image/jpeg,image/png,image/webp"
          aria-invalid={error ? true : undefined} aria-describedby={describe(name, error, hint)}
          onChange={(e) => { const f = e.currentTarget.files?.[0]; if (f && f.type.startsWith("image/")) setEditing(f); }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the cropped photo */}
        {preview && <img src={preview} alt="" className="au-thumb" />}
        <span className="au-fileBtn" aria-hidden="true">{preview ? "Change photo" : "Choose photo"}</span>
        <span className="au-fileName" aria-hidden="true">{preview ? "Photo ready" : "No photo yet"}</span>
      </div>
      {editing && (
        <PhotoEditor key={`${editing.name}${editing.size}${editing.lastModified}`} file={editing} onChangePhoto={setEditing}
          onCancel={() => { put(kept.current); setEditing(null); }}
          onSave={(cropped) => {
            kept.current = cropped; put(cropped); setEditing(null);
            setPreview((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(cropped); });
            onEdit?.();
          }} />
      )}
    </Wrap>
  );
}

/** DPDP Act consent: an unticked box the student ticks themselves, with the notice one tap away. */
export function ConsentField({ error, onEdit, required }: { error?: string; onEdit?: () => void; required?: boolean }) {
  return (
    <div className="au-consent">
      <input id="consent" name="consent" type="checkbox" value="yes" onChange={onEdit} required={required}
        aria-invalid={error ? true : undefined} aria-describedby={error ? "consent-err" : undefined} />
      <label htmlFor="consent">
        I&apos;m 18+ and agree to the <a href="/privacy" target="_blank" rel="noopener">privacy notice</a>.
        {error && <span id="consent-err" className="au-sr"> {error}</span>}
      </label>
    </div>
  );
}

/** Puts focus on the first field with an error, in form order. */
export function focusFirstError(form: HTMLFormElement, errors: Record<string, string | undefined>) {
  const bad = [...form.elements].find((el) => el instanceof HTMLElement && el.id && errors[el.id]);
  (bad as HTMLElement | undefined)?.focus();
}
