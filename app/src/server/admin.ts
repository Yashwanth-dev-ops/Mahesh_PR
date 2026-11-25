import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

const WEEK = 7 * 24 * 3600 * 1000;
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Everything the pilot admin dashboard shows. Returns null unless the caller is an active admin. */
export async function getDashboard() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase.from("profiles").select("full_name, role, status").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin" || me.status !== "active") return null;

  const db = supabaseAdmin();
  const since = new Date(Date.now() - WEEK).toISOString();
  const [students, pending, active, feedback, newFeedback, notices, roster, rejected] = await Promise.all([
    db.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student"),
    db.from("profiles").select("id, full_name, roll_no, year, section, created_at").eq("role", "student").eq("status", "pending").order("created_at"),
    db.from("chapter_progress").select("user_id").gte("updated_at", since).limit(10000),
    db.from("feedback").select("id, message, page, created_at, profiles(full_name)").order("created_at", { ascending: false }).limit(10),
    db.from("feedback").select("id", { count: "exact", head: true }).gte("created_at", since),
    db.from("notices").select("id, title, body, category, pinned, publish_at, expires_at").order("publish_at", { ascending: false }).limit(10),
    db.from("student_roster").select("roll_no", { count: "exact", head: true }),
    db.from("profiles").select("id, full_name, roll_no, year, section, updated_at").eq("role", "student").eq("status", "suspended").order("updated_at", { ascending: false }).limit(50),
  ]);

  // Why each account is pending: not on the list, name differs from the list, or Google sign-up.
  const rolls = (pending.data ?? []).map((p) => p.roll_no);
  const { data: listed } = rolls.length ? await db.from("student_roster").select("roll_no, full_name").in("roll_no", rolls) : { data: [] };
  const byRoll = new Map((listed ?? []).map((r) => [r.roll_no, r.full_name as string]));
  const waiting = await Promise.all((pending.data ?? []).map(async (p) => {
    const onList = byRoll.get(p.roll_no);
    const { data: u } = await db.auth.admin.getUserById(p.id);
    const google = u?.user?.app_metadata?.provider === "google";
    const reason = !onList ? "roll number not on the list"
      : norm(onList) !== norm(p.full_name) ? `name differs: list says “${onList}”`
      : google ? "signed up with Google" : "waiting for review";
    return { id: p.id, name: p.full_name, roll: p.roll_no, year: p.year, section: p.section, reason };
  }));

  return {
    adminName: me.full_name,
    stats: {
      students: students.count ?? 0,
      waiting: waiting.length,
      activeWeek: new Set((active.data ?? []).map((r) => r.user_id)).size,
      newFeedback: newFeedback.count ?? 0,
      roster: roster.count ?? 0,
    },
    waiting,
    // Rejected students can't sign in; the admin can give them access after all.
    rejected: (rejected.data ?? []).map((p) => ({ id: p.id, name: p.full_name, roll: p.roll_no, year: p.year, section: p.section,
      reason: `rejected ${new Date(p.updated_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}, can't sign in` })),
    feedback: (feedback.data ?? []).map((f) => ({ id: f.id, message: f.message, page: f.page, at: f.created_at, name: (f.profiles as unknown as { full_name: string } | null)?.full_name ?? "Student" })),
    notices: (notices.data ?? []).map((n) => ({ ...n, live: new Date(n.publish_at) <= new Date() && (!n.expires_at || new Date(n.expires_at) > new Date()) })),
  };
}
