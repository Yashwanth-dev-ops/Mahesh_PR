# UX Flows

Every screen defines loading, empty, error and success states. Skeletons are used for loading lists. Spinners are used only on buttons.

## Site map
```
Public:   Landing → Student login / Sign up → Admin login
Student:  Home (notices + continue learning + subjects)
          ├─ Subjects → Subject → Chapter [Learn | Materials | Quiz | Flashcards | Discussion]
          ├─ Question papers (filters)
          ├─ Notices (current + archive)
          ├─ Upload (choose subject → chapter → file)
          └─ Profile (mine / others) · My uploads · Settings
Admin:    Dashboard → Review queue · Subjects & chapters · Question papers · Notices
          · Users · Reports · Ads · Audit log
```

## Flow 1 — Student sign up
1. Landing → "Student login" → "Create account"
2. Enter name, email, password, roll number, year, section
3. Client validates format. Server checks the roll number against the imported list
4. On the list → account active → email verification → Home
5. Not on the list → account `pending` → "Waiting for admin approval" screen
- Errors: roll number already registered → "This roll number already has an account. Forgot password?"; weak password → inline rule list
- Success: welcome toast + profile-completion nudge (avatar, bio)

## Flow 1b — Student login
1. Landing → "Student login" or "Sign in with roll number" → `/login`
2. Roll number + password → Home. Links: Forgot password, Create an account, Admin login (footer)
- Errors: empty or badly formed roll number and empty password are shown inline; wrong details → "Roll number or password is wrong"

## Flow 2 — Admin login
1. Landing → "Admin login" (small link in the footer + `/admin/login`)
2. Email + password → server checks role = admin → Admin dashboard
3. If a student tries this page → "This account has no admin access" (no hint about which admins exist)

## Flow 3 — Browse and learn
1. Home → Subjects (grouped Year → Semester)
2. Subject card: code, name, **N chapters**, M materials, progress bar
3. Tap subject → chapter list (number, title, materials, ✓ done)
4. Tap chapter → Learn tab opens the top-rated/first approved material in the reader, resuming at the last page
5. "Mark chapter as done" → progress updates on subject card and Home
- Empty chapter: "No material yet — be the first to upload" + Upload button
- Reader fails to load: show "Couldn't open this file" + Download instead

## Flow 4 — Upload material (no duplicates)
1. Chapter → Materials → "Upload" (or the global Upload button → pick subject → chapter)
2. Enter title and type, then pick a file (PDF, PPTX, DOCX, JPG/PNG, max 25 MB) or paste a link
3. While typing the title → similar titles in this chapter are shown: "Similar material already exists: …"
4. Submit → upload progress bar → server hashes the file
5. Hash already exists → "This exact file is already in the library" + link to it. Nothing is stored
6. New → status `pending` → "Sent for review. You'll be notified." → appears in My uploads as Pending
7. Admin approves → live, uploader notified. Rejected → reason shown in My uploads
- Errors: too big, wrong type, network drop (retry keeps form data)

## Flow 5 — Question papers
1. Question papers → tabs: Previous papers | Regular exam
2. Filters: subject, regulation, exam type, year (stay in the URL so links can be shared)
3. Paper row → preview → Download
- Empty filter result: "No papers match. Clear filters" + "Upload a paper"

## Flow 6 — Notices
1. Home shows pinned + 3 latest notices
2. Notices page: category chips, current vs archive
3. Notice detail: body, attachment, date, category
- Admin creates: title, body, category, attachment, pin, publish/expiry → preview → publish

## Flow 7 — Quiz and flashcards
1. Chapter → Quiz → start → one question per screen → submit → score + explanations
2. Chapter → Flashcards → tap to flip → "Know it" / "Again" → summary at end
- Empty: "No quiz yet". Students see "Suggest questions", which goes to review

## Flow 8 — Discussion
1. Chapter → Discussion → list (newest first) → write comment → post
2. Reply (one level), edit within 15 minutes, delete own, report
- Rate limit hit: "You're posting fast — try again in a few minutes"

## Flow 9 — Admin review queue
1. Dashboard shows the pending count → Review queue
2. Filter by type (material / paper / quiz / deck)
3. Open item → preview file + uploader + target chapter → Approve or Reject (reason required)
4. Bulk approve allowed for up to 20 items
- Every action is logged to the audit log

## Flow 10 — Profile
1. Avatar menu → My profile → edit name, avatar, bio, links → save
2. Other profile: name, avatar, year, bio, approved uploads list
