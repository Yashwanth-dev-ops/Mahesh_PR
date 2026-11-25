# Product

<!-- impeccable:product-schema 1 -->

Source: `../docs/PRD.md` (confirmed by the user, 2026-11-20; pilot facts added 2026-11-25). The PRD stays the detailed authority; this is the short record.

## Platform

web

## Users
- **Students** of one college's AI-ML branch, mostly on phones, between classes and before exams. Job: find the right notes or past paper for a subject and chapter fast, study it, and share their own material.
- **Admins** (faculty, library coordinator, chosen student leads), mostly on desktop. Job: review uploads and keep subjects, chapters, papers, notices and users in order.

## Product Purpose
One trusted place per subject → chapters → material, with past and regular question papers and college notices beside it. It replaces scattered WhatsApp groups and Drive links. Success: most of the branch signs up in month one, every current-semester chapter has approved material by month two, and there are zero duplicate files.

**Pilot first:** the first release serves one AI-ML class and must be ready before that class's exam (about two weeks from 2026-11-25). Other classes, years and branches come after the pilot proves out.

## Positioning
Every upload is checked by an admin, and the same file can never be added twice (SHA-256 hash check, even when renamed). Material is organised by the branch's own subjects and chapters, with study tools on each chapter (reader with progress, notes, important questions; quizzes, flashcards and discussion later).

## Operating Context
- Two logins: student and admin (admins are created only by admins).
- B.Tech runs 4 years (I–IV year). Lateral-entry students (diploma holders) join directly in II year, so they study 3 years; they are on the same class lists and sections as regular students from II year on.
- Student sign-up runs against a class roster: an admin uploads the class list as CSV (roll_no, full_name, year, section). A student who signs up with a roll number and name that match the list gets in at once. Anyone not on the list, with a name that differs, or signing up with Google waits as "pending" until an admin approves or rejects them. Re-importing the list approves pending students who now match.
- Pilot content is loaded by an admin from a folder with an import script (subjects, chapters, PDFs, past papers). Student uploads come after the pilot.
- Materials are behind login; only the landing page and login are public.
- Notices categories: Notice, Exam, Event, Campaign, Placement.
- Papers filtered by subject, regulation (R20, R23), exam type, year, month.

## Capabilities and Constraints
- Stack: Next.js (App Router) + Supabase (auth, Postgres with RLS, storage) on Vercel. Must run on free tiers; 25 MB upload limit.
- Ads: none in the pilot. Later, AdSense only in fixed slots (home feed, subject list, papers list, notices archive), never in the reader, quiz, upload form, login or admin pages. College approval for ads is still open.
- Each chapter, as built: notes text, files (read in the app or download), important questions with an "I know this" mark, and a "mark chapter as done" that feeds progress on Home and Subjects.
- Bulk registration (admins creating every account from the CSV and handing out passwords) is not built; the roster import gives the same one-step result without passwords to distribute. Add it only if students can't sign up themselves.
- Not in v1: AI study assistant, code practice lab, native apps, other branches, payments, direct messages.
- Open: Python runner in v1, a third faculty role, self-signup vs CSV, which years launch first.

## Brand Commitments
- Name: **StudyDashBoard** (decided 2026-11-25). Set once in `APP_NAME` (src/lib/site.ts); the logo square shows its first letter.
- Never use the college's name or logo.
- No copyrighted textbook PDFs; takedown contact on every page.

## Evidence on Hand
No real users, testimonials, download counts or uploads yet. Sample data in designs (student "Priya", subject AI3201) is placeholder and must not be presented as real proof.

## Product Principles
1. Trust over volume: checked, unique material beats a big pile.
2. Phone first for students: the common path works one-handed on a small screen.
3. Find it in three taps: subject → chapter → material.
4. Ads pay the bills but never get in the way of studying.

## Accessibility & Inclusion
WCAG 2.2 AA. Respect reduced-motion. Must work on low-end Android phones and slow mobile data.
