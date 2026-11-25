import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "./admin-auth";

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

// ---- Admin v3 pages (Figma B1 Students, B3 Admins, B5 Audit log) ----
async function emailsById(db: ReturnType<typeof supabaseAdmin>) {
  const map = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    for (const u of data?.users ?? []) if (u.email) map.set(u.id, u.email);
    if (!data || data.users.length < 1000) return map;
  }
}

export type StudentRow = { id: string; name: string; roll: string; year: number | null; section: string | null; status: "active" | "pending" | "suspended"; note: string; phone: string | null; email: string; joined: string };

/** Every student for the Students table (a class is small, so it's filtered and sorted in the browser). */
export async function getStudents(): Promise<StudentRow[] | null> {
  const a = await requireAdmin().catch(() => null);
  if (!a) return null;
  const [{ data: ps }, { data: roster }, emails] = await Promise.all([
    a.db.from("profiles").select("id, full_name, roll_no, year, section, status, status_reason, phone, created_at").eq("role", "student").order("created_at", { ascending: false }).limit(3000),
    a.db.from("student_roster").select("roll_no, full_name"),
    emailsById(a.db),
  ]);
  const listed = new Map((roster ?? []).map((r) => [r.roll_no, r.full_name as string]));
  const Y = ["", "I", "II", "III", "IV"];
  return (ps ?? []).map((p) => {
    const onList = listed.get(p.roll_no);
    const note = p.status === "suspended" ? (p.status_reason ? `Blocked: ${p.status_reason}` : "Blocked")
      : p.status === "pending" ? (!onList ? "Not on the class list" : norm(onList) !== norm(p.full_name) ? `Name differs: list says “${onList}”` : "Waiting for review")
      : `${Y[p.year ?? 0] ?? ""} year ${p.section ?? ""}`.trim();
    return { id: p.id, name: p.full_name, roll: p.roll_no, year: p.year, section: p.section, status: p.status, note, phone: p.phone, email: emails.get(p.id) ?? "", joined: p.created_at };
  });
}

export type TeamMember = { id: string; name: string; email: string; isOwner: boolean; since: string };
export type OpenInvite = { id: string; name: string; email: string; sent: string };

/** Admins and open invitations. `canManage` = the viewer is the main admin. */
export async function getTeam() {
  const a = await requireAdmin().catch(() => null);
  if (!a) return null;
  const [{ data: admins }, { data: invites }, emails] = await Promise.all([
    a.db.from("profiles").select("id, full_name, is_owner, created_at").eq("role", "admin").order("is_owner", { ascending: false }).order("created_at"),
    a.db.from("admin_invites").select("id, user_id, email, full_name, created_at, accepted_at").order("created_at", { ascending: false }),
    emailsById(a.db),
  ]);
  const open = (invites ?? []).filter((i) => !i.accepted_at);
  const pendingIds = new Set(open.map((i) => i.user_id));
  return {
    me: a.adminId, canManage: a.isOwner,
    members: (admins ?? []).filter((p) => !pendingIds.has(p.id)).map((p): TeamMember => ({ id: p.id, name: p.full_name, email: emails.get(p.id) ?? "", isOwner: p.is_owner, since: p.created_at })),
    invites: open.map((i): OpenInvite => ({ id: i.id, name: i.full_name, email: i.email, sent: i.created_at })),
  };
}

export type AuditRow = { id: number; at: string; admin: string; action: string; target: string | null; details: string | null };

/** The latest audit entries, newest first, optionally filtered by admin name, action, or a word in the target. */
export async function getAudit(f: { admin?: string; action?: string; q?: string; days?: number }) {
  const a = await requireAdmin().catch(() => null);
  if (!a) return null;
  let q = a.db.from("admin_audit").select("id, at, admin_label, action, target, details", { count: "exact" }).order("at", { ascending: false }).limit(200);
  if (f.admin) q = q.eq("admin_label", f.admin);
  if (f.action) q = q.eq("action", f.action);
  if (f.q) q = q.ilike("target", `%${f.q.replace(/[%_]/g, "")}%`);
  if (f.days) q = q.gte("at", new Date(Date.now() - f.days * 86400_000).toISOString());
  const [{ data, count }, { data: all }] = await Promise.all([q, a.db.from("admin_audit").select("admin_label, action").order("at", { ascending: false }).limit(2000)]);
  return {
    rows: (data ?? []).map((r): AuditRow => ({ id: r.id, at: r.at, admin: r.admin_label, action: r.action, target: r.target, details: r.details })),
    total: count ?? 0,
    admins: [...new Set((all ?? []).map((r) => r.admin_label))].sort(),
    actions: [...new Set((all ?? []).map((r) => r.action))].sort(),
  };
}
