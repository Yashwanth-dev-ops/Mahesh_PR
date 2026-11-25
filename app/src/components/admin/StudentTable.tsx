"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { deleteStudent, setStudentStatus } from "@/app/actions/admin";
import type { StudentRow } from "@/server/admin";

// Figma B1 Students. A class is small (tens to a few hundred), so search, filters and sort run here, instantly.
type Status = StudentRow["status"];
const LABEL: Record<Status, string> = { active: "Active", pending: "Waiting", suspended: "Blocked" };
const Y = ["", "I", "II", "III", "IV"];
const phoneText = (p: string | null) => (p ? `${p.slice(0, 5)} ${p.slice(5)}` : "—");
const day = (iso: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date(iso));

export function StudentTable({ rows }: { rows: StudentRow[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status | "all">("all");
  const [klass, setKlass] = useState("all"); // "III A" etc.
  const [sort, setSort] = useState<{ key: "name" | "joined"; dir: 1 | -1 }>({ key: "joined", dir: -1 });
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [menu, setMenu] = useState<StudentRow | null>(null);
  const [dialog, setDialog] = useState<{ kind: "block" | "delete"; row: StudentRow } | null>(null);
  const [sheet, setSheet] = useState<StudentRow | null>(null);
  const search = useRef<HTMLInputElement>(null);
  const menuEl = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);

  // "/" jumps to search from anywhere on the page (no animation: keyboard actions never animate).
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && !t.isContentEditable) { e.preventDefault(); search.current?.focus(); }
    };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, []);

  const counts = useMemo(() => ({ all: rows.length, pending: rows.filter((r) => r.status === "pending").length, active: rows.filter((r) => r.status === "active").length, suspended: rows.filter((r) => r.status === "suspended").length }), [rows]);
  const classes = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.year) { const k = `${Y[r.year]} ${r.section ?? ""}`.trim(); m.set(k, (m.get(k) ?? 0) + 1); }
    return [...m].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) => status === "all" || r.status === status)
      .filter((r) => klass === "all" || `${Y[r.year ?? 0]} ${r.section ?? ""}`.trim() === klass)
      .filter((r) => !needle || r.name.toLowerCase().includes(needle) || r.roll.toLowerCase().includes(needle))
      .sort((a, b) => (sort.key === "name" ? a.name.localeCompare(b.name) : a.joined.localeCompare(b.joined)) * sort.dir);
  }, [rows, q, status, klass, sort]);

  const act = async (row: StudentRow, to: "active" | "suspended", reason?: string) => {
    setBusy(row.id); setMsg("");
    const r = await setStudentStatus(row.id, to, reason).catch(() => ({ ok: false, message: "Something went wrong. Try again." }));
    setBusy(null); setMsg(r.ok ? `${row.name}: ${r.message.toLowerCase()}.` : r.message);
    if (r.ok) { setDialog(null); router.refresh(); }
  };
  const remove = async (row: StudentRow, typed: string) => {
    setBusy(row.id); setMsg("");
    const r = await deleteStudent(row.id, typed).catch(() => ({ ok: false, message: "Something went wrong. Try again." }));
    setBusy(null); setMsg(r.ok ? `${row.name}'s account was deleted.` : r.message);
    if (r.ok) { setDialog(null); router.refresh(); }
  };

  // The ⋯ menu: one shared popover (closes on outside click and Escape), placed under the button that opened it.
  const openMenu = (row: StudentRow, btn: HTMLButtonElement) => {
    trigger.current = btn; setMenu(row);
    const el = menuEl.current!, b = btn.getBoundingClientRect();
    el.style.top = `${Math.min(b.bottom + 6, innerHeight - 200)}px`;
    el.style.left = `${Math.max(8, b.right - 220)}px`;
    el.showPopover();
    requestAnimationFrame(() => el.querySelector<HTMLElement>("[role=menuitem]")?.focus());
  };
  const closeMenu = () => menuEl.current?.hidePopover();
  const menuKeys = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...menuEl.current!.querySelectorAll<HTMLElement>("[role=menuitem]")];
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
  };
  const copyPhone = async (row: StudentRow) => {
    closeMenu();
    if (!row.phone) return setMsg(`${row.name} hasn't added a phone number yet.`);
    await navigator.clipboard.writeText(row.phone).then(() => setMsg(`Copied ${row.name}'s number.`), () => setMsg(phoneText(row.phone)));
  };
  const statCard = (key: Status | "all", n: number, label: string, yellow = false) => (
    <button type="button" className={`ad-stat ad-statBtn${yellow ? " ad-statY" : ""}`} aria-pressed={status === key} onClick={() => setStatus(status === key ? "all" : key)}>
      <b>{n}</b><span>{label}</span>
    </button>
  );
  const sortBtn = (key: "name" | "joined", label: string) => {
    const on = sort.key === key;
    return (
      <button type="button" className="ad-sort" data-on={on || undefined} onClick={() => setSort({ key, dir: on ? (sort.dir === 1 ? -1 : 1) : key === "name" ? 1 : -1 })}>
        {label} <span aria-hidden="true">{on ? (sort.dir === 1 ? "↑" : "↓") : "↕"}</span>
      </button>
    );
  };

  return (
    <>
      <header className="ad-header">
        <div>
          <h1 className="ad-h1">Students</h1>
          <p className="ad-meta">{rows.length} students · AI-ML · phone numbers are visible to admins only</p>
        </div>
        <div className="ad-actions ad-phoneHide">
          <Link className="ad-btnLine" href="/admin/bulk">Bulk register (CSV)</Link>
          <a className="ad-btnLine" href="/admin/students/export" download>Export CSV</a>
        </div>
      </header>

      <div className="ad-chipRow ad-phoneOnly" role="group" aria-label="Filter by status">
        {([["all", `All ${counts.all}`], ["pending", `Waiting ${counts.pending}`], ["active", `Active ${counts.active}`], ["suspended", `Blocked ${counts.suspended}`]] as const).map(([k, l]) => (
          <button key={k} type="button" className="ad-pChip" aria-pressed={status === k} onClick={() => setStatus(status === k && k !== "all" ? "all" : k)}>{k === "pending" && <span className="ad-dot" aria-hidden="true" />}{l}</button>
        ))}
      </div>
      {classes.length > 0 && (
        <div className="ad-chipRow ad-phoneOnly" role="group" aria-label="Filter by class">
          <button type="button" className="ad-pChip" aria-pressed={klass === "all"} onClick={() => setKlass("all")}>All classes</button>
          {classes.map(([k, n]) => <button key={k} type="button" className="ad-pChip" aria-pressed={klass === k} onClick={() => setKlass(klass === k ? "all" : k)}>{k} · {n}</button>)}
        </div>
      )}

      <section className="ad-stats ad-phoneHide" aria-label="Filter by status">
        {statCard("all", counts.all, "students in the class")}
        {statCard("pending", counts.pending, "waiting for approval", true)}
        {statCard("active", counts.active, "active")}
        {statCard("suspended", counts.suspended, "blocked")}
      </section>

      {classes.length > 0 && (
        <section className="ad-card ad-byClass ad-phoneHide" aria-label="By year and section">
          <span className="ad-strong">By year and section</span>
          {classes.map(([k, n]) => (
            <button key={k} type="button" className="ad-chip" data-on={klass === k || undefined} aria-pressed={klass === k} onClick={() => setKlass(klass === k ? "all" : k)}>
              <span className="ad-chipMono">{k} · {n}</span>
            </button>
          ))}
        </section>
      )}

      <div className="ad-filters">
        <label className="ad-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" /><path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          <span className="ad-sr">Search students</span>
          <input ref={search} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or roll number" />
          <kbd className="ad-kbd" aria-hidden="true">/</kbd>
        </label>
        <label className="ad-select ad-phoneHide"><span className="ad-sr">Year and section</span>
          <select value={klass} onChange={(e) => setKlass(e.target.value)}><option value="all">Class: All</option>{classes.map(([k]) => <option key={k} value={k}>{k}</option>)}</select>
        </label>
        <label className="ad-select ad-phoneHide"><span className="ad-sr">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as Status | "all")}>
            <option value="all">Status: All</option><option value="pending">Waiting</option><option value="active">Active</option><option value="suspended">Blocked</option>
          </select>
        </label>
      </div>

      <p className="ad-meta ad-live" role="status">{msg}</p>

      {/* Phones (Figma B6): one-tap rows; tapping opens the student sheet (B7). */}
      <ul className="ad-pList ad-phoneOnly" aria-label="Students">
        {shown.length === 0 && <li><p className="ad-meta" style={{ padding: 16 }}>{rows.length ? "No students match." : "No students yet."}</p></li>}
        {shown.map((r) => (
          <li key={r.id} aria-busy={busy === r.id || undefined}>
            <button type="button" className="ad-pRow" onClick={() => setSheet(r)} aria-label={`${r.name}, ${LABEL[r.status]}. Open details`}>
              <span className="ad-av" data-wait={r.status === "pending" || undefined} aria-hidden="true">{r.name[0]?.toUpperCase()}</span>
              <span className="ad-pText">
                <span className="ad-pName">{r.name}</span>
                <span className="ad-pMeta" data-bad={r.status === "suspended" || undefined}>{r.status === "suspended" ? r.note : `${r.roll} · ${r.year ? `${Y[r.year]} ${r.section ?? ""}` : "—"}`}</span>
              </span>
            </button>
            {r.status === "pending" ? <button type="button" className="ad-btnLine ad-small" disabled={busy === r.id} onClick={() => act(r, "active")}>Approve</button>
              : <span className={`ad-badge ad-badge-${r.status}`}>{LABEL[r.status]}</span>}
          </li>
        ))}
      </ul>

      <section className="ad-card ad-tableCard ad-phoneHide" aria-label="Students">
        {shown.length === 0 ? <p className="ad-empty">{rows.length ? "No students match. Clear the search or filters." : "No students yet. Import the class list or use Bulk register."}</p> : (
          <div className="ad-tableWrap">
            <table className="ad-table ad-students">
              <thead>
                <tr>
                  <th scope="col" aria-sort={sort.key === "name" ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>{sortBtn("name", "Name")}</th>
                  <th scope="col">Roll no</th><th scope="col">Year</th><th scope="col">Phone</th><th scope="col">Email</th><th scope="col">Status</th>
                  <th scope="col" aria-sort={sort.key === "joined" ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>{sortBtn("joined", "Joined")}</th>
                  <th scope="col"><span className="ad-sr">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} aria-busy={busy === r.id || undefined}>
                    <td><p className="ad-strong">{r.name}</p><p className={r.status === "suspended" ? "ad-noteBad" : "ad-note"}>{r.note}</p></td>
                    <td className="ad-brk" aria-hidden="true" />
                    <td className="ad-num">{r.roll}</td>
                    <td className="ad-num">{r.year ? `${Y[r.year]} ${r.section ?? ""}` : "—"}</td>
                    <td className="ad-num">{phoneText(r.phone)}</td>
                    <td className="ad-email" title={r.email}>{r.email}</td>
                    <td><span className={`ad-badge ad-badge-${r.status}`}>{LABEL[r.status]}</span></td>
                    <td className="ad-num">{day(r.joined)}</td>
                    <td>
                      <div className="ad-rowActs">
                        {r.status === "pending" && <button type="button" className="ad-btnLine ad-small" disabled={busy === r.id} onClick={() => act(r, "active")}>Approve</button>}
                        {r.status === "suspended" && <button type="button" className="ad-btnLine ad-small" disabled={busy === r.id} onClick={() => act(r, "active")}>Give access</button>}
                        <button type="button" className="ad-iconBtn" aria-label={`More actions for ${r.name}`} title="More actions" aria-haspopup="menu"
                          aria-expanded={menu?.id === r.id} onClick={(e) => openMenu(r, e.currentTarget)}>
                          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.8" fill="currentColor" /><circle cx="12" cy="12" r="1.8" fill="currentColor" /><circle cx="19" cy="12" r="1.8" fill="currentColor" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="ad-meta ad-tableFoot">Showing {shown.length} of {rows.length} · {sort.key === "joined" ? (sort.dir === -1 ? "newest first" : "oldest first") : sort.dir === 1 ? "A to Z" : "Z to A"}</p>
      </section>

      <div ref={menuEl} popover="auto" className="ad-menu" role="menu" aria-label={menu ? `Actions for ${menu.name}` : "Actions"} onKeyDown={menuKeys}
        onToggle={(e) => { if ((e as unknown as ToggleEvent).newState === "closed") { setMenu(null); trigger.current?.focus(); } }}>
        {menu && <>
          {menu.status === "active" && <button type="button" role="menuitem" onClick={() => { closeMenu(); setDialog({ kind: "block", row: menu }); }}>Block student…</button>}
          {menu.status === "pending" && <button type="button" role="menuitem" onClick={() => { closeMenu(); act(menu, "suspended"); }}>Reject</button>}
          <button type="button" role="menuitem" onClick={() => copyPhone(menu)}>Copy phone number</button>
          <Link role="menuitem" href={`/admin/audit?q=${encodeURIComponent(menu.roll)}`} onClick={closeMenu}>View in audit log</Link>
          <hr />
          <button type="button" role="menuitem" className="ad-menuDanger" onClick={() => { closeMenu(); setDialog({ kind: "delete", row: menu }); }}>Delete account…</button>
        </>}
      </div>

      {sheet && <StudentSheet key={sheet.id} row={rows.find((x) => x.id === sheet.id) ?? sheet} busy={busy === sheet.id} onClose={() => setSheet(null)}
        onAct={(to) => act(sheet, to)} onAsk={(kind) => { setSheet(null); setDialog({ kind, row: sheet }); }} onCopy={() => copyPhone(sheet)} />}
      {dialog && <ConfirmDialog key={dialog.kind + dialog.row.id} {...dialog} busy={busy === dialog.row.id} onClose={() => setDialog(null)}
        onBlock={(reason) => act(dialog.row, "suspended", reason)} onDelete={(typed) => remove(dialog.row, typed)} />}
    </>
  );
}

/** Figma B2: Delete (type the roll number) and Block (optional reason). Native modal dialog: Escape cancels,
 *  a click outside does nothing, Cancel takes focus first. */
function ConfirmDialog({ kind, row, busy, onClose, onBlock, onDelete }: { kind: "block" | "delete"; row: StudentRow; busy: boolean; onClose: () => void; onBlock: (reason: string) => void; onDelete: (typed: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const [text, setText] = useState("");
  // showModal() moves focus to the first field; Cancel (the safe choice) takes it instead.
  useEffect(() => { ref.current?.showModal(); cancel.current?.focus(); }, []);
  const del = kind === "delete", ready = !del || text.trim().toUpperCase() === row.roll;
  return (
    <dialog ref={ref} className="ad-dialog" aria-labelledby="dlg-title" aria-describedby="dlg-body" onClose={onClose}>
      <form method="dialog" onSubmit={(e) => { e.preventDefault(); if (!ready || busy) return; if (del) onDelete(text); else onBlock(text); }}>
        <h2 id="dlg-title" className="ad-dlgTitle">{del ? `Delete ${row.name}'s account?` : `Block ${row.name}?`}</h2>
        <p id="dlg-body" className="ad-meta">{del
          ? "This removes their profile, phone, notes, progress, photo and sign-in for good. It can't be undone, and it's written to the audit log."
          : "They can't sign in until an admin gives them access again. They see a message that their account is blocked."}</p>
        <label className="ad-label" htmlFor="dlg-input">{del ? <>Type <span className="ad-numInline">{row.roll}</span> to confirm</> : <>Reason <span className="ad-meta">(shown to admins only)</span></>}</label>
        <input id="dlg-input" className="ad-input" value={text} onChange={(e) => setText(e.target.value)} maxLength={del ? 15 : 200}
          autoCapitalize={del ? "characters" : undefined} autoComplete="off" spellCheck={false} placeholder={del ? row.roll : "e.g. Not in this class"} />
        <div className="ad-dlgActs">
          <button ref={cancel} type="button" className="ad-btnGhost" onClick={() => ref.current?.close()}>Cancel</button>
          <button className={del ? "ad-btnDanger" : "ad-btnInk"} disabled={!ready || busy}>{busy ? (del ? "Deleting…" : "Blocking…") : del ? "Delete account" : "Block student"}</button>
        </div>
      </form>
    </dialog>
  );
}

/** Figma B7: tap a student on a phone. Native modal dialog sliding up; Escape or a tap outside closes it. */
function StudentSheet({ row, busy, onClose, onAct, onAsk, onCopy }: { row: StudentRow; busy: boolean; onClose: () => void; onAct: (to: "active" | "suspended") => void; onAsk: (k: "block" | "delete") => void; onCopy: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  const close = () => ref.current?.close();
  return (
    <dialog ref={ref} className="ad-sheet" aria-labelledby="sheet-name" onClose={onClose} onClick={(e) => { if (e.target === ref.current) close(); }}>
      <div className="ad-sheetInner">
        <span className="ad-grab" aria-hidden="true" />
        <div className="ad-who">
          <span className="ad-av" data-wait={row.status === "pending" || undefined} aria-hidden="true">{row.name[0]?.toUpperCase()}</span>
          <div className="ad-pText"><p id="sheet-name" className="ad-whoName">{row.name}</p><p className="ad-mono">{row.roll} · {row.year ? `${Y[row.year]} ${row.section ?? ""}` : "—"} · {day(row.joined)}</p></div>
          <span className={`ad-badge ad-badge-${row.status}`}>{LABEL[row.status]}</span>
        </div>
        {row.status !== "active" && <p className={row.status === "suspended" ? "ad-noteBad" : "ad-note"} style={{ margin: 0 }}>{row.note}</p>}
        <div className="ad-contact">
          <div><p className="ad-label2">Mobile</p><p className="ad-big">{phoneText(row.phone)}</p></div>
          {row.phone && (
            <div className="ad-callRow">
              <a href={`tel:+91${row.phone}`}>Call</a>
              <a href={`https://wa.me/91${row.phone}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
              <button type="button" onClick={onCopy}>Copy</button>
            </div>
          )}
          <div><p className="ad-label2">Email</p><p style={{ margin: 0, fontSize: 14, fontWeight: 500, overflowWrap: "anywhere" }}>{row.email || "—"}</p></div>
        </div>
        {row.status === "pending" && <button type="button" className="ad-btnInk" disabled={busy} onClick={() => onAct("active")}>{busy ? "Approving…" : "Approve"}</button>}
        {row.status === "suspended" && <button type="button" className="ad-btnInk" disabled={busy} onClick={() => onAct("active")}>{busy ? "Giving access…" : "Give access"}</button>}
        <div className="ad-sheetList">
          {row.status === "active" && <button type="button" onClick={() => onAsk("block")}>Block student…</button>}
          {row.status === "pending" && <button type="button" disabled={busy} onClick={() => onAct("suspended")}>Reject</button>}
          <Link href={`/admin/audit?q=${encodeURIComponent(row.roll)}`}>View in audit log</Link>
          <button type="button" className="ad-menuDanger" onClick={() => onAsk("delete")}>Delete account…</button>
        </div>
        <button type="button" className="ad-btnLine" onClick={close}>Done</button>
      </div>
    </dialog>
  );
}
