# Code Style

## Principles
- Readable over clever. Small focused functions. Reuse an existing component or util when one fits. Create a new one only when nothing existing can reasonably do the job.
- No abstraction "for later". No new dependency for something a few lines can do.

## Naming
| Thing | Convention | Example |
|---|---|---|
| Components | PascalCase file + export | `SubjectCard.tsx` |
| Hooks | `useX` camelCase | `useChapterProgress.ts` |
| Server actions | verbNoun camelCase | `finalizeUpload` |
| Files (non-components) | kebab-case | `file-hash.ts` |
| Constants | UPPER_SNAKE | `MAX_UPLOAD_BYTES` |
| DB | snake_case (see DATABASE.md) | `file_hash` |
| Routes | kebab-case, plural | `/question-papers` |

## Structure
Follow ARCHITECTURE.md §7. Feature code lives next to its feature. Shared primitives live in `components/ui`.

## Rules
- TypeScript `strict`. No `any` (use `unknown` + Zod).
- DB types are generated (`supabase gen types`) and never hand-written.
- Server actions return `{ data, error }` (API.md) and never throw to the client.
- Styling: Tailwind utilities + tokens. No hex colours in components. No inline styles except dynamic values.
- Components are server components by default. Add `"use client"` only for interactivity.
- Comments explain why, not what.
- Imports: absolute `@/` alias. Order: external, internal, relative.

## Tooling
Prettier, ESLint (next + jsx-a11y), `tsc --noEmit`.

## Don't
Duplicate utilities, call Supabase from UI components, change unrelated files, leave dead code or `console.log`.
