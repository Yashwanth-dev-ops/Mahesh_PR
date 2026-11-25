"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deletePhoto, updatePhoto } from "@/app/actions/profile";
import { PhotoEditor } from "@/components/photo/PhotoEditor";

/** Profile header photo with "Change photo" → the photo editor (Figma M6 on a laptop, M5 on a phone). */
export function ProfilePhoto({ url, initial }: { url: string | null; initial: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const edit = async (f: File) => {
    if (f.type.startsWith("image/")) { setFile(f); return; }
    setMsg("Use a JPG, PNG or WebP image.");
  };
  // An existing photo opens in the editor too (re-crop without picking a new file).
  const reopen = async () => {
    if (!url) return;
    const r = await fetch(url, { cache: "no-store" }).catch(() => null);
    const b = r?.ok ? await r.blob() : null;
    if (b) setFile(new File([b], "photo", { type: b.type || "image/webp" }));
  };
  const done = (m: string) => { setBusy(false); setMsg(m); setFile(null); router.refresh(); };
  return (
    <div className="ap-photo">
      <button type="button" className="ap-photoBtn" onClick={url ? reopen : undefined} aria-label={url ? "Edit your photo" : undefined} tabIndex={url ? 0 : -1}>
        {/* eslint-disable-next-line @next/next/no-img-element -- student photo from Supabase storage */}
        {url ? <img src={url} alt="" className="ap-avatar" /> : <span className="ap-avatar" aria-hidden="true">{initial}</span>}
      </button>
      <label className="ap-photoChange">{url ? "Change photo" : "Add photo"}
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = ""; if (f) edit(f); }} />
      </label>
      <span className="ap-meta" role="status">{msg}</span>
      {file && (
        <PhotoEditor key={`${file.name}${file.size}${file.lastModified}`} file={file} title="Edit photo" saving={busy} onCancel={() => setFile(null)} onChangePhoto={edit}
          onDelete={url ? async () => { setBusy(true); const r = await deletePhoto().catch(() => ({ message: "Couldn't delete. Try again." })); done(r.message); } : undefined}
          onSave={async (cropped) => {
            setBusy(true);
            const fd = new FormData(); fd.set("photo", cropped);
            const r = await updatePhoto(fd).catch(() => ({ message: "Couldn't save. Try again." }));
            done(r.message);
          }} />
      )}
    </div>
  );
}
