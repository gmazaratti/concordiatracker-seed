# ConcordiaTracker — Project Memory (read this first every session)

This file is the **source of truth** that survives context resets. If a decision
isn't written here, assume it'll be forgotten. Keep it updated as we go.

## What this is

The **SEED** of a real product: a school-specific academic hub for Concordia
University students. A front-end skeleton with **real navigation and
interactions, mock data, no backend, no auth, no real AI**. If it's good enough,
it becomes the production foundation — so code quality and structure matter.

Not affiliated with Concordia University (must appear on the landing page).

## Stack (standard on purpose)

- **Vite 8** + **React 19** + **TypeScript 6** (strict mode ON)
- **Tailwind CSS v4** via `@tailwindcss/vite` (CSS-first config, no `tailwind.config.js`)
- **React Router 7** (`react-router-dom`)
- State: **React Context + hooks only**. No Redux.
- Data: a **single mock-data module**, in-memory only. No persistence.
- `@/*` path alias → `src/*` (configured in `vite.config.ts` + `tsconfig.app.json`)

## Architecture — three separate authenticated contexts (NEVER blended into one nav)

1. **Public marketing site** (Landing, pricing)
2. **Student app** (the core product)
3. **Teacher portal** (a deliberately plain, distinct context)

### Student app: EXACTLY FOUR top-level destinations

`Today` · `Courses` · `Calendar` · `Community`. **Nothing else gets a tab.**
The AI parser and GPA predictor are **actions/panels inside Courses, NOT tabs**.

### Command palette is the real navigation spine

- `Cmd/Ctrl+K` → centered modal on desktop; bottom search bar on mobile.
- Typeahead suggestions like "Add course COMM 217", "Change grade for
  Assignment 2", "Import blueprint".
- **Keyboard a11y required**: full keyboard nav, visible focus states, Escape to
  close, focus trapped while open.

## Screens

- **Landing (public)**: dark, value-first. Hero = the syllabus-parse demo.
  Pricing with **SEMESTER pass ($15) as hero**, monthly ($5) secondary. Small
  "Not affiliated with Concordia University" line.
- **Today**: launch view — what's due, what's next, GPA at a glance, polished
  empty state. Minimal.
- **Courses + course detail**: editable mock grades, notes tab, **provenance
  badges on every date** (official / confirmed by N students / unverified), a
  WORKING grade-needed-to-pass calculator (real arithmetic), a GPA what-if
  slider (real arithmetic). Grade-needed = **FREE**; GPA prediction = **PAID**
  (made tangible in the UI).
- **Calendar**: month + week views; personal and university as **toggleable
  LAYERS, not separate tabs**.
- **Community**: intentionally **LIGHT** — read-only partnered-org event feed
  stub. NOT a social network.
- **Teacher portal**: one deliberately plain screen — search/create a class,
  upload a blueprint, post an announcement. Just enough to show a distinct context.
- **Settings**: clean profile, transparent billing (shows semester pass), usage
  stats, theme switcher.

## Design system

- **ALL tokens** (colors, type scale, spacing, radii) live in **ONE place** so
  re-skinning is a one-file change. Tailwind v4 `@theme` + CSS custom properties.
- Dark base, deliberately **OFF** the default Tailwind look (avoid slate-900
  `#0f172a` + violet-600 `#7c3aed`). Near-black with a faint cast; non-generic accent.
- **Theme switcher**, ≥2 themes: refined default dark, and a Concordia
  maroon/gold theme. Themes swap from the tokens file + a context.
- **Typography-led hierarchy**: a characterful display face for headings, a
  clean workhorse for UI. Load via Google Fonts CDN.

## Motion philosophy — restraint

- **ONE hero moment**: the syllabus-parse reveal. Click "Upload syllabus" → a
  scripted animation cascades dates into the course. Richer, deliberate treatment.
- Everything else functional and fast: **150–250ms** transitions, hover/active
  states, command palette open, task check-off.
- **Respect `prefers-reduced-motion`.** **CSS transitions/keyframes ONLY** — no
  animation library, no framer-motion.

## Real vs mocked

- **Real/interactive**: routing, command palette + typeahead, grade-needed calc,
  GPA what-if, theme switching, parse-reveal animation, task check-off, calendar
  layer toggles, contextual paywall nudge.
- **Faked**: AI extraction (scripted on a sample syllabus), auth, persistence
  (in-memory), Google Calendar sync (success state), teacher uploads, Stripe
  checkout (mock success).

## Product ideas to include

- Provenance badges as a visible, first-class system everywhere dates appear.
- A **"pain-moment" paywall**: a mock midterm-week state with many due items
  where the upgrade nudge appears contextually.
