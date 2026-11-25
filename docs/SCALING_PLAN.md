# Scaling and DevOps plan: from one class to the whole college

Status: **plan only, nothing here is built yet.** Written 2026-11-25 after the class pilot's backup, compression, rate
limits and email were built. Prices and limits change: re-check every number marked *(check)* on the provider's
pricing page before each stage. Sources are at the end.

## 0. The short answer

At college size (about 5,000 students) this app is **small, read-heavy and bursty**. The real limits are
**file downloads (egress), database connections, the server's distance from the database, email volume and
exam-night spikes**, not raw request volume. So:

| Technology | Verdict for one college | Why |
|---|---|---|
| **Kafka** | **Not needed** | Kafka earns its cost when the queue *is* the system: replay, many independent consumers, sustained MB/s streams. A college library has a few background jobs a minute. Postgres queues (Supabase Queues / pgmq) cover it with nothing new to run. |
| **Redis** | **Not now; add only when measured** | Rate limits already run in Postgres; sessions are stateless JWTs; pages and files are cached by the CDN. Add serverless Redis (Upstash) only if a trigger in §6 fires. |
| **CDN + cheap file storage** | **Needed before the branch launch** | PDF downloads are the biggest cost and load. Move files to Cloudflare R2 (no egress fee) and cache on phones (offline). |
| **Region placement** | **Needed now** | The database is in Mumbai (ap-south-1). Server functions must run in Mumbai too, or every query crosses the world. |
| **Queues for background work** | **Needed at branch size** | Emails, PDF compression and OCR for student uploads, notification fan-out: move off the request, into Supabase Queues. |
| **Observability, CI/CD, staging, DR** | **Needed before the branch launch** | You can't run 5,000 users blind. |

## 1. How much load is "the whole college"? (assumptions to confirm)

| Input | Assumption | Notes |
|---|---|---|
| Students | 5,000 (4 years × ~8 branches × ~150) | Confirm with the college |
| Signed up | 70% → 3,500 accounts | Supabase Pro covers 100,000 monthly active users *(check)* |
| Daily active (normal day) | 15% → ~750 | |
| Exam-night peak | 40% online within 2 hours → ~1,400, ~600 at once | The design target |
| Requests at peak | 600 users × 1 request / 10 s ≈ **60 requests/second**, bursts ~150 | Modest for Postgres + CDN |
| PDF opens per student per month | ~30, average 2 MB after compression | |
| **File downloads per month** | 3,500 × 30 × 2 MB ≈ **210 GB**, exam months 2× ≈ **400 GB** | Supabase Pro includes 250 GB egress *(check)* → this is the first wall |
| Stored files | ~8 semesters × 8 branches × 6 subjects × ~150 MB ≈ **55 GB** over 4 years | R2: $0.015/GB-month → under $1/month *(check)* |
| Database size | Rows are text: < 2 GB for years | Supabase Pro: 8 GB included *(check)* |
| Emails | Start of term: ~3,500 sign-ups/approvals in a week, ~100 resets/day at exams | Gmail's 500/day limit breaks here |

Load test target before launch (§10): **1,000 concurrent users for 30 minutes, p95 page < 1.5 s, zero errors**.

## 2. Target architecture (whole college)

```
 Phone / laptop (PWA, offline cache of opened chapters & PDFs)
        │
        ▼
 Vercel edge CDN ── static pages, images, cached HTML (ISR) ─────────────┐
        │                                                                 │
        ▼                                                                 │
 Vercel Functions, region bom1 (Mumbai)  ← server components / actions    │
        │  supabase-js over HTTPS (no direct Postgres connections)        │
        ▼                                                                 │
 Supabase (ap-south-1, Mumbai)                                            │
   ├─ Postgres + RLS (+ read replica only if §6 says so)                  │
   ├─ Auth (roll number → email, Google)                                  │
   ├─ Queues (pgmq): email, compress, OCR, notify jobs                    │
   ├─ Edge Functions / cron: queue workers, cleanups                      │
   └─ Storage: avatars only                                               │
        │                                                                 │
 Cloudflare R2: materials + papers ◄─── signed links, 10 min ─────────────┘
        │  (no egress fee; nightly copy to Backblaze B2)
 Resend (own domain) for email · Sentry for errors · uptime monitor · GitHub Actions CI/CD
```

