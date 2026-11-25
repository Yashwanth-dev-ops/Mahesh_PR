import Link from "next/link";
import type { SubjectCard } from "@/server/learn";
import { Icon, Svg, plural } from "./bits";

// Figma Card/Subject: code + chevron, name, counts, progress bar with "N of M chapters done".
export function SubjectGrid({ subjects }: { subjects: SubjectCard[] }) {
  if (!subjects.length) return <p className="ap-empty">No subjects yet for your year. Your admin adds them.</p>;
  return (
    <ul className="ap-grid">
      {subjects.map((s) => (
        <li key={s.id}>
          <Link href={`/subjects/${s.code}`} className="ap-card ap-subject">
            <span className="ap-subjectTop"><span className="ap-code">{s.code}</span><Svg d={Icon.right} size={20} /></span>
            <span className="ap-subjectName">{s.name}</span>
            <span className="ap-meta">{plural(s.chapters, "chapter")} · {plural(s.materials, "file")}<span className="ap-onPhone"> · {s.done}/{s.chapters} done</span></span>
            <span className="ap-bar ap-barLight" role="img" aria-label={`${s.done} of ${s.chapters} chapters done`}><i style={{ width: `${s.percent}%` }} /></span>
            <span className="ap-caption">{s.done} of {plural(s.chapters, "chapter")} done</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
