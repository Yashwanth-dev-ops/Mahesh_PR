# API (server actions and route handlers)

Reads go through server components with the user's Supabase session (RLS applies). Writes go through these actions. All inputs are Zod-validated, and all actions check the session and role.

## Response shape
```json
{ "data": { }, "error": null }
{ "data": null, "error": { "code": "DUPLICATE_FILE", "message": "This exact file is already in the library", "details": { "existingId": "…" } } }
```
Error codes: `VALIDATION`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `DUPLICATE_FILE`, `DUPLICATE_PAPER`, `RATE_LIMITED`, `FILE_TOO_LARGE`, `UNSUPPORTED_TYPE`, `INTERNAL`.

## Auth
| Action | Who | Notes |
|---|---|---|
| `signUpStudent({fullName,email,password,rollNo,year,section})` | public | roll on roster → active, else pending |
| `signIn({rollNo,password})` | public | server looks up the email for that roll number, then signs in with Supabase. Wrong roll number and wrong password give the same error ("Roll number or password is wrong") so roll numbers can't be probed. Rate-limited |
| `adminSignIn({email,password})` | public | fails with FORBIDDEN unless role=admin |

## Profile
| `updateProfile({fullName?,bio?,links?,section?})` | self | bio ≤300 plain text |
| `uploadAvatar(file)` | self | ≤2 MB jpg/png/webp |

## Materials
| `requestUpload({chapterId,fileName,size,mime})` | student/admin | returns a signed staging upload URL. 10 uploads/day/user |
| `finalizeUpload({stagingPath,chapterId,title,type})` | student/admin | hash + duplicate check → pending (admin uploads → approved) |
| `addLink({chapterId,title,url})` | student/admin | normalised URL duplicate check |
| `similarTitles({chapterId,title})` | logged in | top 3 with similarity |
| `getDownloadUrl({materialId})` | logged in | approved only, 10-min signed URL, increments download_count |

Example `finalizeUpload` duplicate response:
```json
{ "data": null, "error": { "code": "DUPLICATE_FILE", "message": "This exact file is already in the library",
  "details": { "existingId": "8f1…", "title": "Unit 2 – Neural Networks notes", "chapter": "Ch 2" } } }
```

## Question papers
| `requestPaperUpload(...)` / `finalizePaperUpload({stagingPath,subjectId,kind,examType,regulation,examYear,examMonth})` | student/admin | hash + slot uniqueness |
| `getPaperDownloadUrl({paperId})` | logged in | |

## Learning
| `setProgress({chapterId,done?,lastMaterialId?,lastPage?})` | self | upsert |
| `submitQuiz({quizId,answers:number[]})` | self | server scores, returns explanations |
| `suggestQuiz({chapterId,title,questions[]})` | student | pending review |
| `suggestFlashcards({chapterId,cards[]})` | student | pending review |

## Discussion
| `postComment({chapterId,body,parentId?})` | active user | 10 / 10 min, depth 1 |
| `editComment({id,body})` | owner within 15 min | |
| `deleteComment({id})` | owner or admin | |
| `report({targetType,targetId,reason})` | logged in | 1 open report per user per target |

## Admin (all require role=admin and write audit_log)
| `reviewItem({type,id,decision:'approve'|'reject',reason?})` | reason required on reject |
| `bulkApprove({type,ids[] ≤20})` | |
| `upsertSubject`, `archiveSubject`, `upsertChapter`, `reorderChapters` | |
| `upsertNotice`, `deleteNotice` | |
| `importRoster(csv)` | columns roll_no, full_name, year, section; returns added/skipped |
| `setUserStatus({userId,status})`, `setUserRole({userId,role})` | can't demote yourself or the last admin |
| `hideComment({id})`, `closeReport({id})` | |
| `setAdSlot({key,enabled,adsenseSlotId?})`, `setAdsGlobal({enabled})` | |
| `upsertQuiz`, `upsertFlashcards` | admin-made items are approved immediately |

## Route handlers
- `GET /api/health` → `{ ok: true }`
- `POST /api/cron/cleanup-staging` (Vercel Cron, secret header) → deletes staged files older than 24 h
