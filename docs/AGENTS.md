# AGENTS.md — AI coding agent rules

## Context
[App Name]: a web library for the AI-ML branch with student and admin logins, subjects → chapters → materials, question papers, notices, learning tools and ads. See PRD.md.

## Source of truth
Read the relevant files in `/docs` before any significant change: PRD, UX_FLOWS, DESIGN_SYSTEM, ARCHITECTURE, DATABASE, API, SECURITY, CODE_STYLE, TESTING, ROADMAP. If code and docs disagree, stop and flag it. Don't silently pick one.

## Workflow (this project)
1. **Design first.** UI is designed in Figma and approved before it's coded. Use `impeccable` + `design-taste-frontend` for design, `modern-web-guidance` for HTML/CSS/JS choices.
2. **Plan → approval → build** for every non-trivial change.
3. **Motion last.** Animations are added only after screens work, using `design-motion` + `design-motion-principles`, always respecting reduced motion.

## Rules
- Never use the college name or logo. The product name is a placeholder `[App Name]` until decided (keep it in one config constant `APP_NAME`).
- Never invent requirements, tables, columns, endpoints or components that the docs already define. Ask if something is undefined.
- Every write path: Zod validate → session → role → business rule → DB (RLS) → audit (if admin).
- Never let a student upload skip the hash duplicate check or the review queue.
- Never put the service-role key or secrets in client code.
- Never place ads in the reader, quiz, upload, auth or admin pages.
- Every UI state is built: loading, empty, error, success, disabled.
- Reuse `components/ui`. Follow tokens. No hex values in components.
- Keep changes focused. No unrelated edits, no new dependencies without reason.

## Validation before "done"
`npm run lint && npm run typecheck && npm run test && npm run build`, plus the relevant E2E flow. Review the diff for unintended changes.

## Docs
Update the matching doc when behaviour, schema, API, security, design or conventions change (see the table in the vibe-coding-blueprint skill).

## Completion summary
What changed · files · tests run · results · remaining issues · docs updated.
