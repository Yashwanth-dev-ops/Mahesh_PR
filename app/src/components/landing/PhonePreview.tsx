"use client";

import { useEffect, useRef } from "react";
import { APP_NAME } from "@/lib/site";
import "./phone.css";

const icon = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const tabs: [string, React.ReactNode][] = [
  ["Home", <path key="h" d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10" />],
  ["Subjects", <path key="s" d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />],
  ["Papers", <path key="p" d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z M14 2v6h6" />],
  ["Notes", <path key="n" d="M12 20h9 M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />],
  ["Profile", <path key="r" d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />],
];

// Decorative preview of the student home screen (the real app's tabs and layout); hidden from assistive tech by
// its parent. Its demo session is one GSAP timeline (see playDemo); with reduced motion it stays a still home screen.
export function PhonePreview() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let revert = () => {};
    let gone = false;
    import("gsap").then(({ gsap }) => { if (!gone && ref.current) revert = playDemo(gsap, ref.current); });
    return () => { gone = true; revert(); };
  }, []);
  return (
    <div className="ph-screen" ref={ref}>
      <div className="ph-top">
        <span className="ph-mark">A</span>
        <span className="ph-name">{APP_NAME}</span>
        <span className="ph-ic"><svg width="22" height="22" viewBox="0 0 24 24" {...icon}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg></span>
        <span className="ph-ic"><svg width="22" height="22" viewBox="0 0 24 24" {...icon}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9 M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg><i className="ph-badge" /></span>
      </div>
      <div className="ph-body">
        <div className="ph-scroll">
        <div className="ph-h1">Good evening, Priya</div>
        <div className="ph-meta">III year · AI-ML · Section A</div>
        <div className="ph-cont">
          <span className="ph-k">CONTINUE LEARNING</span>
          <span className="ph-t">Machine Learning · Ch 3 Neural networks</span>
          <span className="ph-bar"><i /></span>
          <span className="ph-btn">Resume at page 14<i className="ph-tap" /></span>
        </div>
        <div className="ph-sec">Notices <u>See all</u></div>
        <div className="ph-new">
          <div className="ph-card">
            <span className="ph-c">PLACEMENT <em>· Just now</em></span>
            <b>Campus drive registration is open</b>
          </div>
        </div>
        <div className="ph-card">
          <span className="ph-c">EXAM <em>· 18 Nov</em></span>
          <b>Mid-2 exam timetable released</b>
          <p>Mid-2 exams for II and III year start on 2 December. Check your hall ticket by 28 November.</p>
        </div>
        <div className="ph-sec">Your subjects <u>All subjects</u></div>
        <div className="ph-card"><span className="ph-c">AI3103</span><b>Machine Learning</b><span className="ph-ch">3 chapters · 1 of 3 done</span></div>
        <div className="ph-card"><span className="ph-c">AI3104</span><b>Deep Learning</b><span className="ph-ch">3 chapters · 0 of 3 done</span></div>
        </div>
      </div>
      <div className="ph-nav">
        {tabs.map(([label, d], i) => (
          <span key={label} className={`ph-tab ${i === 0 ? "ph-on" : ""}`}>
            <svg width="22" height="22" viewBox="0 0 24 24" {...icon}>{d}</svg>
            {label}
          </span>
        ))}
      </div>
      <Reader />
      <i className="ph-veil" />
    </div>
  );
}

type Gsap = typeof import("gsap").gsap;
const DRAWER = "cubic-bezier(0.32,0.72,0,1)"; // iOS sheet curve, as in the app

/**
 * One 14 s student session on a single timeline, looping (the browser pauses it in hidden tabs):
 * tap Resume → reader slides in → swipe to page 15 → back → progress grows → a notice arrives →
 * scroll the feed → a quick refresh resets everything under a white veil.
 * Starts when the phone has landed (2.9 s into the first-visit intro, else 0.5 s).
 * Dev aid: /?freeze=<ms> pins it at that moment (same switch as the intro), for screenshots.
 */
