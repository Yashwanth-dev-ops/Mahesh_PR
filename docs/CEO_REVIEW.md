# CEO review: class pilot

Date: 2026-11-24 · Reviewed: PLAN_V2.md, ALGORITHMS.md, the built app (phases 1–2) · Mode: **scope reduction for the pilot** (condensed review, usage-saving)

## Decisions (user, 2026-11-24)
1. **Focused pilot**, not the full plan.
2. The class's next exam is **within 2 weeks** → ship before it.
3. **No ads in the pilot.** Revisit after several hundred weekly users and college approval.

## Premise
- **Real problem:** one AI-ML class's notes and past papers are scattered (WhatsApp, Drive), and the prototype only works on one phone (localStorage).
- **Pilot success:** during exam week, most of the class opens it at least twice a week, and students say it saved them time.
- **Cost of doing nothing:** the prototype can't be shared, so every student rebuilds their own notes before exams.

## Biggest risks (in order)
1. **Empty shelves.** The library has 15 sample chapters. If the real subjects, chapters and past papers aren't in before launch, students open it once and leave. *Content beats features.*
2. **Everyone is "pending" on day 1.** Activation needs the roster (roll number + name). There's no roster import yet, so every sign-up would wait for an admin.
3. **Password reset doesn't reach students.** No mail service is connected, so "Forgot password" means a support message to your brother.
4. **No signal.** Without a feedback button and usage numbers, we won't know what to fix after exam week.
5. **Scope.** 7 phases and 14 algorithms is a 6-month plan; the exam is in 2 weeks.

## Pilot scope (ship before the exam)
| # | Item | Why | State |
|---|---|---|---|
| 1 | Accounts (roll no + Google), reset, admin login | Get in | ✅ done |
| 2 | Home, subjects, chapters (notes + PDFs), reader with resume, my notes, search | Study | built, needs styling + test |
| 3 | **Roster import** (CSV: roll no, name, year, section) | Day-1 activation | new: script now, admin screen later |
| 4 | **Real content**: the class's actual subjects/chapters + PDFs, via an admin import script from a folder | Full shelves | new |
| 5 | **Past papers** per subject (list + read/download), loaded by admin | #1 exam need | new (lite phase 4) |
| 6 | **Notices** (admin posts; banner on home) | Exam dates, changes | new (lite) |
| 7 | **Feedback button + usage numbers** (weekly active, chapters opened) | Learn | new (lite) |
| 8 | Mail service (Resend free tier) for password resets | Fewer support messages | new, needs your account |
| 9 | Deploy + share link in the class group, "Install app" tip | Distribution | at launch, when you say so |

## Deferred until the pilot proves people come back
Student uploads + review queue, near-duplicate detection, points/trust, discussion, flashcards with FSRS, exam-priority algorithm, trending/Wilson ranking, AI search/assistant, ads, GitHub/LinkedIn. All stay in PLAN_V2 / ALGORITHMS.md as the post-pilot roadmap.

## 12-month picture
```
TODAY                         PILOT (2 weeks)                    12 MONTHS
prototype on 1 phone   --->   one class, real notes + papers --> whole college, every branch;
15 sample chapters            before exams, feedback loop        exam mode is why students open it;
                                                                 student uploads keep shelves full;
                                                                 AI tutor on the college's own notes
```

## Two weeks, roughly
- **Days 1–3:** finish phase 2 (styles, phone/desktop test), roster import, content import script.
- **Days 4–7:** past papers + notices + feedback/usage; your brother loads the real subjects and papers.
- **Days 8–10:** mail service, final test with 3–5 classmates, fix what they hit.
- **Day 10–11:** deploy and share in the class group before exam week.

The content load (item 4) depends on your brother collecting the class's PDFs and past papers. **Start that today**, in parallel with the build.
