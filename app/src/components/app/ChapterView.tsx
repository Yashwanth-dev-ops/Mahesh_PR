"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { materialLink, setChapterDone, setKnown, touchChapter } from "@/app/actions/learn";
import { Icon, Svg } from "./bits";
import { useWarmPdfReader } from "./PdfReader";

type Section = { id: string; heading: string; body: string };
type Material = { id: string; title: string; type: string; size_bytes: number | null; page_count: number | null; url: string | null };
type Question = { id: string; question: string; answer: string };
type Nav = { href: string; title: string } | null;

// Wraps matches of `q` in <mark>, case-insensitive. No HTML is injected: we split text and render nodes.
function highlight(text: string, q: string) {
  if (!q) return text;
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"));
  return parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p));
}
const size = (b: number | null) => (!b ? "" : b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export function ChapterView(p: {
  chapterId: string; label: string; title: string; done: boolean; sections: Section[]; materials: Material[];
  questions: Question[]; known: string[]; prev: Nav; next: Nav;
}) {
  const [q, setQ] = useState("");
  const [done, setDone] = useState(p.done);
  const [known, setKnownIds] = useState(() => new Set(p.known));
  const [msg, setMsg] = useState("");
  const term = q.trim().length >= 2 ? q.trim() : "";
  const shown = useMemo(
    () => (term ? p.sections.filter((s) => (s.heading + " " + s.body).toLowerCase().includes(term.toLowerCase())) : p.sections),
    [term, p.sections],
  );

  useEffect(() => { touchChapter(p.chapterId).catch(() => {}); }, [p.chapterId]); // feeds "Continue learning"
  useWarmPdfReader();

  const toggleDone = async () => {
    const next = !done;
    setDone(next);
    const r = await setChapterDone(p.chapterId, next).catch(() => ({ ok: false }));
    if (!r.ok) { setDone(!next); setMsg("Couldn't save. Check your connection."); return; }
    setMsg(next ? "Chapter marked as done." : "Marked as not done.");
  };
  const toggleKnown = async (id: string) => {
    const on = !known.has(id);
    setKnownIds((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });
    const r = await setKnown(id, on).catch(() => ({ ok: false }));
    if (!r.ok) setKnownIds((s) => { const n = new Set(s); if (on) n.delete(id); else n.add(id); return n; });
  };
  const download = async (id: string) => {
    const { url } = await materialLink(id, true).catch(() => ({ url: null }));
    if (url) window.location.assign(url); else setMsg("This file isn't available right now.");
  };

  return (
    <article className="ap-chapterPage">
      <header className="ap-chHead">
        <p className="ap-kicker">{p.label}</p>
        <h1 className="ap-h1">{p.title}</h1>
      </header>

      {p.sections.length > 0 && (
        <section aria-label="Notes">
          <label className="ap-searchBox">
            <Svg d={Icon.search} size={18} />
            <span className="ap-sr">Search in this chapter</span>
            <input type="search" placeholder="Search in this chapter" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          {shown.length ? shown.map((s) => (
            <section key={s.id} className="ap-section">
              <h2 className="ap-h3">{highlight(s.heading, term)}</h2>
              {s.body.split(/\n{2,}/).map((para, i) => <p key={i}>{highlight(para, term)}</p>)}
            </section>
          )) : <p className="ap-empty">Nothing in this chapter matches &ldquo;{term}&rdquo;.</p>}
        </section>
      )}

      <section aria-labelledby="files-h" className="ap-block">
        <h2 id="files-h" className="ap-h2">Files</h2>
        {p.materials.length ? (
          <ul className="ap-files">
            {p.materials.map((m) => (
              <li key={m.id} className="ap-card ap-file">
                <Svg d={Icon.file} />
                <span className="ap-chText">
                  <span className="ap-chTitle">{m.title}</span>
                  <span className="ap-meta">{m.type === "link" ? "Link" : [m.page_count && `${m.page_count} ${m.page_count === 1 ? "page" : "pages"}`, size(m.size_bytes)].filter(Boolean).join(" · ")}</span>
                </span>
                {m.type === "link"
                  ? <a className="ap-btnLine" href={m.url!} target="_blank" rel="noopener noreferrer">Open</a>
                  : <>
                      <Link className="ap-btnLine" href={`/read/${m.id}`}>Read</Link>
                      <button type="button" className="ap-iconBtn" onClick={() => download(m.id)} aria-label={`Download ${m.title}`}><Svg d={Icon.download} size={18} /></button>
                    </>}
              </li>
            ))}
          </ul>
        ) : <p className="ap-empty">No files for this chapter yet. Uploads open in the next update.</p>}
      </section>

      {p.questions.length > 0 && (
        <section aria-labelledby="iq-h" className="ap-block">
          <h2 id="iq-h" className="ap-h2">Important questions <span className="ap-meta">· {known.size ? `${p.questions.filter((x) => known.has(x.id)).length} of ${p.questions.length} known` : `${p.questions.length}`}</span></h2>
          <ul className="ap-questions">
            {p.questions.map((x, i) => (
              <li key={x.id}>
                <details className="ap-card ap-q">
                  <summary><span className="ap-qNum">{i + 1}</span><span className="ap-qText">{x.question}</span></summary>
                  {x.answer && <p className="ap-answer">{x.answer}</p>}
                </details>
                <button type="button" className="ap-know" aria-pressed={known.has(x.id)} onClick={() => toggleKnown(x.id)}>
                  {known.has(x.id) ? <><Svg d={Icon.check} size={16} /> I know this</> : "I know this"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="ap-chFoot">
        <button type="button" className={done ? "ap-btnLine ap-wide" : "ap-btnInk ap-wide"} onClick={toggleDone} aria-pressed={done}>
          {done ? <><Svg d={Icon.check} size={18} /> Done</> : "Mark chapter as done"}
        </button>
        <p className="ap-meta" role="status">{msg}</p>
      </div>

      <nav className="ap-pager" aria-label="Chapters">
        {p.prev ? <Link href={p.prev.href} className="ap-card ap-pg"><span className="ap-caption">Previous</span><span>{p.prev.title}</span></Link> : <span />}
        {p.next ? <Link href={p.next.href} className="ap-card ap-pg ap-pgNext"><span className="ap-caption">Next</span><span>{p.next.title}</span></Link> : <span />}
      </nav>
    </article>
  );
}
