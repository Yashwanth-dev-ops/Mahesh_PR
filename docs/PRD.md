# PRD — StudyDashBoard

Status: DRAFT, awaiting approval · Owner: (your brother) · Last updated: 2026-11-20

## 1. Product overview
- **Name:** StudyDashBoard (decided 2026-11-25)
- **One line:** A web library where AI-ML students learn subject by subject, share study material, and find previous question papers and college notices in one place.
- **Type:** Web app (responsive, mobile-first; most students will use phones)
- **Platform:** Web. No native app in v1.

## 2. Problem
- Notes, slides and question papers are scattered across WhatsApp groups and Google Drive links. They get lost, duplicated, or are outdated.
- Students can't see what a subject covers (how many chapters) or track how far they've studied.
- Notices and campaigns are missed because they're only on paper boards or in busy chats.

## 3. Goals
- **Primary:** One trusted place per subject → chapters → material, with no duplicates and admin-checked quality.
- **Secondary:** Help students study (reader, progress, quizzes, flashcards, discussion). Make college notices easy to see. Cover running costs with ads.

## 4. Users and roles
| Role | Who | Can do |
|---|---|---|
| **Student** | AI-ML branch students | Log in, edit profile + bio, browse subjects/chapters, read, download, upload material (goes to review), take quizzes, use flashcards, comment, report content |
| **Admin** | Faculty / library coordinator / chosen student leads | Everything a student can, plus: approve/reject uploads, manage subjects, chapters, question papers, notices, quizzes, users, reports, ads |

There is no public (logged-out) access to materials. The landing page and login are public.

## 5. User stories
- As a student, I want to sign in with my college identity so that only students of our college use the library.
- As a student, I want a profile with my photo, roll number, year and a short bio so that others know who shared material.
- As a student, I want to see each subject with its chapter count so that I know what it covers.
- As a student, I want to open a chapter and read, download or upload material for it.
- As a student, I want my upload rejected automatically if the same file already exists so that the library has no duplicates.
- As a student, I want to track which chapters I've finished.
- As a student, I want quizzes and flashcards per chapter to revise.
- As a student, I want to ask doubts under a chapter.
- As a student, I want previous and regular exam question papers filtered by subject, regulation and year.
- As a student, I want to see current notices and campaigns on my home screen.
- As an admin, I want a review queue for uploads so that only good material goes live.
- As an admin, I want to manage subjects, chapters, users, notices and ads from one dashboard.

## 6. Core features (v1)

### F1 — Authentication (two logins)
- Separate entry points: **Student login** and **Admin login** (same auth system; role decides where you land).
- Students sign up with email + password and **roll number**. The account works only if the roll number is on the admin-imported student list (CSV). Otherwise it stays `pending` until an admin approves it.
- Admin accounts are created only by an existing admin. No public admin signup.
- Acceptance: a student can't open any admin page (server-checked); a suspended user is logged out and blocked.

### F2 — Profile and bio
- Fields: full name, roll number (read-only after verification), year, section, avatar, bio (≤ 300 chars), optional links (GitHub, LinkedIn).
- Public profile page shows name, avatar, year, bio and approved uploads count.
- Acceptance: bio is plain text (no HTML); avatar ≤ 2 MB, JPG/PNG/WebP.

### F3 — Subjects and chapters
- Subjects are grouped by year → semester. Each subject card shows: code, name, **chapter count**, material count, the student's progress %.
- Clicking a subject lists chapters (number, title, material count, done ✓).
- Admins create/edit subjects and chapters. Students cannot.
- Acceptance: chapter count always equals the number of chapters stored (computed, never typed in by hand).

### F4 — Chapter page: learn, download, upload
- Tabs: **Learn** (in-browser PDF/notes reader), **Materials** (list with download), **Quiz**, **Flashcards**, **Discussion**.
- Reader remembers the last page; "Mark as done" updates progress.
- Download counts are tracked.
- Upload: title, type (notes / slides / PDF / lab record / link), file. Goes to the review queue.
- **No duplicates:**
  1. The server computes a SHA-256 hash of the file. If the same hash already exists anywhere (any status except rejected), the upload is refused and the existing item is shown.
  2. If a material with a very similar title already exists in the same chapter, the uploader is warned before submitting (they can still submit, and the admin decides).
