# [App Name]

Web library for the AI-ML branch: subjects → chapters → study material, previous and regular exam papers, notices and campaigns, learning tools, and a student/admin split.

**Status:** documentation stage. No application code yet. Order of work: docs approved → Figma designs approved → build → motion.

## Docs
| File | Answers |
|---|---|
| [PRD](docs/PRD.md) | What are we building? |
| [UX_FLOWS](docs/UX_FLOWS.md) | What does the user do? |
| [DESIGN_SYSTEM](docs/DESIGN_SYSTEM.md) | How should it look? |
| [ARCHITECTURE](docs/ARCHITECTURE.md) | How does it work? |
| [DATABASE](docs/DATABASE.md) | What data is stored? |
| [API](docs/API.md) | How do parts talk? |
| [SECURITY](docs/SECURITY.md) | What's protected? |
| [CODE_STYLE](docs/CODE_STYLE.md) | How is code written? |
| [TESTING](docs/TESTING.md) | How do we know it works? |
| [AGENTS](docs/AGENTS.md) | How should the AI agent behave? |
| [ROADMAP](docs/ROADMAP.md) | What comes when? |

## Stack
Next.js (TypeScript) · Tailwind · Supabase (Auth, Postgres + RLS, Storage) · Vercel · AdSense

## Setup (once code exists)
1. Copy `.env.example` to `.env.local` and fill in the values
2. `npm install`
3. `npx supabase start && npx supabase db reset`
4. `npm run dev`
