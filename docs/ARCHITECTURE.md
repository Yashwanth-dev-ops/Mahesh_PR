# Architecture

## 1. Overview
A single Next.js app on Vercel. Supabase provides auth, Postgres (with Row Level Security), and file storage. Pages read data with server components. Writes that need extra checks (uploads, approvals, admin actions) go through server actions / route handlers that use the server-side Supabase client.

## 2. Pattern
Modular monolith. One deployable app, organised by feature. Reason: one developer, free hosting, and no need for separate services.

## 3. Stack
| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router, TypeScript), React Server Components |
| Styling | Tailwind CSS with design tokens as CSS variables |
| UI primitives | Radix / shadcn-style components owned in repo |
| Backend | Next.js server actions + route handlers |
| Database | Supabase Postgres + RLS |
| Auth | Supabase Auth (email + password, email verification) |
| Storage | Supabase Storage, private buckets + signed URLs |
| PDF reader | PDF.js (`react-pdf`) |
| Validation | Zod (shared client + server schemas) |
| Toasts | Sonner |
| Ads | Google AdSense (loaded only on allowed pages) |
| Hosting | Vercel |
| Email | Pilot: a dedicated Gmail account over SMTP (500/day). Supabase sends the password reset through it (branded template `supabase/templates/recovery.html`, 60/hour); the app sends "account approved" itself (`src/lib/email.ts`, nodemailer). Set up with `npm run setup-email`. Later: Resend with the app's own domain (change the SMTP settings only) |
| Analytics | Vercel Analytics (free) |
| Tests | Vitest, Playwright |

## 4. Components
- **Frontend:** pages, forms, reader, client-side validation, optimistic UI for progress and comments.
- **Server layer (`src/server`):** business rules (duplicate check, approval, rate limits, role checks), hashing, signed URLs, audit logging.
- **Database:** source of truth. RLS is the last line of defence, so even a buggy page can't read or write what the role doesn't allow.

## 5. Diagram
```
Browser ─▶ Next.js (Vercel)
            ├─ Server Components ──read──▶ Supabase Postgres (RLS)
            ├─ Server Actions ──write────▶ Postgres + Storage
            │      └─ hash · validate · authorize · audit
            └─ AdSense script (allowed pages only)
```

## 6. Data flow — upload
1. Client validates type/size (Zod) and shows similar titles
2. Client requests a signed upload URL from a server action (auth + role + rate limit checked)
3. File goes to the `staging` bucket
4. Server action finalises: downloads the stream, computes SHA-256, checks `materials.file_hash` / `papers.file_hash`
5. Duplicate → delete staged file, return the existing item. New → move to `library` bucket, insert row `status=pending`
6. Admin approves → `status=approved`, audit row, notification

## 7. Project structure
```
src/
├── app/
│   ├── (public)/        landing, login, signup, admin/login
│   ├── (student)/       home, subjects, chapters, papers, notices, upload, profile
│   └── admin/           dashboard, review, subjects, papers, notices, users, reports, ads, audit
├── components/ui/       design-system primitives
├── components/          feature components (subject-card, reader, quiz, ...)
├── server/              actions and services by feature (materials, papers, auth, admin)
├── lib/                 supabase clients, zod schemas, utils
├── types/               generated DB types
└── styles/              tokens.css
supabase/migrations/     SQL migrations + RLS policies
tests/{unit,integration,e2e}
```

## 8. Dependency rules
- UI components never import Supabase directly. They call server actions or receive props.
- Only `src/server/*` uses the service-role key, and it never reaches the client bundle.
- Every admin action checks `role = 'admin'` on the server, and RLS checks it again.
- Counts (chapters, materials) come from SQL views, never stored by hand.

## 9. Key decisions
See DECISIONS.md (when created). Main ones: Supabase over MERN (free auth + storage + RLS); SHA-256 file hash for duplicates; admin review for all student uploads.