- Acceptance: uploading the same file twice, even renamed, is always blocked.

### F5 — Question papers
- Two kinds: **Previous question papers** and **Regular exam papers** (plus Mid-1 / Mid-2 / Supplementary as sub-types).
- Filters: subject, regulation (e.g. R20, R23), exam type, year, month.
- Students can upload papers (same review + duplicate rules). Admins can upload directly.

### F6 — Notices and campaigns
- Categories: Notice, Exam, Event, Campaign, Placement.
- Fields: title, body, optional attachment/image, pinned, publish date, expiry date.
- Home screen shows pinned + latest unexpired notices. Expired notices move to an archive.
- Only admins create notices.

### F7 — Quizzes and flashcards
- Per chapter. Admins create them; students can suggest a quiz or deck (goes to review).
- Quiz: MCQ questions with one correct answer and an explanation. Score saved per attempt.
- Flashcards: front/back, flip, "know it / again" sorting (no long-term spaced repetition in v1).

### F8 — Discussion per chapter
- Threaded comments, one level of replies. Edit within 15 minutes, delete own comment.
- Report button. Admins can hide comments and suspend users.
- Basic rate limit: 10 comments per user per 10 minutes.

### F9 — Admin dashboard
- Review queue (materials, papers, quizzes, decks) with preview, approve, reject with reason.
- Manage: subjects, chapters, question papers, notices, users (import CSV, approve, suspend, change role), reports, ad slots.
- Stats: users, uploads per week, top downloads, pending items.
- Every admin action is written to an audit log.

### F10 — Ads (revenue)
- Google AdSense display ads in fixed slots only: home feed (between sections), subject list (after every 6 cards), question papers list, notices archive.
- **Never** inside the reader, quiz, upload form, login or admin pages.
- Admin can switch each slot on/off. One global "ads off" switch.
- Optional later: sponsored notice slot sold directly to local coaching centres or companies, clearly labelled "Sponsored".

## 7. Non-goals (not in v1)
- AI study assistant (phase 2)
- Code practice lab / compiler and shell (phase 2, see open questions)
- Native mobile apps
- Other branches (data model supports them, UI launches with AI-ML only)
- Payments or premium plans
- Chat / direct messages between students
- Spaced-repetition scheduling

## 8. MVP scope
- **Must have:** F1, F2, F3, F4 (with duplicate block), F5, F6, F9
- **Should have:** F7, F8, F10
- **Phase 2:** AI study assistant (chapter Q&A, summaries), code practice lab, more branches, sponsored slots, leaderboard

## 9. Success metrics
- 60% of AI-ML students sign up within the first month
- ≥ 1 approved material per chapter for every current-semester subject by end of month 2
- 0 duplicate files (by hash) in the library
- Median review time for uploads < 48 h
- Ad revenue covers hosting costs by month 4 (if hosting goes past free tiers)

## 10. Constraints
- **Cost:** must run on free tiers (Vercel Hobby, Supabase Free: 500 MB database, 1 GB file storage) at launch. File size limit 25 MB per upload to stay within storage.
- **Ads:** AdSense needs its own domain, real content and policy approval. Ads must not cover content.
- **Branding:** the app does not use the college name or logo. The final product name is decided at the end of the project.
- **Copyright:** no copyrighted textbook PDFs. Admins reject them, and there is a takedown contact on every page.

## 11. Assumptions
- Students have email addresses (personal Gmail is fine) and know their roll numbers.
- At least one faculty member or coordinator will act as admin and review uploads.
- Regulation codes (R20/R23…) and subject lists come from the college syllabus.

## 12. Open questions
1. **Practice lab:** should v1 include a simple in-browser Python runner (runs free inside the browser, no server cost), or wait for phase 2 together with C/Java (needs a paid code-execution service)?
2. Is anyone besides admins (e.g. faculty with limited rights) needed as a third role?
3. Can students self-sign up with an admin approving them, or will the college always provide a roll-number CSV?
4. Has the college approved running ads on the site? (AdSense also needs its own domain.)
5. Which years/semesters go live first (all four years of AI-ML, or the current batch only)?

## 13. Definition of done (v1)
- All Must-have features meet their acceptance criteria
- Critical flows pass end-to-end tests (see TESTING.md)
- Build, lint and type check pass
- Security checklist complete (SECURITY.md)
- Docs updated to match what was built
