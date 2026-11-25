# Testing

## Critical functionality
Auth + roles, duplicate blocking, review queue, RLS, downloads via signed URLs, progress, quiz scoring.

## Types
- **Unit (Vitest):** Zod schemas, URL normalisation, hash util, quiz scoring, rate-limit logic, title-similarity threshold.
- **Integration (Vitest + local Supabase):** every RLS policy (student vs admin vs suspended), upload finalize (duplicate / new / bad type), roster import, review approve/reject, comment depth and rate limit.
- **E2E (Playwright, mobile + desktop viewports):** the flows below.
- **Accessibility:** `@axe-core/playwright` on every main page. No serious violations.

## Critical E2E flows
1. Student signs up (roll on roster) → verifies → lands on Home
2. Student uploads a PDF → sees Pending → admin approves → student sees it live with the count updated
3. Same file uploaded again (renamed) → blocked with a link to the existing item
4. Student opens a chapter → reads → marks done → progress shows on the subject card
5. Student filters question papers → downloads one
6. Student opens `/admin` → gets 404
7. Admin posts a pinned notice → it appears on student Home
8. Student takes a quiz → sees score + explanations

## Coverage
Target ~70% on `src/server` and `src/lib`. UI is covered by E2E rather than snapshots.

## Commands
```
npm run test        # vitest
npm run test:e2e    # playwright
npm run lint
npm run typecheck
npm run build
```

## Definition of done
All of the above pass, the critical flow for the feature is verified in the browser, and there are no console errors.
