# Design System

Status: DIRECTION DRAFT. The final tokens are set during the Figma step using the `impeccable` and `design-taste-frontend` skills and checked against `modern-web-guidance`. Motion is added last with `design-motion` and `design-motion-principles`. Update this file with the approved Figma values before coding.

## 1. Direction
- **Feel:** a calm, well-lit reading room. Content first, not a flashy dashboard.
- **Principles:**
  1. Reading comes first: big readable text, generous line height, no distractions in the reader.
  2. Every count is real: chapter and material counts come from data, never decoration.
  3. One primary action per screen.
  4. Mobile first: thumb-reachable bottom nav on phones, sidebar on desktop.
  5. Ads look like ads: clearly labelled, never styled to look like content.
- **Avoid (AI-slop tells):** purple-blue gradients, glassmorphism, glow effects, emoji as icons, bento grids for everything, centred hero with a gradient headline.

## 2. Brand
- Name: StudyDashBoard (decided 2026-11-25). Do not use the college name or logo anywhere in the UI, code, domain or metadata. Use a neutral placeholder wordmark in Figma.
- Voice: friendly senior student. Short, plain, encouraging. ("Be the first to upload", not "No data found".)

## 3. Color: black, yellow, white (chosen by the user, matches the Figma `Color` collection)
Use semantic tokens only. Never hard-code hex values in components.
| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | #FAFAF7 | #0A0A0A | page |
| `--surface` | #F1F1EC | #161616 | tracks, inset areas |
| `--card` | #FFFFFF | #1C1C1C | cards |
| `--ink` | #0A0A0A | #FAFAF7 | text, icons |
| `--ink-muted` | #5B5B57 | #A6A6A0 | meta text (≥ 4.5:1) |
| `--border` | #E3E3DC | #2E2E2C | dividers, card edges |
| `--primary` | #0A0A0A | #FFD60A | primary buttons, active states |
| `--primary-ink` | #FFFFFF | #0A0A0A | text on primary |
| `--primary-soft` | #FFF3B8 | #332B00 | chapter numbers, pinned, selected chips |
| `--accent` | #FFD60A | #FFD60A | progress bars, highlights |
| `--success / --warning / --danger` | #1F7A4D / #9A5800 / #B42318 | #5CC08C / #E3A24A / #F07A6E | states, with matching `-soft` fills |

Rules: yellow is never used for text on a light background (it fails contrast). Yellow text appears only on black. In light mode yellow is only a fill (progress bars, highlights, soft chips) behind black text.
Dark mode is required and follows the OS setting, with a manual toggle.

## 4. Typography
- UI: Schibsted Grotesk (400 text, 500 headings/labels, 600 card titles). Codes, counts and dates: JetBrains Mono 500. Both are Google Fonts.
- Scale (rem): 0.75 · 0.875 · 1 · 1.125 · 1.25 · 1.5 · 2 · 2.5. Body 1rem / 1.6. Headings 1.2.
- Max line length for reading: 70ch.

## 5. Spacing, radius, shadow
- Base 4px. Scale 4, 8, 12, 16, 24, 32, 48, 64.
- Radius: 6 (inputs, buttons), 10 (cards), 999 (chips).
- Shadows: one subtle elevation for cards and one for popovers. Prefer borders.

## 6. Components (all built once, then reused)
Button (primary / secondary / ghost / danger; loading and disabled), Input, Textarea, Select, File drop zone with progress, Chip/filter, Tabs, Card (subject, chapter, material, paper, notice), Progress bar, Badge (Pending / Approved / Rejected / Pinned / Sponsored), Avatar, Toast (Sonner), Dialog, Bottom sheet (mobile), Empty state, Skeleton, Pagination, Table (admin), Ad slot container (fixed height to avoid layout shift).

## 7. States
Each list or page defines: Loading (skeleton), Empty (message + one action), Error (what happened + retry), Success (toast), Disabled (reduced opacity + reason in a tooltip).

## 8. Icons
Lucide, outline, 20px default (16 in dense tables). No emoji icons.

## 9. Responsive
- Mobile < 640: bottom nav (Home, Subjects, Papers, Upload, Profile), single column
- Tablet 640–1024: two-column cards, collapsible sidebar
- Desktop > 1024: students get a top nav with pill links and search; admins get a black left sidebar. Content max 1200px, reader page max 680px, chapter list beside the reader
- Figma frames: phone 390×844, tablet 834×1194 (top bar + bottom tabs, 2-column grids), desktop 1440×900
- Buttons are pills (radius 999).

## 12. Landing page (decided 2026-11-21)
- **Colours:** option A, black, white and yellow (`#08090B` / `#F5F3EF` / `#FFC900`). The landing page uses the Dark token mode. The phone preview on it shows the app in Light mode.
- **Layout and intro:** option B "Stickers". A huge stacked headline ("Learn it. / Share it. / Ace it." with a yellow dot), a yellow disc with a dashed ring, the phone on the disc, and five tilted stickers (subject code, chapter count, file size, "No duplicates", paper date). Yellow stickers have black text. Outlined stickers have warm-white text and border.
- **Intro motion (built last):** the disc scales in and the ring draws, the headline lines slide up 80 ms apart, the phone drops onto the disc, then the stickers fly in from the screen edges. Hover lifts a sticker 2 px. Reduced motion shows everything at once.
- The other options (B lime, C teal & coral, D forest & crimson) stay on the Figma page "Landing options" for reference only. The Lime and Teal & coral token modes are not used by the app.

## 10. Accessibility (WCAG 2.2 AA)
Semantic HTML, contrast ≥ 4.5:1 for text, full keyboard navigation, visible focus ring, labels on every input, never colour alone (icons + text on badges), `prefers-reduced-motion` respected, alt text on images, reader works with screen-reader text layer where the PDF has text.

## 11. Motion (applied last)
Purposeful and short (150–250 ms), interruptible, and reduced under `prefers-reduced-motion`. Detailed rules are set in the motion step.
