"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFWorker } from "pdfjs-dist";
import { touchChapter } from "@/app/actions/learn";
import { Icon, Svg } from "./bits";

// One pdf.js worker for the whole tab: starting a worker costs ~150 ms, so only the first PDF of a visit pays it.
// (Was: a new worker per PDF, never closed.)
let pdfjsReady: Promise<{ pdfjs: typeof import("pdfjs-dist"); worker: PDFWorker }> | null = null;
function loadPdfjs() {
  pdfjsReady ??= import("pdfjs-dist").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    return { pdfjs, worker: new pdfjs.PDFWorker() };
  }).catch((e) => { pdfjsReady = null; throw e; }); // a failed load is retried on the next open
  return pdfjsReady;
}

/** For pages that list PDFs: gets pdf.js and its worker (~500 KB, cached after the first time) ready while the
 *  student is still reading the list, so tapping "Read" doesn't wait for them. Skipped when the phone asks to save data. */
export function useWarmPdfReader() {
  useEffect(() => {
    if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return;
    const warm = () => { loadPdfjs().catch(() => {}); };
    if ("requestIdleCallback" in window) { const id = requestIdleCallback(warm, { timeout: 3000 }); return () => cancelIdleCallback(id); }
    const t = setTimeout(warm, 1500); // Safari has no requestIdleCallback
    return () => clearTimeout(t);
  }, []);
}

/** Renders one PDF page at a time to fit the screen; remembers the page for "Resume at page N". */
export function PdfReader({ url, materialId, chapterId, startPage = 1 }: { url: string; materialId?: string; chapterId?: string; startPage?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const drawnWidth = useRef(0);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(startPage);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let alive = true;
    let task: { destroy(): Promise<void> } | null = null;
    (async () => {
      try {
        const { pdfjs, worker } = await loadPdfjs();
        if (!alive) return;
        // One plain GET (no streaming / range requests), so it reuses the download the server page already started
        // with preload(). shortcut: very large PDFs then load whole before page 1; ours are compressed to a few MB.
        const t = pdfjs.getDocument({ url, worker, isEvalSupported: false, disableRange: true, disableStream: true });
        task = t;
        const d = await t.promise;
        if (!alive) return;
        setDoc(d); setPage((p) => Math.min(Math.max(1, p), d.numPages)); setState("ready");
      } catch {
        pdfjsReady = null; // in case the shared worker broke: the next open starts a fresh one
        if (alive) setState("error");
      }
    })();
    // Free the document in the shared worker when leaving the page (the worker itself stays for the next PDF).
    return () => { alive = false; task?.destroy().catch(() => {}); };
  }, [url]);

  const draw = useCallback(async () => {
    if (!doc || !canvas.current || !box.current) return;
    const width = box.current.clientWidth;
    drawnWidth.current = width;
    const pg = await doc.getPage(page);
    const fit = width / pg.getViewport({ scale: 1 }).width;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vp = pg.getViewport({ scale: fit * dpr });
    const c = canvas.current;
    c.width = vp.width; c.height = vp.height; c.style.width = `${vp.width / dpr}px`;
    await pg.render({ canvasContext: c.getContext("2d")!, viewport: vp }).promise;
  }, [doc, page]);

  useEffect(() => { draw().catch(() => {}); }, [draw]);
  useEffect(() => {
    // Only a new width needs a redraw; page and file changes are drawn by the effect above.
    const ro = new ResizeObserver(() => { if (box.current && box.current.clientWidth !== drawnWidth.current) draw().catch(() => {}); });
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
  }, [draw]);
  // Save the page a moment after it settles, not on every flick.
  useEffect(() => {
    if (state !== "ready" || !chapterId) return; // papers have no chapter progress
    const t = setTimeout(() => touchChapter(chapterId, materialId, page).catch(() => {}), 800);
    return () => clearTimeout(t);
  }, [page, state, chapterId, materialId]);

  const total = doc?.numPages ?? 0;
  const go = (d: number) => setPage((p) => Math.min(Math.max(1, p + d), total || 1));
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  return (
    <div className="ap-reader">
      <div ref={box} className="ap-page">
        {state === "loading" && <p className="ap-meta">Loading file…</p>}
        {state === "error" && <p className="ap-empty">Couldn&apos;t open this file. Go back and try again.</p>}
        <canvas ref={canvas} aria-label={`Page ${page} of ${total}`} hidden={state !== "ready"} />
      </div>
      {state === "ready" && (
        <div className="ap-readerBar">
          <button type="button" className="ap-iconBtn" onClick={() => go(-1)} disabled={page <= 1} aria-label="Previous page"><Svg d={Icon.left} /></button>
          <span className="ap-meta" aria-live="polite">Page {page} of {total}</span>
          <button type="button" className="ap-iconBtn" onClick={() => go(1)} disabled={page >= total} aria-label="Next page"><Svg d={Icon.right} /></button>
        </div>
      )}
    </div>
  );
}
