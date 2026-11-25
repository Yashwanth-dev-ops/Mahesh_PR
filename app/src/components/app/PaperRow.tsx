"use client";

import Link from "next/link";
import { useState } from "react";
import { paperLink } from "@/app/actions/learn";
import { Icon, Svg } from "./bits";
import { useWarmPdfReader } from "./PdfReader";

export function PaperRow({ p }: { p: { id: string; subject: string; title: string; meta: string } }) {
  const [msg, setMsg] = useState("");
  useWarmPdfReader();
  const download = async () => {
    const { url } = await paperLink(p.id).catch(() => ({ url: null }));
    if (url) window.location.assign(url); else setMsg("Not available right now.");
  };
  return (
    <li className="ap-card ap-file">
      <Svg d={Icon.file} />
      <span className="ap-chText">
        <span className="ap-caption">{p.subject}</span>
        <span className="ap-chTitle">{p.title}</span>
        <span className="ap-meta">{msg || p.meta}</span>
      </span>
      <Link className="ap-btnLine" href={`/read/paper/${p.id}`}>Read</Link>
      <button type="button" className="ap-iconBtn" onClick={download} aria-label={`Download ${p.subject} ${p.title}`}><Svg d={Icon.download} size={18} /></button>
    </li>
  );
}
