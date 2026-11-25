import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { StudentTable } from "@/components/admin/StudentTable";
import { getStudents } from "@/server/admin";
import { APP_NAME } from "@/lib/site";

export const metadata: Metadata = { title: `Students · Admin · ${APP_NAME}` };

async function Students() {
  await connection();
  const rows = await getStudents();
  if (!rows) return <p className="ad-meta">This page is for library admins.</p>;
  return <StudentTable rows={rows} />;
}

export default function StudentsPage() {
  return <Suspense fallback={<p className="ad-meta">Loading students…</p>}><Students /></Suspense>;
}
