# Plan v2: better than the "AI & ML Study Hub" prototype

Status: DRAFT for approval · 2026-11-24 · Inputs: the brother's prototype (`AI & ML Study Hub (2).html`), PRD.md, research below.

Goal: test with one class first, then grow to the whole branch, then other branches, without rebuilding.

## 1. What the prototype gets right (keep)

| Idea | Why it works |
|---|---|
| Chapters written as short **sections** (heading + text), with search and Prev/Next | Reads well on a phone; faster than opening a PDF |
| **Important questions** per chapter, with "I know this" | Exam-focused; students revise what gets asked |
| Progress per subject, "chapter marked as read", a small celebration at 100% | Visible progress keeps people coming back |
| **Your written notes** per subject | Students' own summaries in one place |
| Admin **notifications** (to everyone or to one student), shown in a bell and as a pop-up after login | Replaces WhatsApp announcements |
| Admin turns a **PDF / DOCX / photo (OCR) into chapters** | Fast way to fill the library |
| Installed on the phone home screen (the APK you sent is Chrome's install of it) | Students already use it like an app |

## 2. What the prototype can't do (fix)

| Problem | Our fix |
|---|---|
| Everything lives in one browser's `localStorage`: other students and devices see nothing | Supabase database + storage (done in phases 1–2) |
| Passwords stored in plain text; admin password is in the page source | Supabase Auth, roll-number login, roles checked on the server (done) |
| Only the admin can add content | Students upload; admins review; **the same file can never be added twice** |
| "Read" = opened the chapter | Progress = read **and** recalled (quiz/flashcard results) |
| No past papers, no notice categories or archive | Question papers by subject/regulation/year; notices by category |
| One big page, no URLs | Real pages with links you can share ("open chapter 3 of ML") |

## 3. What makes it the best (research-backed additions)

1. **Recall, not rereading.** Learning research and every top study app (Anki, Quizlet, NotebookLM) centre on retrieval practice and spaced repetition. Important questions become a **"Test me"** mode and flashcards with simple spacing (Again / Good / Easy, next review date). This is lighter than full Anki, and it upgrades a PRD non-goal, so it needs a yes.
2. **Exam mode.** When an exam notice is published, every subject in it shows a countdown, your weakest chapters, and its past papers, with each paper question linked to the chapter it belongs to ("asked in Nov 2024").
3. **Notes + PDFs together.** A chapter has readable sections (the prototype's strength) **and** attached materials (PDF/slides) in a proper reader that remembers your page.
4. **Install it like an app (PWA).** Home-screen icon, opens full-screen, and the last chapters you read work offline in college Wi-Fi dead zones.
5. **Contribution that's rewarded fairly.** Points and a monthly "top contributors" list for *approved* uploads only (Studiva-style), never for spam.
6. **One search** across subjects, chapters, sections, papers and notices.
7. **Streaks without guilt.** A "days studied this week" count and a gentle weekly goal; no lost-streak punishment (streaks motivate, but no evidence shows they teach).
8. **Admin insight.** Who's active this week, most-read and never-read chapters, unanswered doubts. This replaces the prototype's "who is online" table.

## 4. Built to scale from one class

- Every row already carries **branch / year / semester / section**; adding a class or branch is data, not code.
- Counts are computed (views), lists are indexed, files are hashed, and file access is via short-lived links.
- **Pilot switches:** features can be turned on per class (e.g. ads off during the pilot).
- **Pilot metrics** (shown to admins): weekly active students %, chapters with material, approved uploads, average quiz score, plus an in-app feedback button.
- Before the whole branch joins: a mail service (confirmations and resets), a per-account login limit, and the Vercel/Supabase plan check (see costs).

## 5. Phases (revised)

| # | Phase | Contents |
|---|---|---|
| 1 | Accounts ✅ | Roll-number + Google login, sign-up with photo, reset password, admin login |
| 2 | **Learn** | Home dashboard, subjects, chapter page (sections + materials + important questions), PDF reader with resume, progress, search, PWA install |
| 3 | Contribute | Student upload, SHA-256 duplicate block, similar-title warning, admin review queue, points |
| 4 | Exams & notices | Question papers + filters, notices with categories, bell + pop-up + targeting (all / year / section / one student), exam mode |
| 5 | Admin | Users & roster CSV, approve/suspend, subjects & chapters editor, **file → chapter converter with OCR**, analytics, audit log |
| 6 | Practice | Test me (quizzes), flashcards with spacing, chapter discussion / doubts |
| 7 | Pilot launch | Mail service, rate limits, feedback, deploy, then ads (college approval first) |
| Later | | GitHub + LinkedIn on profiles (field already exists), AI study assistant, code practice lab, more branches |

## 6. Decisions (2026-11-24)

1. Look: **keep black/yellow** and the library card; borrow the prototype's subject icons, progress rings and the 100% celebration.
2. Chapters: **written sections + PDFs** (new tables `chapter_sections`, `important_questions`).
3. Flashcards: **spaced repetition (Again / Good / Easy) in phase 6**; PRD non-goal lifted.

## Sources
- Retrieval practice and spaced repetition in study apps: makeheadway.com/blog/best-study-apps, mindomax.com/best-study-apps-for-students, nibble-app.com/blog/best-study-apps-for-college-students, retain.cards/blog/top-free-apps-for-learning
- India notes/PYQ apps (points for sharing, browse by branch/semester): Studiva and GKV Study on Google Play, EasyPaper
- Quizzes and flashcards from uploaded sources: Google NotebookLM education update (workspaceupdates.googleblog.com, Sept 2025), TechRadar review
