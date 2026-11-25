import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { BulkForm } from "@/components/admin/BulkForm";
import { requireAdmin } from "@/server/admin-auth";
import { APP_NAME } from "@/lib/site";

export const metadata: Metadata = { title: `Bulk registration · Admin · ${APP_NAME}` };

async function Bulk() {
  await connection();
  const a = await requireAdmin().catch(() => null);
  if (!a) return <p className="ad-meta">This page is for library admins.</p>;
  const { count } = await a.db.from("welcome_emails").select("user_id", { count: "exact", head: true }).is("sent_at", null);
  return <BulkForm waiting={count ?? 0} />;
}

export default function BulkPage() {
  return (
    <>
      <header className="ad-header">
        <div>
          <h1 className="ad-h1">Bulk registration</h1>
          <p className="ad-meta">Create many student accounts at once. Each student sets their own password from an email link.</p>
        </div>
        <div className="ad-actions"><Link className="ad-btnLine" href="/admin/students">Back to students</Link></div>
      </header>
      <Suspense fallback={<p className="ad-meta">Loading…</p>}><Bulk /></Suspense>
    </>
  );
}
