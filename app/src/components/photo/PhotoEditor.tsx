"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./photo-editor.css";

// Figma M5 (phone) / M6 (laptop), approved 2026-11-25. LinkedIn-style: the circle stays still and the photo moves
// under it. Fingers, mouse, keys and the two sliders all change the same view, so they always agree.
type View = { x: number; y: number; zoom: number; angle: number }; // x/y: photo centre offset from the circle centre, px
const ZOOM_MIN = 1, ZOOM_MAX = 4, ANGLE_MAX = 45, OUT = 512, RING = 24; // the circle sits RING px inside the square stage
const START: View = { x: 0, y: 0, zoom: 1, angle: 0 };
const clampN = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Keeps the circle fully covered by the photo: the circle is rotation-proof, so check in the photo's own frame. */
export function coverClamp(v: View, img: { w: number; h: number }, d: number, soft = false): View {
  const base = Math.max(d / img.w, d / img.h), s = base * v.zoom, rad = (v.angle * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const lx = Math.max(0, (img.w * s - d) / 2), ly = Math.max(0, (img.h * s - d) / 2);
  const band = (p: number, lim: number) => (Math.abs(p) <= lim ? p : Math.sign(p) * (lim + (soft ? (Math.abs(p) - lim) * 0.35 : 0)));
  const ox = band(v.x * cos + v.y * sin, lx), oy = band(-v.x * sin + v.y * cos, ly); // into the photo's frame, limit…
  return { ...v, x: ox * cos - oy * sin, y: ox * sin + oy * cos };                     // …and back
}

export function PhotoEditor({ file, title = "Adjust your photo", saving = false, onCancel, onSave, onChangePhoto, onDelete }: {
  file: File; title?: string; saving?: boolean;
  onCancel: () => void; onSave: (cropped: File) => void; onChangePhoto?: (f: File) => void; onDelete?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const imgEl = useRef<HTMLImageElement>(null);
  const url = useMemo(() => URL.createObjectURL(file), [file]); // a new file remounts the editor (key), so no reset here
  const [img, setImg] = useState<{ w: number; h: number } | null>(null);
  const [size, setSize] = useState(300); // stage edge, px
  const [view, setView] = useState<View>(START);
  const [settle, setSettle] = useState(false); // true = animate to the next view (spring-back, reset, keys)
  const raw = useRef<View>(START); // the finger-driven view before the soft edge
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; ang: number; mid: { x: number; y: number }; v: View } | null>(null);
  const lastTap = useRef(0);
  const d = size - RING * 2;

  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  useEffect(() => {
    const el = stage.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize(el.clientWidth)); ro.observe(el); return () => ro.disconnect();
  }, []);

  const apply = useCallback((v: View, opts: { soft?: boolean; animate?: boolean } = {}) => {
    if (!img) return;
    const next = coverClamp({ ...v, zoom: clampN(v.zoom, ZOOM_MIN, ZOOM_MAX), angle: clampN(v.angle, -ANGLE_MAX, ANGLE_MAX) }, img, d, opts.soft);
    if (!opts.soft) raw.current = next;
    setSettle(!!opts.animate); setView(next);
  }, [img, d]);

  // Trackpad pinch (ctrl+wheel) and the mouse wheel zoom; registered by hand so it can stop the page scrolling.
  useEffect(() => {
    const el = stage.current; if (!el) return;
    const wheel = (e: WheelEvent) => { e.preventDefault(); const r = raw.current; apply({ ...r, zoom: r.zoom * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)) }); };
    el.addEventListener("wheel", wheel, { passive: false }); return () => el.removeEventListener("wheel", wheel);
  }, [apply]);

  const rel = (e: { clientX: number; clientY: number }) => { const b = stage.current!.getBoundingClientRect(); return { x: e.clientX - b.left - b.width / 2, y: e.clientY - b.top - b.height / 2 }; };
  const startPinch = () => {
    const [a, b] = [...pointers.current.values()];
    pinch.current = { dist: Math.hypot(b.x - a.x, b.y - a.y), ang: Math.atan2(b.y - a.y, b.x - a.x), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, v: { ...raw.current } };
  };
  const down = (e: React.PointerEvent) => {
    if (pointers.current.size >= 2) return; // a third finger joining mid-gesture is ignored, so nothing jumps
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {} // keeps the drag if the finger leaves the box; never fatal
    pointers.current.set(e.pointerId, rel(e));
    if (pointers.current.size === 2) startPinch();
    else { // double-tap / double-click: 1× ↔ 2×
      const now = Date.now();
      if (now - lastTap.current < 300) { const r = raw.current; apply({ ...r, zoom: r.zoom > 1.5 ? 1 : 2, x: r.zoom > 1.5 ? 0 : r.x * 2, y: r.zoom > 1.5 ? 0 : r.y * 2 }, { animate: true }); lastTap.current = 0; }
      else lastTap.current = now;
    }
  };
  const move = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId); if (!prev) return;
    const cur = rel(e); pointers.current.set(e.pointerId, cur);
    if (pointers.current.size === 1) { // drag: 1:1 with the finger; soft past the edges
      raw.current = { ...raw.current, x: raw.current.x + cur.x - prev.x, y: raw.current.y + cur.y - prev.y };
      apply(raw.current, { soft: true });
    } else if (pinch.current) { // pinch zooms about the fingers' midpoint, twist straightens
      const [a, b] = [...pointers.current.values()], p = pinch.current;
      const zoom = clampN(p.v.zoom * (Math.hypot(b.x - a.x, b.y - a.y) / p.dist), ZOOM_MIN, ZOOM_MAX), k = zoom / p.v.zoom;
      let angle = p.v.angle + ((Math.atan2(b.y - a.y, b.x - a.x) - p.ang) * 180) / Math.PI;
      if (Math.abs(angle) < 3) angle = 0; // snaps straight
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      raw.current = { zoom, angle, x: mid.x - (p.mid.x - p.v.x) * k, y: mid.y - (p.mid.y - p.v.y) * k };
      apply(raw.current, { soft: true });
    }
  };
  const up = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 1) pinch.current = null; // keep dragging with the finger that's left
    if (pointers.current.size === 0) { pinch.current = null; apply(raw.current, { animate: true }); } // spring back inside
  };
  const keys = (e: React.KeyboardEvent) => {
    const r = raw.current, step = e.shiftKey ? 16 : 4;
    const k: Record<string, View> = { ArrowLeft: { ...r, x: r.x - step }, ArrowRight: { ...r, x: r.x + step }, ArrowUp: { ...r, y: r.y - step }, ArrowDown: { ...r, y: r.y + step }, "+": { ...r, zoom: r.zoom + 0.1 }, "=": { ...r, zoom: r.zoom + 0.1 }, "-": { ...r, zoom: r.zoom - 0.1 } };
    if (k[e.key]) { e.preventDefault(); apply(k[e.key], { animate: true }); }
  };

  const save = async () => {
    if (!img || !imgEl.current) return;
    const c = document.createElement("canvas"); c.width = c.height = OUT;
    const ctx = c.getContext("2d")!, k = OUT / d, s = Math.max(d / img.w, d / img.h) * view.zoom * k;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, OUT, OUT);
    ctx.translate(OUT / 2 + view.x * k, OUT / 2 + view.y * k); ctx.rotate((view.angle * Math.PI) / 180);
    ctx.imageSmoothingQuality = "high"; ctx.drawImage(imgEl.current, (-img.w * s) / 2, (-img.h * s) / 2, img.w * s, img.h * s);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.9));
    if (blob) onSave(new File([blob], "photo.jpg", { type: "image/jpeg" }));
  };

  // One transform for the stage and every preview: k scales stage pixels down to the preview's size.
  const look = (k: number): React.CSSProperties => img ? {
    width: img.w, height: img.h,
    transform: `translate(-50%, -50%) translate(${view.x * k}px, ${view.y * k}px) rotate(${view.angle}deg) scale(${Math.max(d / img.w, d / img.h) * view.zoom * k})`,
  } : { opacity: 0 };
  const preview = (px: number, label: string) => (
    <figure className="pe-prev"><span className="pe-prevCircle" style={{ width: px, height: px }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- live preview of the unsaved crop */}
      {url && <img src={url} alt="" draggable={false} style={look(px / d)} />}
    </span><figcaption>{label}</figcaption></figure>
  );

  return (
    <dialog ref={dialog} className="pe-dialog" aria-labelledby="pe-title" onClose={onCancel}>
      <div className="pe-bar">
        <button type="button" className="pe-link" onClick={() => dialog.current?.close()}>Cancel</button>
        <h2 id="pe-title" className="pe-title">{title}</h2>
        <button type="button" className="pe-link" onClick={() => apply(START, { animate: true })}>Reset</button>
      </div>
      <div className="pe-body">
        <div ref={stage} className="pe-stage" data-settle={settle || undefined} tabIndex={0} role="img"
          aria-label="Photo position. Drag to move, pinch or scroll to zoom, arrow keys to nudge, plus and minus to zoom." aria-describedby="pe-hint"
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={keys} onTransitionEnd={() => setSettle(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- local, unsaved photo being cropped */}
          {url && <img ref={imgEl} src={url} alt="" draggable={false} className="pe-img" style={look(1)}
            onLoad={(e) => { const t = e.currentTarget; setImg({ w: t.naturalWidth, h: t.naturalHeight }); }} />}
          <span className="pe-ring" style={{ inset: RING }} aria-hidden="true"><span className="pe-grid" /></span>
          <span id="pe-hint" className="pe-hint"><span className="pe-hintTouch">Pinch to zoom · drag · twist</span><span className="pe-hintMouse">Drag to move · scroll to zoom</span></span>
        </div>
        <div className="pe-side">
          <label className="pe-slider"><span className="pe-sRow"><span>Zoom</span><output>{view.zoom.toFixed(1)}×</output></span>
            <span className="pe-sTrack"><span aria-hidden="true">−</span>
              <input type="range" min={ZOOM_MIN} max={ZOOM_MAX} step={0.01} value={view.zoom} onChange={(e) => apply({ ...raw.current, zoom: +e.target.value })} />
              <span aria-hidden="true">+</span></span></label>
          <label className="pe-slider"><span className="pe-sRow"><span>Straighten</span><output>{Math.round(view.angle)}°</output></span>
            <span className="pe-sTrack"><span aria-hidden="true">↺</span>
              <input type="range" min={-ANGLE_MAX} max={ANGLE_MAX} step={1} value={view.angle} onChange={(e) => apply({ ...raw.current, angle: +e.target.value })} />
              <span aria-hidden="true">↻</span></span></label>
          <div className="pe-prevs" aria-label="How it looks">{preview(72, "Profile")}{preview(40, "Card")}{preview(28, "Top bar")}</div>
          <div className="pe-acts">
            {onDelete && <button type="button" className="pe-danger" onClick={onDelete} disabled={saving}>Delete photo</button>}
            {onChangePhoto && (
              <label className="pe-btnLine">Change photo
                <input type="file" accept="image/jpeg,image/png,image/webp" className="pe-file" onChange={(e) => { const f = e.currentTarget.files?.[0]; if (f) onChangePhoto(f); }} />
              </label>
            )}
            <button type="button" className="pe-btnSave" onClick={save} disabled={!img || saving}>{saving ? "Saving…" : "Save photo"}</button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
