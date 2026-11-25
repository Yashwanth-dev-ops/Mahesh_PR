import { getStudents } from "@/server/admin";
import { requireAdmin } from "@/server/admin-auth";
import { audit } from "@/server/audit";

// The student list as CSV for the class (admins only). Every export is written to the audit log: it holds phone numbers.
const cell = (v: unknown) => { const s = String(v ?? ""); return /[",\n]|^[=+\-@]/.test(s) ? `"${s.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"` : s; };

export async function GET() {
  const a = await requireAdmin().catch(() => null);
  const rows = a && (await getStudents());
  if (!a || !rows) return new Response("Admins only.", { status: 403 });
  const Y = ["", "I", "II", "III", "IV"];
  const lines = [["roll_no", "full_name", "year", "section", "status", "phone", "email", "joined"].join(",")];
  for (const r of rows) lines.push([r.roll, r.name, Y[r.year ?? 0] ?? "", r.section ?? "", r.status === "suspended" ? "blocked" : r.status === "pending" ? "waiting" : "active", r.phone ?? "", r.email, r.joined.slice(0, 10)].map(cell).join(","));
  await audit(a.db, a.actor, "Exported student list", `${rows.length} students`, "CSV download");
  const day = new Date().toISOString().slice(0, 10);
  return new Response("﻿" + lines.join("\r\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="students-${day}.csv"`, "cache-control": "no-store" } });
}