function playDemo(gsap: Gsap, root: HTMLElement) {
  let seen: IntersectionObserver | undefined;
  const ctx = gsap.context(() => {
    const q = gsap.utils.selector(root);
    const playing = /^(pending|play)$/.test(document.documentElement.dataset.intro ?? "");
    const tap = (el: Element, at: number) => tl
      .fromTo(el, { autoAlpha: 0, scale: 1.4 }, { autoAlpha: 1, scale: 1, duration: 0.28 }, at)
      .to(el, { scale: 0.8, duration: 0.14 }, ">0.14")
      .to(el, { autoAlpha: 0, scale: 1, duration: 0.3 }, ">");

    // Start state = the home screen (the CSS resting state shows the "after" state for reduced motion).
    gsap.set(q(".ph-reader"), { xPercent: 100, x: 0 });
    gsap.set(q(".ph-pB"), { xPercent: 110, x: 0 });
    gsap.set(q(".ph-pg b"), { autoAlpha: (i: number) => (i === 0 ? 1 : 0) });
    gsap.set(q(".ph-bar i"), { scaleX: 0.74 });
    gsap.set(q(".ph-badge"), { scale: 0 });
    gsap.set(q(".ph-new"), { maxHeight: 0, autoAlpha: 0 });

    const tl = gsap.timeline({ delay: playing ? 2.9 : 0.5, repeat: -1, defaults: { ease: "power3.out" } });
    tap(q(".ph-btn .ph-tap")[0], 1.7);
    tl.to(q(".ph-btn"), { scale: 0.93, duration: 0.14, yoyo: true, repeat: 1 }, 2.24)
      .to(q(".ph-reader"), { xPercent: 0, duration: 0.7, ease: DRAWER }, 2.5)
      // swipe one page
      .fromTo(q(".ph-swipe"), { autoAlpha: 1, x: 0 }, { x: -190, duration: 0.56 }, 4.06)
      .to(q(".ph-swipe"), { autoAlpha: 0, duration: 0.2 }, ">")
      .to(q(".ph-pA"), { xPercent: -110, duration: 0.56, ease: DRAWER }, 4.2)
      .to(q(".ph-pB"), { xPercent: 0, duration: 0.56, ease: DRAWER }, 4.2)
      .to(q(".ph-pg b")[0], { autoAlpha: 0, duration: 0.1 }, 4.6)
      .to(q(".ph-pg b")[1], { autoAlpha: 1, duration: 0.1 }, 4.6);
    // back to home
    tap(q(".ph-back .ph-tap")[0], 5.6);
    tl.to(q(".ph-reader"), { xPercent: 100, duration: 0.7, ease: DRAWER }, 6.3)
      .to(q(".ph-bar i"), { scaleX: 1, duration: 0.84 }, 7.14)
      .to(q(".ph-badge"), { scale: 1, duration: 0.5, ease: "back.out(3)" }, 8.12)
      .to(q(".ph-new"), { maxHeight: 140, autoAlpha: 1, duration: 0.7 }, 8.4)
      .to(q(".ph-scroll"), { y: -150, duration: 1.1, ease: "power2.inOut" }, 9.8)
      .to(q(".ph-scroll"), { y: 0, duration: 1.1, ease: "power2.inOut" }, 11.5)
      // refresh: veil in, everything back to the start under it, veil out
      .to(q(".ph-veil"), { autoAlpha: 0.9, duration: 0.4, ease: "none" }, 13.16)
      .set(q(".ph-pA"), { xPercent: 0 }, 13.6)
      .set(q(".ph-pB"), { xPercent: 110 }, 13.6)
      .set(q(".ph-pg b"), { autoAlpha: (i: number) => (i === 0 ? 1 : 0) }, 13.6)
      .set(q(".ph-bar i"), { scaleX: 0.74 }, 13.6)
      .set(q(".ph-badge"), { scale: 0 }, 13.6)
      .set(q(".ph-new"), { maxHeight: 0, autoAlpha: 0 }, 13.6)
      .to(q(".ph-veil"), { autoAlpha: 0, duration: 0.4, ease: "none" }, 13.6);

    // Off-screen: pause, back in view: resume (hidden tabs are already paused by the browser).
    const freeze = process.env.NODE_ENV !== "production" && /[?&]freeze=(\d+)/.exec(location.search);
    if (freeze) tl.pause(Math.max(0, +freeze[1] / 1000 - tl.delay()));
    else {
      seen = new IntersectionObserver(([e]) => tl.paused(!e.isIntersecting));
      seen.observe(root);
    }
  }, root);
  return () => { seen?.disconnect(); ctx.revert(); };
}

const lines = (widths: number[]) => widths.map((w, i) => <span key={i} className="ph-line" style={{ width: `${w}%` }} />);

// The chapter reader the "finger" opens from Resume: swipes one page, then goes back.
function Reader() {
  return (
    <div className="ph-reader">
      <div className="ph-rtop">
        <span className="ph-back">
          <svg width="24" height="24" viewBox="0 0 24 24" {...icon}><path d="m15 18-6-6 6-6" /></svg>
          <i className="ph-tap" />
        </span>
        <span className="ph-rt">Ch 3 · Neural networks</span>
        <span className="ph-pg"><span><b>14</b><b>15</b></span> / 32</span>
      </div>
      <div className="ph-pages">
        <div className="ph-page ph-pA">
          <b>3.4 Backpropagation</b>
          {lines([100, 94, 98, 62])}
          <svg viewBox="0 0 300 120" className="ph-fig" fill="none" stroke="#08090b" strokeWidth="1.5">
            {[30, 60, 90].map((y) => [25, 50, 75, 100].map((y2) => <path key={`${y}-${y2}`} d={`M40 ${y} L150 ${y2}`} opacity="0.35" />))}
            {[25, 50, 75, 100].map((y) => <path key={`o${y}`} d={`M150 ${y} L260 60`} opacity="0.35" />)}
            {[30, 60, 90].map((y) => <circle key={`a${y}`} cx="40" cy={y} r="9" fill="#f5f3ef" />)}
            {[25, 50, 75, 100].map((y) => <circle key={`b${y}`} cx="150" cy={y} r="9" fill="#ffc900" />)}
            <circle cx="260" cy="60" r="9" fill="#08090b" />
          </svg>
          {lines([96, 100, 88, 70])}
        </div>
        <div className="ph-page ph-pB">
          <b>3.5 Activation functions</b>
          {lines([100, 90, 97, 55])}
          <svg viewBox="0 0 300 120" className="ph-fig" fill="none" stroke="#08090b" strokeWidth="1.5">
            <path d="M20 100 H280 M150 10 V110" opacity="0.35" />
            <path d="M20 98 C110 98 120 22 150 60 S200 22 280 22" stroke="#08090b" strokeWidth="3" />
          </svg>
          {lines([100, 92, 84, 96, 60])}
        </div>
        <i className="ph-tap ph-swipe" />
      </div>
      <div className="ph-rfoot"><span>Mark chapter as done</span></div>
    </div>
  );
}