One codebase, one Postgres. No microservices: a few thousand users don't justify the operations cost.

## 3. Compute and region

- **Pin Vercel functions to `bom1` (Mumbai)**, same region as the database. A server action makes 2–6 database calls;
  from the US default region each adds ~200 ms. *(Do this at first deploy.)*
- Server components already read with `supabase-js` (HTTPS through Supabase's API), so serverless functions don't
  hold Postgres connections. Keep it that way; if anything ever needs a direct connection (reports, scripts), use the
  Supavisor pooler in **transaction mode** with a pool of 1–3 per function.
- **Vercel plan:** Hobby is non-commercial only. Turning on ads makes it commercial → **Pro ($20/user/month)** before
  ads go live *(check)*. Hobby also stops a feature for 30 days when a limit is hit, with no way to buy more.
- **Supabase plan:** Free projects pause after a week of inactivity, so use **Pro ($25/month)** from the branch launch.
  Start on the smallest compute; upgrade compute when §6 triggers fire (it raises both connection limits).

## 4. Files: the biggest cost and load

- **Cloudflare R2** for `materials` and `papers` (ARCHITECTURE §11a already plans this): no egress fee, 10 GB free,
  $0.015/GB after *(check)*. Avatars can stay in Supabase.
- Reads stay behind 10-minute **signed links** made on the server (`getReadable`, `getPaperReadable`), so files remain
  private; only those functions change when moving.
- **Compression on upload** (built for the import script): extend it to student uploads through the queue (§7).
- **Offline cache on the phone** (Figma screens 16–17): a chapter saved once never downloads again. This alone can cut
  repeat egress in half on exam nights.
- **Range requests** for PDFs so the reader fetches pages, not the whole file (PDF.js supports this).
- Nightly **R2 → Backblaze B2** copy (already planned).

## 5. Database

- **Indexes** for every list/filter query (subject, chapter, status, created_at) and `pg_trgm` / full-text indexes for
  search. Check slow queries with `pg_stat_statements` before each stage.
- **Counts as views/materialised views** refreshed by cron (dashboards, "1 of 16 chapters done") instead of counting
  on every request.
- **Multi-branch data:** every row already has branch/year/semester/section. Add RLS by branch so a department admin
  sees only their branch; add a `college` id now if more colleges are ever possible.
- **Connection budget:** functions → REST (no pool use); workers → pooler transaction mode, small pools.
- **Point-in-time recovery** add-on on Supabase Pro once real data matters (RPO minutes instead of a week) *(check price)*.
- **Read replica:** only if CPU stays > 70% at peak after indexing and caching (unlikely at 5,000 students).
- **Data retention:** rate-limit rows 1 day (built), audit log 1 year, deleted accounts purged after 30 days.

## 6. Caching and Redis

Layers, cheapest first:

| Layer | What | Already? |
|---|---|---|
| Phone | Service worker: app shell + saved chapters/PDFs | Planned (offline screens) |
| CDN | Static assets, images, public landing | Yes (Vercel) |
| Next.js cache | Subject/chapter lists cached, revalidated on change (`revalidatePath`) | Partly |
| Postgres | Materialised views for counts | Not yet |
| Redis | Shared hot data / counters across function instances | **No, not needed yet** |

**Add Upstash Redis (serverless, HTTP client, free tier 500K commands/month, then $0.20 per 100K *(check)*) only if:**
1. `rate_events` writes exceed ~50/second sustained, or the rate-limit check adds > 30 ms p95; or
2. the same expensive read (e.g. exam-mode "weakest chapters") runs > 20/second and can't be a materialised view; or
3. you need real-time presence or leaderboards.

If added, use it for **rate limits and hot counters only**. Postgres stays the source of truth; nothing breaks if Redis
is empty.

## 7. Background jobs and queues (instead of Kafka)

Use **Supabase Queues (pgmq)** + a worker (Supabase Edge Function on a 1-minute cron, or Vercel cron):

| Queue | Jobs |
|---|---|
| `email` | Approved, reset (Supabase sends), notice emails, weekly digest |
| `files` | Compress student uploads (Ghostscript), thumbnails, virus scan, near-duplicate check |
| `ocr` | PDF → chapter sections (Tesseract), admin only |
| `notify` | Fan-out of a notice to a year/section (web push + in-app) |

pgmq gaps to build ourselves: **retry limit + dead-letter table + alert when it grows**, and watch table bloat
(per-table autovacuum). **Kafka only if** you ever need event replay, many independent consumers or multi-region
streams: not for one college.

## 8. Email and notifications

- **Resend with the app's own domain** before the branch launch (Gmail's 500/day is too low; a domain also gives
  SPF/DKIM/DMARC so mail isn't spam). Switching is a settings change (`npm run setup-email` pattern).
- **Web push** (PWA) for notices: free, instant, no email cost. Email only for account events and opt-in digests.
- Respect quiet hours; never email more than one digest a day.

## 9. Search

- Now: Postgres full-text on subjects, chapters, sections. Next: `pg_trgm` for typos and roll-number search.
- **Meilisearch/Typesense only if** search p95 > 300 ms after indexing, or you need fuzzy multi-language search.

## 10. DevOps

### Environments
- **dev** (local + Supabase dev project), **staging** (its own Supabase project + Vercel preview), **production**.
- Never test against production data; seed staging with fake students.

### CI/CD (GitHub Actions, once the repo is on GitHub)
1. On every pull request: install → lint → typecheck → unit tests → script self-tests → build → Playwright smoke tests
   (login, home, chapter, admin) → Vercel preview URL.
2. Database migrations: `supabase db push` to **staging** automatically, to **production** only after a manual approval.
3. Production deploy on merge to `main`; keep the previous deploy one click away (Vercel instant rollback).
4. Weekly: dependency audit (`npm audit`) + Dependabot; block merges with high-severity issues.
5. Scheduled backup job in the cloud (replaces the laptop cron once on GitHub).

### Observability
| Need | Tool (free tier first) |
|---|---|
| Errors in browser + server | Sentry |
| Page speed for real users | Vercel Speed Insights / Web Vitals |
| Logs | Vercel + Supabase logs; log drain if needed |
| Uptime + status page | Better Stack or UptimeRobot, checking `/login` and a health route every minute |
| Database | Supabase reports + `pg_stat_statements` |
| Business metrics | Admin dashboard: weekly active %, chapters with material, uploads, queue depth |

**Alerts:** error rate > 1% for 5 min, p95 > 2 s, queue backlog > 100, backup older than 8 days, storage > 80%.

### Load testing
- **k6** script for the exam-night journey (login → home → subject → chapter → open PDF) against **staging**:
  ramp to 1,000 virtual users, hold 30 min. Run before the branch launch and before the college launch.

### Disaster recovery
| | Target |
|---|---|
| RPO (data you can lose) | Pilot: 1 week (weekly backup) → College: minutes (PITR) |
| RTO (time to recover) | 4 hours: restore into a new project with `npm run restore --into`, point env vars at it |
| Drill | Restore into a scratch project once per term and record the time |

### Runbooks (one page each)
Supabase down · Vercel down · storage full · email blocked · leaked key (rotate service key, Gmail/Resend password) ·
bad deploy (rollback) · bad migration (restore) · abusive upload (takedown).

## 11. Security and privacy (at college scale)

- **RLS tests in CI:** a student can't read another's notes/progress; a branch admin can't see other branches.
- **Rate limits:** built for sign-in/reset/sign-up; add uploads 10/day, reports 20/day (SECURITY.md).
- **Uploads:** magic-byte checks, size limits, virus scan (ClamAV in the `files` queue), admin review before public.
- **Secrets:** only in Vercel/Supabase env settings and `.env.local`; rotate the service key and email password each
  term and after any staff change.
- **Headers:** CSP, HSTS, frame-ancestors (SECURITY.md §11).
- **India's DPDP Act 2023:** student personal data needs a clear notice, consent at sign-up, a way to delete an account
  and its data, breach notification, and minimal collection (we collect name, roll number, email, photo: keep it so).
  **Built 2026-11-25:** `/privacy` notice (versioned), consent box at sign-up and on Google sign-up, one-time
  `/consent` for older accounts, Profile → Download my data (JSON) and Delete my account. Still to do before the
  college launch: the contact email, the notice in Telugu/Hindi as well as English, verifiable parental consent if
  under-18 students join, and a review by the college or a lawyer.
- **Copyright:** takedown contact on every page (PRD), admin review, no textbook PDFs.

## 12. Roles and admin at scale

- Roles: **student → class rep → branch admin → college admin**. Branch admins approve their branch's students and
  content; college admins manage branches.
- **Audit log** of every admin action (already planned): who approved/deleted what, when.

## 13. Cost by stage (USD per month, *check* before each stage)

| Stage | Users | Supabase | Vercel | Files | Email | Monitoring | Total |
|---|---|---|---|---|---|---|---|
| Class pilot (now) | ~60 | Free | Hobby | Supabase free | Gmail | none | **$0** |
| Branch | ~600 | Pro $25 | Hobby, or Pro $20 if ads | R2 ~free | Resend free + domain (~$1/mo) | Sentry/uptime free | **~$26–46** |
| College | ~5,000 | Pro $25 + compute add-on + PITR | Pro $20 | R2 ~$1–5 | Resend paid tier | Free tiers | **~$60–120** |

Ads (with college approval) and sponsored notice slots are meant to cover this.

## 14. Rollout plan

| Stage | Gate to move on | Work |
|---|---|---|
| **Pilot** (now) | Pilot success: ≥ 60% of the class weekly active for 3 weeks, no data loss, feedback acted on | Real content, exam mode, email + Drive backup set up, deploy |
| **Branch** | Load test passes on staging; restore drill done | Supabase Pro, Vercel `bom1`, R2, Resend + domain, Sentry + uptime, GitHub + CI/CD, staging, offline save, queues for email/files, student uploads + review queue |
| **College** | Branch running 1 month with error rate < 0.5% | Branch admins + RLS by branch, audit log, PITR, web push, DPDP follow-ups (languages, parental consent, legal review), materialised views, k6 at 1,000 users, runbooks |
| **More colleges** (optional) | — | `college` tenant id + RLS, per-college admins, a cost model per college |

## 15. Explicitly not doing (and when it would change)

| Not doing | Revisit when |
|---|---|
| Kafka | Replay, many independent consumers or multi-region event streams are needed |
| Microservices / Kubernetes | A team of several engineers owns separate parts |
| Redis | A §6 trigger fires |
| Read replicas | Primary CPU > 70% at peak after indexing + caching |
| Separate search engine | Search p95 > 300 ms after indexing |
| Native apps | PWA can't do something students need (PRD: not planned) |

## Sources
- Supabase pricing and limits: [supabase.com/pricing](https://www.supabase.com/pricing), [cloudzero](https://www.cloudzero.com/blog/supabase-pricing/), [jetadmin 2026 guide](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/)
- Supabase connection pooling: [pooling and limits](https://supabase.com/docs/guides/database/connecting-to-postgres/pooling-and-limits), [Supavisor FAQ](https://supabase.com/docs/guides/troubleshooting/supavisor-faq-YyP5tI)
- Vercel plans: [Hobby plan](https://vercel.com/docs/plans/hobby), [fair use guidelines](https://vercel.com/docs/limits/fair-use-guidelines)
- Cloudflare R2: [R2 pricing](https://developers.cloudflare.com/r2/pricing)
- Upstash Redis: [pricing](https://upstash.com/pricing/redis), [billing docs](https://upstash.com/docs/redis/overall/billing)
- Postgres queues vs Kafka: [Supabase Queues](https://supabase.com/docs/guides/queues), [Conduktor: Kafka vs Postgres](https://www.conduktor.io/glossary/kafka-vs-postgres), [pgmq in production](https://dev.to/mwiginton/supabase-queues-in-production-dead-letter-queues-retries-and-poison-messages-with-pgmq-28dp), [Gunnar Morling](https://www.morling.dev/blog/you-dont-need-kafka-just-use-postgres-considered-harmful)
