"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { bulkRegister, sendWelcomeEmails, type BulkResult } from "@/app/actions/bulk";

const TEMPLATE = "roll_no,full_name,year,section,email,phone\n22AB1A4201,Priya Kumari,3,A,priya@example.com,9876543210\n";
const time = (iso: string) => new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(iso));

// Figma B4. Upload → accounts are created at once → the set-password emails go out in small batches (progress bar)
// until the hourly Gmail limit; "Send the rest" picks up later.
export function BulkForm({ waiting: initialWaiting }: { waiting: number }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<BulkResult | null>(null);
  const [mail, setMail] = useState({ sent: 0, waiting: initialWaiting, total: initialWaiting, nextAt: undefined as string | undefined, running: false, note: "" });

  const sendAll = async (startWaiting: number) => {
    let sent = 0, waiting = startWaiting, nextAt: string | undefined, note = "";
    setMail({ sent, waiting, total: startWaiting, nextAt, running: true, note });
    while (waiting > 0) {
      const r = await sendWelcomeEmails().catch(() => ({ ok: false, sent: 0, waiting, message: "Sending stopped. Try again.", nextAt: undefined }));
      sent += r.sent; waiting = r.waiting; nextAt = r.nextAt;
      setMail({ sent, waiting, total: startWaiting, nextAt, running: true, note });
      if (!r.ok || r.sent === 0) { note = r.message; break; }
    }
    setMail({ sent, waiting, total: startWaiting, nextAt, running: false, note });
    router.refresh();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || busy) return;
    setBusy(true); setRes(null);
    const r = await bulkRegister(await file.text()).catch(() => ({ ok: false, message: "Something went wrong. Try again." }) as BulkResult);
    setBusy(false); setRes(r);
    if (r.ok && (r.created ?? 0) > 0) await sendAll(mail.waiting + (r.created ?? 0));
  };
  const pct = mail.total ? Math.round(((mail.total - mail.waiting) / mail.total) * 100) : 0;

  return (
    <div className="ad-cols">
      <form className="ad-card" onSubmit={submit} aria-labelledby="up-h">
        <h2 id="up-h" className="ad-h2">Upload the class CSV</h2>
        <label className="ad-drop">
          <input type="file" accept=".csv,text/csv" onChange={(e) => { setFile(e.currentTarget.files?.[0] ?? null); setRes(null); }} />
          <span className="ad-strong">{file ? file.name : "Choose CSV file"}</span>
          <span className="ad-mono">roll_no, full_name, year, section, email, phone · .csv only</span>
        </label>
        <ul className="ad-rules">
          <li>One row per student. Phone is a 10-digit mobile number.</li>
          <li>Students already in the app are skipped, never changed.</li>
          <li>They&apos;re added to the class list too, so they&apos;re approved straight away.</li>
          <li>Up to 60 emails go out per hour (Gmail limit). The rest wait for &ldquo;Send the rest&rdquo;.</li>
        </ul>
        <div className="ad-formFoot">
          <a className="ad-btnLine" href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`} download="class-template.csv">Download CSV template</a>
          <button className="ad-btnInk" disabled={!file || busy}>{busy ? "Creating accounts…" : "Create accounts"}</button>
        </div>
      </form>

      <section className="ad-card" aria-labelledby="res-h" aria-live="polite">
        <h2 id="res-h" className="ad-h2">{res ? "This upload" : "Emails"}</h2>
        {res && !res.ok && <p className="ad-err">{res.message}</p>}
        {res?.ok && (
          <dl className="ad-result">
            <div><dt>{res.read}</dt><dd>rows read</dd></div>
            <div><dt>{res.created}</dt><dd>accounts created</dd></div>
            <div><dt className={res.skipped?.length ? "ad-errNum" : ""}>{res.skipped?.length ?? 0}</dt><dd>rows skipped</dd></div>
          </dl>
        )}
        {(mail.total > 0 || mail.waiting > 0) && (
          <div className="ad-progress">
            <p className="ad-meta">{mail.running ? `Sending set-password emails… ${mail.total - mail.waiting} of ${mail.total}` : mail.waiting ? `${mail.waiting} ${mail.waiting === 1 ? "email is" : "emails are"} waiting${mail.nextAt ? `: the next batch can go after ${time(mail.nextAt)}` : ""}.` : `All ${mail.total} set-password emails sent.`}</p>
            <div className="ad-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Emails sent"><span style={{ width: `${pct}%` }} /></div>
            {!mail.running && mail.waiting > 0 && <button type="button" className="ad-btnLine" onClick={() => sendAll(mail.waiting)}>Send the rest</button>}
            {mail.note && !mail.running && <p className="ad-meta">{mail.note}</p>}
          </div>
        )}
        {!res && mail.total === 0 && mail.waiting === 0 && <p className="ad-meta">After an upload, each student gets an email to choose their own password. Progress shows here.</p>}
        {res?.skipped && res.skipped.length > 0 && <ul className="ad-skips">{res.skipped.map((s) => <li key={s}>{s}</li>)}</ul>}
      </section>
    </div>
  );
}
