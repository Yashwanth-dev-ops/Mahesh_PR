# Algorithms, logic and features

Status: PROPOSAL · 2026-11-24 · Companion to PLAN_V2.md. Each item says **what problem it solves**, **the algorithm**, **when** (phase), and **cost**. Pick the simple version first; upgrade only when the pilot data says so.

## 1. Analysis: what the app must be good at

| Job | Today | Gap |
|---|---|---|
| Find the right material fast | Subjects → chapters, simple search | Search misses typos and meaning; no "what next" |
| Trust the material | Admin review, exact-file duplicate block | Re-scanned or slightly edited copies still get in |
| Actually learn it | Read + "I know this" | No recall schedule; "done" = clicked a button |
| Pass the exam | — | No link between past papers and chapters; no revision priority |
| Keep contributing | — | No reason to upload; no quality ranking |
| Stay fast & safe at 1 → 60 → 600+ students | Indexes, RLS, views | No rate limits; notifications not designed for fan-out |

## 2. Recommended algorithms

### A. Duplicate & near-duplicate detection (Phase 3: upload)
1. **SHA-256 of the file** (done): blocks the exact same file, even renamed.
2. **MinHash / SimHash on extracted text**: catches the *same notes* saved again, re-exported or lightly edited. Extract text (pdf.js), make 5-word shingles, keep a 64-bit SimHash. Hamming distance ≤ 3 → "Looks like *Unit 2 notes* already exists" (warn, admin decides). Cheap: one 64-bit column + index.
3. **Perceptual hash (pHash) of page 1** for scanned/photo PDFs with no text.
4. **Trigram similarity on titles** (pg_trgm, index exists): the "similar title" warning while typing (> 0.6 in the same chapter).

### B. Spaced repetition (Phase 6: flashcards / Test me)
- **FSRS** (Free Spaced Repetition Scheduler, now Anki's default). It predicts each card's recall probability and schedules the next review when recall would drop to ~90%. Library: `ts-fsrs` (MIT, TypeScript). Store per user × card: `due, stability, difficulty, reps, lapses, last_review`. Buttons: Again / Hard / Good / Easy.
- Fallback if we want zero dependencies: **SM-2** (classic Anki, ~30 lines). FSRS needs ~20–30% fewer reviews for the same retention, so it's the "best" pick.

### C. Mastery per chapter → "weak chapters" (Phase 6)
- **Exponentially weighted accuracy**: mastery = EWMA of quiz/flashcard results (α ≈ 0.3), so recent answers count more. 0–100%.
- Shown as the ring on each chapter. "Done" becomes *read + mastery ≥ 70%*. That's honest progress, not just clicks.
- (Bayesian Knowledge Tracing is the research-grade version; not worth it until thousands of answers exist.)

### D. Exam revision priority (Phase 4: exam mode)
For each chapter before an exam:

`priority = exam_weight × (1 − mastery) × urgency`

- `exam_weight` = share of past-paper marks from this chapter (count questions tagged to the chapter over the last N papers; recent years weigh more).
- `urgency` = 1 / max(1, days_to_exam) scaled, so it grows as the exam nears.
- Output: "Revise these 5 chapters first", each with its past-paper questions. Pure SQL, no ML.

### E. Search (Phase 2 now → Phase 4 better → later AI)
1. Now: `ILIKE` + trigram index (done), fine for one class.
2. Next: **Postgres full-text search**: `tsvector` column on sections/materials/papers, `websearch_to_tsquery`, ranked by `ts_rank` + boosts (title > heading > body; recent > old). Trigram as the typo fallback ("nueral" → neural).
3. Later (AI assistant): **pgvector embeddings + hybrid search (BM25 + vector, Reciprocal Rank Fusion)**. The same index powers RAG answers that cite the exact chapter.

### F. Ranking materials (Phase 3)
- **Wilson score lower bound** on helpful 👍/👎. It ranks "9 of 10 found it useful" above "1 of 1", so new uploads can't game the top.
- **Trending** this week: score = log(1 + unique readers) with time decay (half-life 7 days, Hacker-News style). Count *unique* students, never raw clicks.

### G. "What to study next" (Phase 2 simple → Phase 6 smarter)
1. Rule-based now: continue the last chapter → next unread chapter in that subject → weakest chapter.
2. Later: **item-item co-occurrence** ("students who read this also read…"), computed nightly. Only useful once there are enough students.

### H. Contributor points & trust (Phase 3)
- +10 approved upload, +1 per *unique* downloader (capped, log-scaled), −5 rejected, 0 for duplicates.
- **Trust score** = approved ÷ (approved + rejected), smoothed with a prior (Laplace). High-trust uploaders go to the top of the review queue; it still never auto-approves.
- Monthly "top contributors" resets, so newcomers can win.

### I. Review queue ordering (Phase 5)
`priority = age_hours + 24 × near_duplicate_flag + 12 × reports − 6 × uploader_trust`. Oldest and riskiest first; nothing waits forever.

### J. Rate limiting & abuse (Phase 3, before the branch launch)
- **Sliding-window counter** in Postgres (or Upstash Redis on Vercel): login 5/min per roll, uploads 10/day, comments 10 per 10 min, reset emails 3/hour.
- This fixes the known gap: server-side login currently shares one IP limit for everyone.

### K. Notifications that scale (Phase 4)
- **Fan-out on read**: one `notices` row with an audience (all / year / section / user); each student's bell = matching notices minus their read receipts. 1 row per notice, not 600.
- Pop-up after login for unseen pinned notices (the prototype's idea).

### L. Streaks & habit (Phase 2/6)
- Study day = any read/quiz activity in **IST**. Count days this week; weekly goal (e.g. 4 days). Optional "freeze" days; no guilt.

### M. File → chapter conversion (Phase 5, admin)
- pdf.js text with positions → **heading detection** (font size ≥ 1.25× body, or bold, or "Unit/Chapter N" patterns) → sections. DOCX: heading styles. Photos: Tesseract OCR (as in the prototype), always shown for review before saving.

### N. Analytics for the pilot (Phase 5)
- Weekly active % of the class, activation (signed up → opened a chapter in 24 h), chapters never opened, average mastery per subject. Simple `events` table + SQL views; no third-party tracker (privacy, cost).

## 3. Features ranked by value for the class pilot

| Rank | Feature | Phase |
|---|---|---|
| 1 | Chapter notes + PDFs, reader with resume, search | 2 |
| 2 | Past papers linked to chapters + exam mode priority list | 4 |
| 3 | Notices with bell + pop-up + targeting | 4 |
| 4 | Upload with duplicate + near-duplicate check, review queue | 3 / 5 |
| 5 | Test me + FSRS flashcards + mastery rings | 6 |
| 6 | Points, trust, top contributors | 3 |
| 7 | Discussion / doubts per chapter | 6 |
| 8 | Pilot analytics + feedback button | 5 |
| Later | AI assistant (RAG on pgvector), code lab, GitHub/LinkedIn on profiles | — |

## 4. New dependencies this would add
- `ts-fsrs` (spaced repetition), `tesseract.js` (OCR, admin only, loaded on demand), optionally `pgvector` (Supabase extension, later). Everything else is Postgres + existing libraries.