## 10. Performance
- Subject and chapter lists are server rendered and cached, revalidated on change.
- PDFs are streamed with range requests. Thumbnails are generated lazily.
- Ad slots have a fixed height (no layout shift). The AdSense script loads after content (`afterInteractive`).
- Budget: LCP < 2.5 s on 4G, INP < 200 ms, CLS < 0.1.

## 11. Scalability
- `branch` column on subjects and profiles from day one, so more branches can be added without schema changes.
- Storage is the first limit (1 GB free). Monitor usage and move to Supabase Pro or Cloudflare R2 when it reaches 70%.

## 11a. File storage plan (decided 2026-11-25)

| Stage | Files live in | Free limit | Move when |
|---|---|---|---|
| Class pilot (now) | Supabase Storage, private buckets `materials`, `papers`; public `avatars` | 1 GB storage, ~5 GB downloads / month | storage > 800 MB, or downloads near the monthly cap (Supabase dashboard → Usage) |
| Whole branch / college | **Cloudflare R2** for `materials` + `papers` (avatars can stay) | 10 GB storage, no download (egress) fee | storage > 8 GB |
| Backup (pilot, now) | `npm run backup` on the admin's computer → one `backups/backup-YYYY-MM-DD.tar.zst` (all files in `materials`, `papers`, `avatars` + `pg_dump` of the public schema, rows and accounts, with a SHA-256 manifest). Copy it to the admin's Google Drive and a second place. Weekly | Drive 15 GB free | — |
| Backup (whole branch) | Same archive, plus **Backblaze B2** nightly copy of the R2 buckets | 10 GB free | — |

Rules that keep it free and portable:
- Every file read goes through one place: a 10-minute signed link made on the server (`materialLink`, `paperLink`, `getReadable`, `getPaperReadable`). Moving to R2 changes only those functions plus the import/upload code; the database rows keep the same `file_path`.
- Files are keyed by SHA-256 (`<subject>/<chapter>/<hash>.<ext>`), so the same file is stored once, and a copy between providers can be verified by hash.
- Shrink before storing: the import script runs every PDF through Ghostscript (`/ebook`, 150 dpi) and keeps the smaller file when it saves ≥10%; the duplicate check still uses the original file's SHA-256. Profile photos become a 512 px WebP (~30–60 KB) on upload (`sharp`). Zipping already-compressed PDFs or photos saves almost nothing, so the backup only compresses well on the database part.
- Off-site copy: `scripts/backup-to-drive.sh` (cron checks hourly, runs when the last good upload is 7+ days old) uploads the archive through an rclone **crypt** remote, so it is encrypted on the admin's computer before it reaches Google Drive; keeps the newest 8 in Drive and 4 locally; logs to `backups/backup.log`. The encryption password lives only in rclone's config and the owner's password manager.
- Restore: `npm run restore -- <archive>` checks every file's SHA-256; `--into` restores into a new, empty Supabase project (it refuses the live project and any project that already has accounts). Test a restore once per term.
- Tools on the admin's computer: `sudo apt-get install -y postgresql-client ghostscript` (pg_dump 17+, Ghostscript). Without Ghostscript the import stores PDFs unchanged; without pg_dump only `--files-only` backups work.
- **On-device copies (offline):** students can keep chapters/papers on their phone (browser Cache Storage via a service worker). A saved file opens without downloading again, which also saves the monthly download allowance. Design and behaviour: see the "Saved offline" Figma screens (pending approval).
- Free limits change: check the providers' pricing pages before each move. R2 needs a payment card on file even on the free tier.

## 12. Failure scenarios
| Failure | Behaviour |
|---|---|
| Supabase down | Error page with retry. Nothing is written half-way |
| Upload interrupted | Staged file expires after 24 h (cleanup job). User retries with the form still filled |
| Hash step fails | Upload rejected with "Try again". Never stored without a hash |
| AdSense blocked or fails | Slot collapses to its reserved space with no error |
| Auth session expired | Redirect to login, then return to the same page |
