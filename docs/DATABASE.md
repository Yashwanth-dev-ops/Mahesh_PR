# Database

## 1. Engine
Supabase Postgres. All tables have RLS enabled. Schema changes go only through `supabase/migrations`.

## 2. Naming
snake_case, plural table names, `id uuid default gen_random_uuid()` primary key, foreign keys named `<thing>_id`, `created_at timestamptz default now()`, `updated_at` via trigger. Enums are Postgres enums.

## 3. Enums
```
user_role:      student | admin
user_status:    pending | active | suspended
review_status:  pending | approved | rejected
material_type:  notes | slides | pdf | lab_record | link
paper_kind:     previous | regular
exam_type:      regular | supplementary | mid1 | mid2
notice_category: notice | exam | event | campaign | placement
```

## 4. Tables
| Table | Key columns |
|---|---|
| **profiles** | id (= auth.users.id), full_name, roll_no UNIQUE, branch (default 'AIML'), year 1–4, section, bio ≤300, avatar_path, links jsonb, role, status |
| **student_roster** | roll_no PK, full_name, branch, year, section, imported_by, imported_at — the admin CSV allowlist |
| **subjects** | code UNIQUE, name, branch, year, semester 1–2, regulation, description, is_active |
| **chapters** | subject_id, number, title — UNIQUE(subject_id, number) |
| **materials** | chapter_id, uploader_id, title, type, file_path, url (for links), file_hash, mime, size_bytes, status, reject_reason, reviewed_by, reviewed_at, download_count |
| **question_papers** | subject_id, kind, exam_type, regulation, exam_year, exam_month, file_path, file_hash, uploader_id, status, reviewed_by, reviewed_at, download_count |
| **notices** | title, body, category, attachment_path, pinned, publish_at, expires_at, created_by |
| **chapter_progress** | user_id, chapter_id, done bool, last_material_id, last_page — PK(user_id, chapter_id) |
| **quizzes** | chapter_id, title, created_by, status |
| **quiz_questions** | quiz_id, position, prompt, options jsonb (2–6 strings), answer_index, explanation |
| **quiz_attempts** | quiz_id, user_id, score, total, answers jsonb |
| **flashcards** | chapter_id, front, back, created_by, status |
| **comments** | chapter_id, user_id, parent_id (nullable, one level), body ≤1000, is_hidden, edited_at |
| **reports** | target_type, target_id, reporter_id, reason, status (open/closed), handled_by |
| **notifications** | user_id, kind, payload jsonb, read_at |
| **ad_slots** | key UNIQUE (home_feed, subject_list, papers_list, notices_archive), enabled, adsense_slot_id |
| **audit_log** | actor_id, action, target_type, target_id, meta jsonb |

## 5. Relationships
- subjects 1—N chapters 1—N materials · quizzes · flashcards · comments
- subjects 1—N question_papers
- profiles 1—N materials · question_papers · comments · quiz_attempts · chapter_progress
- quizzes 1—N quiz_questions, 1—N quiz_attempts
- comments 1—N comments (replies via parent_id, depth 1 enforced by trigger)

## 6. No-duplicate rules
- `materials`: partial UNIQUE index on `file_hash` WHERE `status <> 'rejected' AND file_hash IS NOT NULL`
- `materials` (links): partial UNIQUE on normalised `url` WHERE status <> 'rejected'
- `question_papers`: partial UNIQUE on `file_hash` WHERE status <> 'rejected'
- `question_papers`: UNIQUE(subject_id, kind, exam_type, regulation, exam_year, exam_month) WHERE status = 'approved'
- Similar titles: `pg_trgm` index on `materials.title` for the "similar exists" warning (similarity > 0.6 in the same chapter)
- `chapters`: UNIQUE(subject_id, number). `subjects`: UNIQUE(code)

## 7. Views (counts are never stored)
- `subject_stats(subject_id, chapter_count, material_count)` — approved materials only
- `user_subject_progress(user_id, subject_id, done_chapters, chapter_count)`

## 8. Indexes
materials(chapter_id, status), question_papers(subject_id, kind, regulation, exam_year), notices(pinned, publish_at desc), comments(chapter_id, created_at desc), notifications(user_id, read_at).

## 9. RLS summary
- Students read approved rows plus their own pending/rejected rows. They insert their own rows with status forced to `pending`. They can never update `status`.
- Admins read and write everything.
- profiles: everyone logged in reads public fields. Users update only their own row and only allowed columns (not role, status or roll_no).
- Suspended users: all policies require `status = 'active'`.

## 10. Soft delete and audit
- Materials and papers are rejected or hidden, never hard deleted (except on a copyright takedown, which deletes the file and keeps the row with `status=rejected`, reason "takedown").
- All admin writes add an `audit_log` row (trigger + server action).

## 11. Sensitive data
Email (in auth.users), roll number. Never shown publicly except roll number on the admin user table. Avatars are public. Material files are in private buckets and served only through signed URLs (10 min).

## 12. Migrations and seed
- Every change is a migration, tested locally with `supabase db reset`, and never edits production rows destructively.
- Seed: AI-ML subjects for the chosen regulation, 3 chapters each, 1 admin, 3 demo students, sample notices and papers (dummy PDFs).
