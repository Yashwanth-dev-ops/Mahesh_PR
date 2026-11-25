import Link from "next/link";
import { Fragment } from "react";
import { LoginPill, PillCTA } from "@/components/ui/PillLinks";
import { IntroController, MenuButton } from "./IntroClient";
import { PhonePreview } from "./PhonePreview";
import "./landing.css";

const HEADLINE = ["Learn it.", "Share it.", "Ace it"];

// Yellow tags arrive first (i 0-1), outlined tags after the phone (i 2-4).
// a = place on the dotted ring in degrees (0 = right, 90 = bottom), r = resting tilt,
// fx/fy/spin = where it flies in from. The ring sits behind the phone, so tags pass behind it.
// Runs inline right after the stage: same formula as IntroController's fit(), before anything is painted.
const SIZE_STAGE = `(function(){var v=document.currentScript.parentNode,s=v.querySelector("[data-stage]");if(s)s.style.setProperty("--s",String(Math.min(1,v.clientWidth/640)))})()`;

const STICKERS = [
  { text: "6 chapters", yellow: true, a: 12, r: 10, fx: 160, fy: -30, spin: 24 },
  { text: "PDF · 3.1 MB", yellow: true, float: true, a: 158, r: 6, fx: -160, fy: 40, spin: -20 },
  { text: "AI3201 · ML", yellow: false, a: 212, r: -8, fx: -150, fy: -70, spin: -24 },
  { text: "Nov 2024 paper", yellow: false, a: 318, r: -4, fx: 140, fy: -110, spin: 20 },
  { text: "✓ No duplicates", yellow: false, a: 62, r: -7, fx: 150, fy: 100, spin: -22 },
];
const onRing = (deg: number, axis: "x" | "y") => `${(320 + 319 * (axis === "x" ? Math.cos : Math.sin)((deg * Math.PI) / 180)).toFixed(1)}px`;

const NAV = ["Subjects", "Papers", "Notices", "How it works"];

function Headline() {
  let i = 0;
  return (
    <h1 className="lp-h1" aria-label="Learn it. Share it. Ace it.">
      {HEADLINE.map((line, li) => (
        <span key={line} className="lp-line" aria-hidden="true">
          {line.split(" ").map((word, wi, words) => (
            <Fragment key={wi}>
              {wi > 0 && " "}
              <span className="lp-word">
                {[...word].map((ch, ci) => (
                  <span key={ci} className="lp-ch" data-in style={{ "--i": i++ } as React.CSSProperties}>{ch}</span>
                ))}
                {li === HEADLINE.length - 1 && wi === words.length - 1 && <span className="lp-ydot" data-in />}
              </span>
            </Fragment>
          ))}
        </span>
      ))}
    </h1>
  );
}

export function Landing() {
  return (
    <div className="lp-page">
      <a className="lp-skipLink" href="#main">Skip to content</a>

      <header className="lp-nav">
        <div className={`lp-wrap lp-navWrap`}>
          <MenuButton className="lp-menu" />
          <nav aria-label="Main">
            <ul className="lp-links">
              {NAV.map((l) => <li key={l}><Link className="lp-mono" href="#">{l}</Link></li>)}
            </ul>
          </nav>
          <div className="lp-navEnd"><LoginPill href="/login">Student login</LoginPill></div>
        </div>
      </header>

      <main id="main">
        <section className="lp-hero">
          <div className={`lp-wrap lp-heroWrap`}>
            <div className="lp-copy">
              <p className={`lp-mono lp-label`} data-in>Your branch&apos;s library,<br />finally in one place</p>
              <Headline />
              <p className="lp-sub" data-in>
                Chapter notes, past question papers and college notices for AI-ML students. Every upload is checked,
                and the same file can never be added twice.
              </p>
              <div className="lp-ctaRow" data-in><PillCTA href="/login">Sign in with roll number</PillCTA></div>
            </div>

            <div className="lp-visual" data-visual aria-hidden="true">
              <div className="lp-stage" data-stage suppressHydrationWarning /* the inline SIZE_STAGE script sets --s before React hydrates */>
                <div className="lp-disc" data-in />
                {/* The ring and the tags orbit the disc together, behind the phone; each tag counter-rotates so its text stays upright. */}
                <div className="lp-orbit">
                <svg className="lp-ring" data-in viewBox="0 0 640 640" width="640" height="640">
                  <circle cx="320" cy="320" r="319" fill="none" stroke="#F5F3EF" strokeWidth="1" strokeDasharray="2 8" />
                </svg>
                {STICKERS.map((t, i) => (
                  <div
                    key={t.text}
                    data-in
                    className={`lp-sticker ${t.yellow ? "lp-stickerY" : "lp-stickerO"}${"float" in t ? " lp-float" : ""}`}
                    style={{ "--x": onRing(t.a, "x"), "--y": onRing(t.a, "y"), "--r": `${t.r}deg`, "--i": i, "--fx": `${t.fx}px`, "--fy": `${t.fy}px`, "--spin": `${t.spin}deg` } as React.CSSProperties}
                  >
                    <span className="lp-mono">{t.text}</span>
                  </div>
                ))}
                </div>
                <div className="lp-phone" data-in><PhonePreview /></div>
              </div>
              {/* Scale the 640px stage while the HTML is still being parsed, so the first paint is already the right
                  size (otherwise it shows full size until JavaScript loads, then jumps). IntroController keeps it in
                  sync on resize. */}
              <script dangerouslySetInnerHTML={{ __html: SIZE_STAGE }} />
            </div>
          </div>
          <p className={`lp-mono lp-side`} data-in aria-hidden="true">Notes<br />Papers<br />Notices<br />Quizzes</p>
        </section>
      </main>

      <IntroController />
    </div>
  );
}