- Free/paid line made tangible (grade-needed free, GPA prediction paid).
- Credits-for-contributions in blueprint import ("contribute your outline → earn
  theme credits"). **NO leaderboard.**
- Deliberate, polished empty states.

## DO NOT BUILD

A backend · auth · a database · a leaderboard · a real friends graph (Community
stays a stub) · a full teacher portal (one representative screen) · a real parser.

## Discipline

- TypeScript **strict** on. Keep every file **under ~250 lines**; split larger
  into smaller components.
- When a design/structural decision is ambiguous, **STOP and ask one question**
  rather than guessing.
- After each screen: **commit to git** with a clear message and tell the user
  what to run to see it.

## "Good enough to be the SEED"

Clean component boundaries, all tokens in one file, no duplicated layout code;
the four carrier screens (Today, Course detail, Calendar, Landing) feel polished;
the parse-reveal animation lands. Rough edges on Community and Teacher are fine.
If cutting a corner that would make this hard to build on, **flag it**.

## Build order (commit after each)

1. scaffold + tokens/theme + app shell (sidebar + command palette)
2. Today
3. Courses + course detail
4. Calendar
5. Community stub
6. Teacher
7. Settings
8. Landing

## How to run

- `npm run dev` — dev server
- `npm run build` — typecheck (`tsc -b`) + production build
- `npm run preview` — preview the production build

## Decisions log

- **2026-06-14** — Tailwind **v4** (current standard) chosen over v3; its
  CSS-first `@theme` + CSS variables fit the "all tokens in one file" + theme
  switching requirement naturally. No `tailwind.config.js`.
- **2026-06-14** — Added `@/*` → `src/*` path alias for clean imports. `baseUrl`
  omitted (deprecated in TS 6); `paths` resolves from tsconfig location.
- **2026-06-14** — Scaffold complete; awaiting plan approval before building screens.
- **2026-06-14** — Plan approved. Git author set locally: Alex Degryse
  <alexxdegryse@gmail.com>.
- **2026-06-14** — Added `lucide-react` for icons (only non-core runtime dep;
  tree-shakeable, no animation deps). Approved.
- **2026-06-14** — Tokens live in `src/index.css`: semantic `--ct-*` vars per
  theme on `:root` / `[data-theme="maroon"]`, exposed to Tailwind via
  `@theme inline` so utilities (`bg-canvas`, `text-fg`, `bg-accent-soft`, …)
  swap at runtime. Reskin = edit that one file. Token utility names:
  canvas / surface / surface-2 / border / border-strong / fg / muted / subtle /
  accent(+hover/contrast/soft) / brand / success/warning/danger/info /
  prov-official/confirmed/unverified.
- **2026-06-14** — Theme state is **in-memory** (no localStorage), per the
  mock-only rule — resets to `dark` on full reload; persists across SPA nav.
- **2026-06-14** — Fraunces (display) is applied **deliberately via `font-display`
  only** (wordmark, page hero titles), never globally on heading tags, to honor
  "use Fraunces sparingly — never body/UI labels."
- **2026-06-14** — Mobile nav = bottom bar with the 4 destinations **+** a Search
  item that opens the palette as a bottom sheet (the "bottom search bar on mobile").
- **2026-06-14** — `plan` starts `'free'` so the free-vs-paid line + paywall nudge
  are demonstrable. A **dev-only segmented toggle** (Free | Semester) lives in the
  avatar menu, wired to `AppDataProvider.setPlan`, so BOTH monetization states are
  demonstrable without a backend. `'free'` shows paywall nudges; `'semester'` will
  show the active pass in Settings (step 7). Resets to `'free'` on reload.
- **2026-06-14** — Data layer: domain types (`Provenance`, `Assessment`, `Course`)
  in `src/data/types.ts`; the single mock module `src/data/mock.ts` seeds 5 courses
  + assessments with dates **relative to the runtime clock** (`daysFromNow`) so the
  overdue/this-week story is always true. `AppDataProvider` clones the seed and owns
  `toggleDone` + `setPlan` (in-memory). Helpers: `lib/date.ts` (relative due labels),
  `lib/gpa.ts` (Concordia 4.30 scale, weighted course % + credit-weighted GPA).
- **2026-06-14** — Step 1 shipped: tokens + 2 themes, 3-context routing, sidebar
  (4 dests), command palette (Ctrl/Cmd+K, kbd nav, focus trap, Esc, mobile sheet),
  avatar menu (Settings/Teacher/Marketing/theme), placeholder pages. Build + lint
  clean; browser-verified.
- **2026-06-14** — Step 2 (Today) shipped. Three zones only: a compact GlanceStrip
  (GPA / due-this-week / next upcoming deadline), an optional pain-moment `PainNudge`
  (shown ONLY when `plan==='free'` AND ≥5 items active → links to the Courses GPA
  predictor), and the scannable `DueList` centerpiece (Overdue + This week, grouped,
  working check-off → "Completed today" disclosure with undo, polished "All caught
  up" empty state). `ProvenanceBadge` is a reusable first-class component. Build +
  lint clean; browser-verified (check-off, plan toggle, themes, mobile).
