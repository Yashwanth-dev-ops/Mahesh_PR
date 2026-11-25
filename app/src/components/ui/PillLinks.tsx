"use client";

import Link from "next/link";
import { useRef, type ReactNode } from "react";
import "./pill.css";

// The pill leans a few px toward a mouse pointer and eases back on leave (no effect on touch or reduced motion).
function useMagnet<T extends HTMLElement = HTMLAnchorElement>(strength: number) {
  const ref = useRef<T>(null);
  const cur = useRef({ x: 0, y: 0, tx: 0, ty: 0, raf: 0 });

  const tick = () => {
    const c = cur.current;
    c.x += (c.tx - c.x) * 0.3;
    c.y += (c.ty - c.y) * 0.3;
    if (ref.current) ref.current.style.translate = `${c.x.toFixed(2)}px ${c.y.toFixed(2)}px`;
    c.raf = Math.abs(c.tx - c.x) + Math.abs(c.ty - c.y) > 0.1 ? requestAnimationFrame(tick) : 0;
  };
  const aim = (tx: number, ty: number) => {
    Object.assign(cur.current, { tx, ty });
    if (!cur.current.raf) cur.current.raf = requestAnimationFrame(tick);
  };

  return {
    ref,
    onPointerMove: (e: React.PointerEvent<T>) => {
      if (e.pointerType !== "mouse" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const r = e.currentTarget.getBoundingClientRect();
      aim((e.clientX - r.left - r.width / 2) * strength, (e.clientY - r.top - r.height / 2) * strength * 1.4);
    },
    onPointerLeave: () => aim(0, 0),
  };
}

function Arrow({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M4 10h11m0 0-4.5-4.5M15 10l-4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Primary call to action: yellow pill, arrow disc, colour flood + arrow swap on hover/press. */
export function PillCTA({ href, children }: { href: string; children: ReactNode }) {
  const magnet = useMagnet(0.22);
  return (
    <Link href={href} {...magnet} className={`pill-pill pill-cta`}>
      <span className="pill-flood" aria-hidden="true" />
      <span>{children}</span>
      <span className="pill-disc" aria-hidden="true">
        <Arrow className="pill-arrow" />
        <Arrow className={`pill-arrow pill-arrowIn`} />
      </span>
    </Link>
  );
}

/** Same pill as PillCTA, as a form submit button. */
export function PillButton({ children }: { children: ReactNode }) {
  const magnet = useMagnet<HTMLButtonElement>(0.22);
  return (
    <button type="submit" {...magnet} className={`pill-pill pill-cta pill-btn`}>
      <span className="pill-flood" aria-hidden="true" />
      <span>{children}</span>
      <span className="pill-disc" aria-hidden="true">
        <Arrow className="pill-arrow" />
        <Arrow className={`pill-arrow pill-arrowIn`} />
      </span>
    </button>
  );
}

/** Nav login: yellow pill that fills with warm white from the bottom on hover/press. */
export function LoginPill({ href, children }: { href: string; children: ReactNode }) {
  const magnet = useMagnet(0.15);
  return (
    <Link href={href} {...magnet} className={`pill-pill pill-login`}>
      <span className="pill-fill" aria-hidden="true" />
      {children}
    </Link>
  );
}
