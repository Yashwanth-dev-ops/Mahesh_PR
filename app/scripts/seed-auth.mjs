// Demo accounts for phase 1. Run: node --env-file=.env.local scripts/seed-auth.mjs
// Safe to re-run: existing demo users are left as they are.
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const people = [
  { roll: "ADMIN0001", name: "Library Admin", year: 4, section: "A", role: "admin" },
  { roll: "22AB1A4201", name: "Priya Kumari", year: 3, section: "A" },
  { roll: "22AB1A4202", name: "Arjun Rao", year: 3, section: "B" },
  { roll: "22AB1A4203", name: "Sana Shaik", year: 2, section: "A" },
];

const { error: rosterErr } = await db.from("student_roster").upsert(
  people.map((p) => ({ roll_no: p.roll, full_name: p.name, year: p.year, section: p.section })),
);
if (rosterErr) throw rosterErr;

for (const p of people) {
  const { data: existing } = await db.from("profiles").select("id").eq("roll_no", p.roll).maybeSingle();
  if (existing) { console.log(`${p.roll}  already exists`); continue; }
  const password = randomBytes(9).toString("base64url");
  const { data, error } = await db.auth.admin.createUser({
    email: `${p.roll.toLowerCase()}@demo.example.com`,
    password,
    email_confirm: true,
    user_metadata: { full_name: p.name, roll_no: p.roll, year: String(p.year), section: p.section },
  });
  if (error) throw error;
  if (p.role === "admin") await db.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
  console.log(`${p.roll}  ${p.name.padEnd(14)} ${p.role ?? "student"}  password: ${password}`);
}
