# Security

## 1. Authentication
Supabase Auth with email + password and email verification. Passwords must be at least 8 characters, checked against Supabase's leaked-password protection. Sessions use HTTP-only cookies via `@supabase/ssr`.

**Current state (phase 1, 2026-11-24):** email confirmation is OFF, because Supabase's built-in mail only reaches team members. To stop someone claiming a classmate's roll number, an account is `active` only when the roll number AND full name match `student_roster`; anything else is `pending` until an admin approves it. Turn confirmation back on once a mail service (e.g. Resend SMTP) is connected. Login looks up the email for a roll number with `email_for_roll()`, which only the service role may call.

## 2. Authorization
- Roles: `student`, `admin`. Status: `pending`, `active`, `suspended`.
- Checked in three places: middleware (route groups), server actions (`requireRole`), and RLS (database).
- `/admin/*` returns 404 for non-admins (doesn't reveal that the page exists).
- Students can never set `status`, `role` or `reviewed_*` (RLS + column grants).
- At least one admin must always exist. Admins can't demote themselves.

## 3. Secrets
- `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` are server-only and never prefixed `NEXT_PUBLIC_`.
- No secrets in the repo. `.env.local` is gitignored and `.env.example` has placeholders only.
- Rotate keys right away if they're leaked.

## 4. Env vars
Public: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_ADSENSE_CLIENT`. Private: `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`.

## 5. API security
- Zod validation on every action, on the server (client checks are only for UX).
- Rate limits (Postgres-backed counter, `rate_hit` / `rate_clear`, migration 20261125000001): sign-in 5 wrong tries per roll number per 15 min (a correct sign-in resets it; unknown roll numbers count the same), password-reset emails 3 per roll number per hour, sign-ups 60 per network per hour (generous: a class may sign up together on one college Wi-Fi). Shown as "Too many tries. Try again in N minutes." Supabase's own per-IP auth limit is not relied on: sign-in runs in a server action, so it would see one address for everyone. Later: uploads 10/day, comments 10/10 min, reports 20/day.
- Next.js server actions already check the Origin. No public CORS API.
- Errors return a code and a friendly message, never stack traces or SQL.

## 6. File uploads
- Allowed: PDF, PPTX, DOCX, PNG, JPG, WebP. Max 25 MB (avatars 2 MB).
- The type is checked by magic bytes on the server, not only by extension.
- Files are stored with random names in private buckets and served by 10-minute signed URLs with `Content-Disposition: attachment` for downloads.
- PDFs render in PDF.js (no scripts run). Office files are download-only in v1.
- Links: only `https://`, normalised, and shown with the domain visible.

## 7. Content safety
- Every student upload is reviewed before going live.
- Report button on materials, papers and comments.
- Takedown contact on every page. Takedowns are handled within 72 h.
- Comments are plain text, rendered escaped (no HTML or markdown links in v1).

## 8. Ads
- AdSense script only on allowed pages, never on admin, auth, reader or upload pages.
- CSP allows only the Google ad domains needed. The ad slot container has a "Advertisement" label.
- No user data is sent to ad partners beyond what AdSense collects. A cookie/consent notice is shown.

## 9. Data protection
- Email and roll number are private. Public profile shows name, year, avatar and bio only.
- An account deletion request removes the profile and anonymises comments. Approved materials stay, credited to "Former student".

## 10. Logging
Never log passwords, tokens, keys, file contents or emails. Log: auth failures, admin actions (audit_log), rejected uploads, rate-limit hits.

## 11. Headers
CSP, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera/mic off), HSTS (Vercel).

## 12. Checklist
- ☐ Auth + email verification
- ☐ Role checks in middleware, actions and RLS
- ☐ RLS tests for every table
- ☐ Server-side Zod validation
- ☐ Magic-byte file checks + size limits
- ☐ Signed URLs, private buckets
- ☑ Rate limits (sign-in, reset, sign-up); ☐ uploads, comments, reports
- ☐ Errors leak nothing
- ☐ Service key never in client bundle (build check)
- ☐ `npm audit` clean of high/critical
