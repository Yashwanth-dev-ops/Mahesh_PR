// Small presentational pieces shared by the student pages. Server-safe (no client hooks).

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const Icon = {
  home: <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10" />,
  subjects: <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />,
  notes: <path d="M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />,
  search: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>,
  out: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9" />,
  file: <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z M14 2v6h6" />,
  check: <path d="M20 6 9 17l-5-5" />,
  left: <path d="m15 18-6-6 6-6" />,
  right: <path d="m9 18 6-6-6-6" />,
  download: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3" />,
  user: <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />,
  plus: <path d="M12 5v14 M5 12h14" />,
  bell: <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9 M10.3 21a1.94 1.94 0 0 0 3.4 0" />,
};

export function Svg({ d, size = 22 }: { d: React.ReactNode; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} aria-hidden="true">{d}</svg>;
}

// A recognisable mark per subject, picked from its name (borrowed idea from the prototype's subject icons).
export function SubjectIcon({ name }: { name: string }) {
  const n = name.toLowerCase();
  const d = n.includes("python") ? <path d="m8 9-4 3 4 3 M16 9l4 3-4 3 M13.5 5l-3 14" />
    : n.includes("math") ? <path d="M18 5H7l6 7-6 7h11" />
    : n.includes("deep") ? <><circle cx="5" cy="7" r="2" /><circle cx="5" cy="17" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="7" r="2" /><circle cx="19" cy="17" r="2" /><path d="M7 7.5 10 11 M7 16.5l3-3.5 M14 11l3-3.5 M14 13l3 3.5" /></>
    : n.includes("language") || n.includes("nlp") ? <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z M8 9h8 M8 13h5" />
    : n.includes("machine") ? <><path d="M12 3v3 M12 18v3 M3 12h3 M18 12h3" /><rect x="7" y="7" width="10" height="10" rx="2" /><path d="M10 10h4v4h-4z" /></>
    : <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />;
  return <span className="ap-sicon" aria-hidden="true"><Svg d={d} size={24} /></span>;
}

/** Progress ring. The number is shown as text next to it for screen readers. */
export function Ring({ percent, size = 44 }: { percent: number; size?: number }) {
  const r = (size - 6) / 2, c = 2 * Math.PI * r;
  return (
    <svg className="ap-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth="5" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - percent / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size * 0.27} fontWeight="700" fill="currentColor">{percent}</text>
    </svg>
  );
}

export const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

const CAT: Record<string, string> = { notice: "NOTICE", exam: "EXAM", event: "EVENT", campaign: "CAMPAIGN", placement: "PLACEMENT" };
export const when = (iso: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date(iso));

/** Figma Card/Notice: category · date, title, body. */
export function NoticeCard({ n, clamp }: { n: { title: string; body: string; category: string; pinned: boolean; publishAt: string }; clamp?: boolean }) {
  return (
    <article className="ap-card ap-notice">
      <p className="ap-noticeTop"><span className="ap-code ap-cat">{CAT[n.category] ?? "NOTICE"}</span> <span className="ap-caption">· {when(n.publishAt)}{n.pinned ? " · Pinned" : ""}</span></p>
      <h3 className="ap-h3">{n.title}</h3>
      {n.body && <p className={clamp ? "ap-noticeBody ap-clamp" : "ap-noticeBody"}>{n.body}</p>}
    </article>
  );
}
