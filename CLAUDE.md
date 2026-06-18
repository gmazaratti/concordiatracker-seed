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
  the assessment write surface + `setPlan` (in-memory). Helpers: `lib/date.ts`
  (relative due labels), `lib/gpa.ts` (Concordia 4.30 scale, weighted course % +
  credit-weighted GPA).
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
- **2026-06-14** — Today layout revised to a **two-column** shell (max-w-5xl): the
  `DueList` is the wide main column, a ~272px right rail holds the full "At a glance"
  panel + optional `PainNudge`. Collapses to one column on narrow with the rail on
  top (`order` swap). Rail is a proper glance panel: term-progress (Week X of Y) +
  today's-progress bars (`lib/date.ts → termProgress`) over GPA / Overdue / Due this
  week / Next up / This term. "Minimal but FULL," no new features.
- **2026-06-14** — **Shared status + grade model** (defined once, used by Today now +
  Courses editor in step 3). `AssessmentStatus` = not-started / done / late / missed /
  extension / awaiting-grade (`not-started` + `extension` are "open" → on Today's due
  list, via `lib/status.ts → isOpen`). `Grade` accepts a percentage OR a raw score
  (earned/total) → resolved by `lib/grade.ts → gradeToPercent` (the GPA single source
  of truth); plus a per-assessment `notes` field. Provider exposes `setStatus` /
  `setGrade` / `setNotes` (replaced `toggleDone`). `STATUS_META` (label+colors) lives
  in `lib/status.ts` so non-component modules can read it; `StatusBadge` renders it.
- **2026-06-14** — Today surfaces only the **lightweight** slice of that model: a
  round check (fast path → done) with a clearer affordance (hover check + accent ring,
  "Mark done" title) and an inline "more" control revealing quick statuses
  (done/late/missed, `QUICK_STATUSES`). Resolving plays a restrained ~320ms completion
  micro-animation (`ct-animate-complete` accent wash + lift, `ct-animate-check` burst)
  then moves the row into "Completed today" (StatusBadge + Undo). Reduced-motion safe:
  the global block only zeroes `animation-duration`, so `animationend` still fires and
  the row never sticks. The **full** grade/score/notes/extension editor is step 3
  (Courses). Build + lint clean; browser-verified (done + late/missed paths, undo,
  glance updates, mobile, GPA stays 3.68).
- **2026-06-14** — Step 3 (Courses + course detail) shipped. **Calculator math**
  (`lib/gpa.ts`, real arithmetic): `courseStanding` decomposes a course into
  graded/remaining weight + `earnedPoints` (Σ percentᵢ·weightᵢ/100); `gradeNeeded`
  (FREE) solves `earnedPoints + x/100·R = target/100·W` for the average `x` needed,
  with secured / unreachable / no-remaining branches; `projectedCoursePercent` +
  `projectedGpa` drive the PAID what-if; `GRADE_TARGETS` (scale minus F) feeds the
  free picker. **Courses list** = the two-column Today language (max-w-5xl): scannable
  `CourseCard`s (standing, graded-weight bar, next-due + provenance) in the main
  column; a `TermGlance` rail (credit-weighted GPA, courses graded, open/overdue) +
  `PaywallCallout` (free only). **Course detail** = `CourseHeader` hero + two columns:
  main is `AssessmentTable` with **Grades | Notes** tabs (the full editor — status over
  all six, grade in percent OR raw via `GradeInput`→`percentGrade`/`rawGrade`, notes via
  `setNotes`); rail is `CourseStandingPanel` + `GradeNeeded` (FREE) + `GpaWhatIf` (PAID)
  wrapped in `PaywallLock` (blurred behind a Semester CTA when `plan==='free'`).
- **2026-06-14** — **Parse-reveal hero** (`SyllabusParseReveal`): an empty course
  (HIST 203, seeded with no assessments) leads with the import hero. "Upload & parse"
  runs a scripted scan (a `ct-scan-sweep` line over a faux document) → the extracted
  dates cascade in (`ct-reveal-item`, staggered) → `onComplete` commits them via
  `addAssessments` and the course flips to its populated view. **Reduced-motion safe by
  construction**: the stagger + `onComplete` run on JS `setTimeout` (gated on the
  `usePrefersReducedMotion` hook → shorter delays), NOT on CSS `animationend`, so the
  reveal always completes regardless of motion settings. `hist203Syllabus` lives outside
  `seedAssessments` so the empty→populated story is real (resets on reload).
- **2026-06-14** — Shared `KIND_LABEL` extracted to `lib/assessment.ts` (was duplicated
  in `DueRow`) so Today + Courses read one vocabulary. Command-palette action stubs now
  route to the real screens: "Change grade…" → `/app/courses/comp248`, "Import blueprint"
  → `/app/courses/hist203` (the parse-reveal). Build + lint clean; browser-verified:
  list, editor (both grade modes, resolved letters, status, provenance, mobile wrap),
  grade-needed, what-if locked (free) → unlocked + live projection (semester), the
  parse-reveal empty→populated, maroon theme, and Today still intact.
- **2026-06-14** — **Courses redesign → a Google-Classroom feel** (user feedback: the
  first cut "felt bland"). Four changes: (1) **Color-coded classes** — `Course.color`
  is an id into the new `lib/course-color.ts` palette (8 fixed hex swatches, NOT theme
  tokens, so a class keeps its identity color across both themes like Classroom). The
  course-detail `CourseHeader` is now a gradient **banner** carrying code/title in white
  with a `CourseColorPicker` popover (recolors in-memory via `setCourseColor`; every
  surface — grid card, list stripe, banner — recolors at once). (2) **List | Grid layout
  toggle** on the Courses page: Grid = `CourseGridCard` (the Classroom card, colored
  banner + standing), List = the dense `CourseCard` (now with a left color stripe).
  Preference lives in the provider (`coursesView`, default `'grid'`) so it's **sticky
  across SPA nav**, resets on reload. (3) **Smart grade field** replaces the `%`/`#`
  toggle (`GradeInput` deleted): one text input where `15/20` resolves to `75%` live as
  you type (`lib/grade.ts → parseGradeInput`/`gradeToInput` — a slash means raw, else
  percent). (4) **Confirm-to-save** — `AssessmentRow` now **stages** status + grade
  locally and writes to the store only on a ✓ Save button (✗ discards; Enter/Esc as
  shortcuts; the row tints while dirty). Status picker trimmed to `EDITOR_STATUSES`
  (not-started / in-progress / done / late / missed — "overdue" stays date-derived). A
  **fixed-width kind column** aligns every title regardless of kind-label width (the
  alignment bug). Note: the detail banner drops `overflow-hidden` so the color popover
  isn't clipped (rounded corners still clip the gradient via `border-radius`). `Course`
  gained `color`; `AssessmentStatus` gained `in-progress` (an "open" status → Today-
  visible, though the seed has none). Build + lint clean; browser-verified: grid/list +
  sticky toggle, recolor propagation + persistence, smart field live-resolve, stage →
  Save recomputes standing (92%→85% A) + GPA (3.68→3.61), mobile wrap, maroon theme.
- **2026-06-14** — **Course-detail panel rework** (user ask: a real left meta panel,
  not a cramped rail). Course detail is now `aside` (LEFT, `lg:w-[300px] lg:shrink-0`,
  aside-first DOM so it stacks on top on mobile) + `min-w-0 flex-1` main with the
  `AssessmentTable`. The aside holds: `CourseInfoPanel` (accent-themed, collapsible on
  mobile via a chevron header — inline-editable instructor/TA/section/meets/location/
  credits/syllabus through the new click-to-edit `EditableField` primitive, "+ Add a
  TA" affordance when none), `GradeBreakdown` (groups assessments by kind → weight /
  graded-weight / average, course-hex bars), then `GradeNeeded` (FREE) + `PaywallLock`(
  `GpaWhatIf`, PAID). Provider gained `updateCourse(id, patch)` for the inline edits;
  mock courses seeded with full logistics (instructor/ta/email/section/meetingTimes/
  location/syllabusUrl). `EDITOR_STATUSES` gained `extension`. Deleted `CourseStanding`
  (replaced by `GradeBreakdown`).
- **2026-06-14** — **Sidebar lock fix** (user: "the sidebar shouldn't ever have to be
  scrolled on"). `StudentLayout` outer wrap `min-h-svh` → `h-svh overflow-hidden`, so
  the rail is bounded to the viewport and `main`'s `overflow-y-auto` is the only scroll
  region — the avatar/plan footer stays pinned. Verified: at 1280×600 the document is
  not scrollable, aside height = 600, main scrolls (746>600), profile pinned at bottom.
- **2026-06-14** — **Command palette → autofill + quick-action popups + undo** (the big
  user ask). The palette is now a real typeahead nav spine: (1) **Generic verbs** that
  autofill the query instead of navigating — "Change grade for…" fills `"Change grade
  for "`, "Open a class…" fills `"Open "` (`fill(text) = ctx.setQuery(text)`, keeps the
  palette open + re-homes selection). (2) **Dynamic commands** (`dynamicCommands(courses,
  assessments)`): one per course (`Open ${code} — ${title}`, badge=code, accentColor=
  course color) + one per assessment (`Change grade for ${title}`, course code/title in
  keywords). A token-AND matcher means typing "Change grade for Assignment 1" surfaces
  every Assignment-1-ish item across courses, each tagged with its **`CourseChip`** (the
  new shared fixed-hex chip) to disambiguate — exactly the requested "see both until you
  pick one" behavior. Dynamic commands are hidden when the query is empty. (3) **Enter/
  click → a focused popup**, not a full navigation: a new app-level `QuickActionsProvider`
  +`QuickActionLayer` (mounted in `StudentLayout` so popups outlive the palette) renders
  `AssessmentDetailModal` (status + smart-grade editor, live letter preview, Save → commit)
  or `CourseDetailModal` (class glance: gradient banner, standing, logistics, Open-course
  CTA), built on a shared `ModalShell` (backdrop blur, Esc, Tab focus trap, scroll lock,
  focus restore). (4) **Gmail-style undo**: saving an assessment edit `flashUndo(label,
  revert)` → a transient `UndoToast` (6s auto-dismiss, keyed remount per flash) whose Undo
  restores the prior status+grade. Build + lint clean; browser-verified in BOTH themes:
  sidebar lock, "Change grade for" multi-match with chips, edit→Save→undo restores 70→95,
  "Open a class…"→course popup→Open course navigates, course chip stays its fixed identity
  hex under maroon (accent token follows the theme to gold).
- **2026-06-14** — **Today readability + per-row declutter** (user: rows showed too much
  at equal weight; "the class tag names aren't color coded, and the colors on the text add
  to the cluttered feel"; raise contrast / WCAG AA; make the due list primary and the rail
  secondary — *without* changing the layout or removing information). Four moves: (1)
  **Readability tokens lifted** (`index.css`, both themes) — base off pure-black to a dark
  grey to cut eye strain (dark `--ct-canvas #0f0f16` / `--ct-surface #191926`; maroon
  `#1a0d12` / `#261620`), and `--ct-subtle` raised to **WCAG-AA body contrast** (dark
  `#8b8898` ≈ 5.0:1 on surface; maroon `#b08d97` ≈ 5.8:1). These are shared tokens → every
  page benefits. (2) **Two-tier `DueRow`**: the **title** + **due label** are primary
  (`text-fg`, due colored only when urgent — danger overdue / warning today, else `text-fg`);
  the course chip, kind·weight, and provenance recede to one quiet `text-subtle` secondary
  line. The single intended color signal is the **color-coded `CourseChip`** (fixed identity
  hex, same across themes); provenance switches to a new `ProvenanceBadge tone="quiet"` (keeps
  the colored dot, neutralizes the label to subtle) so colored *text* no longer competes.
  (3) **`…` menu does more** (`DueRowMenu`, rendered **inline** in normal flow — not an
  absolute popover — so the list Card's `overflow-hidden` never crops it): all status changes
  (in-progress / extension / done / late / missed) + **Edit details** (→ `openAssessment`
  modal, which carries grade/notes/extension) + **Open in course**. The quick round check
  stays on the row as the fast path to done. **No `delete`** — the data model has none and it
  would be destructive on seed data (flagged to user). (4) **Rail recedes**: `GlanceStrip`
  drops the solid `Card` for a semi-transparent `bg-surface/50` + `border-border/60` panel so
  the solid due list reads as primary. `CompletedRow` now uses the same `CourseChip`. Row
  separation stays light (subtle `divide-y`, no per-item cards); an Overdue→This-week group
  divider was added. `TodayPage` gained `changeStatus` (open-status annotation that stays on
  the list, vs `resolve` which lifts to Completed). Build + lint clean; browser-verified in
  BOTH themes + mobile: AA contrast, color chips (rose/gold/teal/blue/purple per class) fixed
  under maroon, quiet provenance dots, the enriched inline menu, check-off reward → "Completed
  today · 1" with chip + Undo, live "1 done · 7 to go" progress, recessed rail.
- **2026-06-15** — Step 8 (**Landing**) shipped — bold/clean, **Linear/Electron feel** (user
  ask: "not vibecoded… bold but aesthetic", a dashboard that **peeks above the fold and reveals
  on scroll**). The peek is **real DOM, not an image** — `features/landing/AppPreview.tsx` is a
  static, non-interactive recreation of the Today screen built from the **actual mock data +
  shared components** (`CourseChip`, `ProvenanceBadge`), so the hero shows the genuine product
  (crisp, theme-aware) rather than a screenshot. It's wrapped in a browser-chrome frame
  (`concordiatracker.app/today`) clipped to `h-[440px] sm:h-[520px] overflow-hidden` with a
  bottom `to-canvas` gradient fade → reads as "more below the fold." **The reveal is pure
  layout** (tall frame + viewport clip + fade), no scroll JS. `LandingPage.tsx` composes: hero
  (eyebrow pill, `font-display` clamp H1 "Stop guessing what's *due*.", two CTAs → `/app` +
  `#how`) over the peek, a feature trio, `ParseShowcase` (the CLAUDE hero beat: a faux syllabus
  with a `ct-scan-sweep` line → an extracted/dated/provenanced plan from `hist203Syllabus`, plus
  a 3-card provenance legend), `PricingSection` (Free $0 vs featured **Semester pass $15** "Best
  value" / "or $5 / month" — per spec), and a final CTA band. **New `index.css` utilities**:
  `.ct-grid-bg` (faint 56px blueprint grid on the border token, radial `mask-image` fade) +
  `@keyframes ct-rise`/`.ct-rise` (600ms hero lift, `both`-fill so the global reduced-motion
  duration-zero holds the visible end state — same safe pattern as the parse-reveal).
  `PublicLayout` header gained `#how`/`#pricing` anchor links (sm+; the public layout only wraps
  Landing so anchors always resolve); the "Not affiliated with Concordia University" line was
  already in its footer. Marketing context is **outside `AppDataProvider`** → Landing imports
  `courses`/`term`/`seedAssessments`/`hist203Syllabus` statically from `mock.ts` (no store).
  Build + lint clean; browser-verified: desktop hero + peek, feature trio, parse beat, provenance
  legend, pricing, final CTA, footer; maroon theme (canvas warms, accent→gold, course chips keep
  fixed identity hex); mobile (hero stacks, CTAs full-width, header anchors collapse, preview
  sidebar/rail hide); reduced-motion end-state holds (`.ct-rise` opacity 1 / identity transform).
- **2026-06-15** — **Landing composition refine** (user: "close but reads slightly templated/
  AI-generated"; Linear-influenced — asymmetry, per-section rhythm, confident negative space;
  **keep** serif headline / gold accent / dark base / browser-framed preview / the ParseShowcase
  beat). Four moves, all in `LandingPage.tsx` (ParseShowcase + PricingSection untouched): (1) the
  generic **status pill is gone** → a plain tracked-uppercase eyebrow ("For Concordia students").
  (2) **Hero is now asymmetric**: copy left (`lg:w-[46%]`, left-aligned H1 + subtext + CTAs), the
  real-DOM `AppPreview` in its browser frame offset right at `lg:w-[60vw]` so it **overruns the
  right viewport edge** (frame `lg:rounded-r-none`; the glance rail clips off — the Linear "board
  bleeds" depth cue). The bleed is contained by the hero `overflow-hidden` (verified: no page
  horizontal scroll); the bottom `to-canvas` fade now shows on **mobile only** (`lg:hidden`),
  where the hero stacks. (3) **Feature trio de-carded** → an editorial row: an asymmetric header
  (serif H2 left + eyebrow/paragraph right, Linear screenshot 2), then three **numbered**
  (01/02/03) columns separated by vertical `border-l` dividers + a hairline rule, no rounded
  boxes. (4) **Final CTA de-banded** → asymmetric `lg:grid-cols-[1.2fr_0.8fr]`, baseline-aligned
  (`items-end`): big serif headline left, supporting line + CTA right, generous `py-28 sm:py-36`
  negative space — no card. Net section rhythm: asymmetric → left → left → **centered pricing**
  (deliberate break) → asymmetric. Also fixed a **pre-existing** mobile header overflow (logo +
  two buttons > 375px): "For teachers" is now `hidden sm:block`, leaving logo + "Open app" on
  mobile. Build + lint clean; browser-verified both themes + mobile (no horizontal scroll either
  axis), bleed clips at the viewport, course chips keep fixed hex under maroon.
- **2026-06-15** — **Avatar menu: "Back to landing page"** (user ask). Relabeled the existing
  `AvatarMenu` "/" link from "Marketing site" (`ExternalLink` icon) to "Back to landing page"
  (`ArrowLeft`) — did NOT add a second "/" entry (avoids a duplicate). Menu order unchanged:
  Settings · Teacher portal · Back to landing page · Sign out.
- **2026-06-15** — **Landing hero load animation** (user ask: the embed should "slide in from the
  right, no longer than 0.5s, one-shot — and once it lands, type out 'Good morning, Alex' once
  (not loop); also fade the embed's right edge like the bottom fade in its old position"). Three
  coordinated pieces: (1) **Slide-in** — replaced the old `ct-rise` hero-lift with
  `@keyframes ct-slide-in-right` (`translateX(48px)→0`, **480ms** ≤0.5s, `both`-fill); class moved
  onto the preview frame in `LandingPage.tsx`. `ct-rise` is now fully removed from code (older log
  entries mentioning it are history). (2) **Typewriter** — `AppPreview.tsx` static greeting `<h3>`
  → a `TypedGreeting` component: **JS-sequenced** (`setTimeout`, NOT a CSS width hack — Fraunces is
  proportional so ch-based reveals mis-render), **540ms** start delay (waits for the slide to land)
  then **48ms/char**; a `.ct-caret` (new in `index.css`, blinks on `--ct-accent` → theme-aware
  gold) renders only while typing (`!reduced && !done`) so it never loops past completion.
  **Reduced-motion safe by construction**: initial `count` is full when reduced, the effect only
  schedules `setTimeout`s (no synchronous `setState` in the effect body — lint `set-state-in-effect`;
  the reduced branch settles via a 0ms timeout), and the slide-in's `both`-fill + the global
  duration-zero block hold the landed/full state instantly. (3) **Right-edge fade** — a desktop-only
  (`lg:block`) `to-canvas` gradient (`inset-y-0 right-0 w-40`) over the bleeding embed, mirroring the
  mobile-only bottom fade. Build + lint clean; browser-verified: slide-in `0.48s`, typewriter
  caught mid-type (`''`→`Go`→`Good`→…→`Good morning, Alex`, caret removed at completion, no loop),
  right fade desktop / bottom fade mobile, no mobile horizontal overflow, caret accent follows
  maroon (gold `#e8b84b`).
- **2026-06-15** — ~~TEMPORARY DEV CODE~~ **RESOLVED.** `features/landing/DevControls.tsx` was a
  throwaway floating panel for comparing accent colors + headline fonts live on the real page. The
  user picked **Hanken Grotesk** + **Sage/eucalyptus** (see next entry); the panel, its mount/import
  in `LandingPage.tsx`, and the file were **deleted**. No dev code remains on the landing.
- **2026-06-15** — **Landing hero preview width capped** (user: the embed "extends WAY too long
  on a bigger screen"). The preview frame was `lg:w-[60vw]` uncapped → on ultra-wide monitors 60vw
  ballooned and the dashboard content stretched. Fix in `LandingPage.tsx`: added `lg:max-w-[820px]`
  to the preview wrapper, and **removed `lg:rounded-r-none`** from the frame (now full `rounded-2xl`).
  The rounded right corner trick: while the embed bleeds off the right viewport edge (≲~1630px wide)
  the rounded corner sits off-screen and reads as a flat continuation; once the 820px cap turns it
  into a contained card on very wide screens the corner becomes visible, so it looks like an intended
  card — no breakpoint hacks. Verified: 1425px bleeds ~101px off-right (corner hidden); 1985px is a
  contained 820px rounded card (right edge 1806, ~179px gap, right-edge canvas fade as vignette); no
  page horizontal overflow at either.
- **2026-06-15** — **Landing "Drop your syllabus" beat → scroll-triggered live parse animation**
  (user ask: on scroll into the ParseShowcase section, play the real parse-reveal — a PDF drops into
  the scanner, then the assessments cascade in on the right, same choreography as the in-app
  `SyllabusParseReveal`; use the uploaded **COMM 221 GG — Financial Markets** syllabus as the filler
  data). New `features/landing/ParseRevealDemo.tsx` replaces ParseShowcase's old static two-column
  block (heading + provenance legend kept). **Choreography** (a 5-phase machine on `setTimeout`,
  gated on `usePrefersReducedMotion`): `armed` → `dropping` (the PDF "file" drops into the scanner
  bed via new `@keyframes ct-drop-in` in `index.css`, 560ms settle) → `scanning` (the shared
  `ct-scan-sweep` line over the raw page, ~1s) → `revealing` (the 6 assessments cascade one at a time,
  `ct-reveal-item`, 230ms stagger) → `done`. **Left** = the raw PDF: chip `Comm 221_GG_Winter
  2026.pdf` + a mono page showing John Molson / Dept of Finance / COMM 221 GG · Financial Markets ·
  Winter 2026 / the Grade Composition table (Quiz 1–5 @ 8% on Feb 8 / Feb 22 / Mar 15 / Mar 29 /
  Apr 5, Final Common Exam @ 60% TBA) + the "40% required on the common final" note. **Right** = the
  structured plan: Quiz 1 Time value & NPV … Quiz 5 Finance history & regulation (Quiz · 8% ·
  Official, topic titles inferred from the weekly schedule) + Final Common Exam (Final · 60% ·
  Confirmed · 9). Weights total 100. **Trigger**: IntersectionObserver (threshold 0.35) **plus** a
  scroll/resize bounding-box fallback + a deferred initial in-view check (the fallback is genuinely
  more robust *and* the only path observable in the preview harness, which services neither IO
  callbacks nor programmatic-scroll `scroll` events — both work in real browsers). Data is **local to
  the landing** (not in `mock.ts`) because it uses the syllabus's own calendar dates (Feb/Mar/Apr),
  which would violate mock.ts's runtime-relative-dates invariant. ParseShowcase no longer imports
  `hist203Syllabus`/`relativeDueLabel`/`KIND_LABEL`/`FileText` (still used elsewhere). Build + lint
  clean; browser-verified via DOM timeline (armed→dropped→scanned→6 staggered reveals→done) + a
  done-state screenshot (raw PDF left, 6 dated/weighted/provenanced assessments right). Reduced-motion
  safe (timers collapse to ~0; `ct-drop-in` `both`-fill holds the landed state).
- **2026-06-15** — **Display font + accent finalized (replaces the dev-panel comparison).** After
  comparing live, the user chose **Hanken Grotesk** as the display/headline face (was Fraunces serif)
  and **Sage / eucalyptus** green as the accent (was amber/gold). Applied to the **whole product**
  (landing + app), all from the token system: `index.html` now loads `Hanken Grotesk:400;500;600;700;800`
  + Inter (Fraunces dropped); `index.css` `--font-display` → `'Hanken Grotesk', 'Inter', system-ui,
  sans-serif`, and the **default dark theme** accent set → `--ct-accent #8fb39a` / hover `#a6c6af` /
  contrast `#0e1c14` / soft `rgba(143,179,154,0.14)` / ring `rgba(143,179,154,0.5)` / brand `#8fb39a`.
  The **maroon theme is deliberately left on its gold accent** (`#e8b84b`) + maroon brand (`#912338`)
  — it stays the Concordia-branded alternate; flagged to the user (they can ask to make it sage too).
  Body stays Inter; course-chip identity hexes unchanged. Also fixed the hero embed's browser-chrome
  URL `concordiatracker.app/today` → **`.com`**. Logo.tsx comment de-Frauncesed. Build + lint clean;
  browser-verified both landing + app: accent `#8fb39a`, primary CTA + active-nav + glance bars render
  sage, headlines computed `"Hanken Grotesk"` (weights 500/600 loaded), URL reads `.com`, dev panel
  gone, maroon still gold.
- **2026-06-15** — Step 7 (**Settings + legal**) shipped. **Settings is a floating panel, not a
  route** (Claude-desktop layout: left section nav + scrollable content). Context-driven via
  `SettingsProvider` (`open`/`section`/`openSettings(section?)`) + `SettingsLayer` (mounted in
  `StudentLayout` alongside QuickActionLayer). **Entry points all open the same modal**: a new **gear
  button right of the sidebar profile block** (the requested affordance), the avatar-menu "Settings"
  (now a button, not a link), the ⌘K "Settings" command (`ctx.openSettings`), and the Paywall CTAs
  (→ `openSettings('billing')`). The old `/app/settings` route + `SettingsPage` placeholder were
  **retired**. A11y lives in a shared `app/hooks/useModalDismiss.ts` (focus trap / Esc / scroll-lock /
  focus-restore, extracted from ModalShell's pattern) — it **filters to visible focusables**
  (`offsetParent !== null`) so the mobile-only close button doesn't swallow focus on desktop, and
  focuses via `setTimeout(0)` not rAF. Sections (`features/settings/sections/*`, built on
  `controls.tsx` = Group/Row/Switch/Segmented/Flag): **General** (theme · prefs · notifications ·
  EN/FR stub), **Account** (Google-synced identity — "Connected with Google", display-name input,
  inline Delete-account confirm referenced by the privacy policy; all mock), **Privacy** (links to the
  3 legal docs + Law 25 data-rights/contact), **Billing** (plan card + **explicit auto-renewal
  callout**; Upgrade/Cancel flip the in-memory `plan` so both states demo; Stripe portal + invoices),
  **Usage** (data-driven meter list — `buildMeters(plan, courseCount)` so new limited features are a
  one-row add; free shows scans 1/3, GPA "Semester only" locked; semester = Unlimited). Mobile: the
  panel is a full-screen sheet and the nav collapses to a horizontal scroll row. **Legal docs are real
  routes** `/legal/:doc` (terms · privacy · educator), rendered from structured data
  (`legal/legal-content.ts`) by a thin `LegalPage` reading-column matching the user's reference
  (numbered sections, callouts, the green "we'll never sell your data" highlight) in the LOCKED theme;
  invalid `:doc` → redirect to `/`. All three carry a **DRAFT — pending review** banner + "Last updated
  June 15, 2026", and a `withFlags()` renderer highlights every bracketed placeholder. **User-decision
  placeholders (NOT silently chosen):** `[AGE_MINIMUM — TBD]` (privacy §9 + ToS §3, was 13),
  `[REFUND POLICY — NEEDS REVIEW]` (ToS §5 — the "non-refundable" wording was **removed**, verified
  absent), a new **Auto-Renewal** clause (ToS §5) with `[NOTICE PERIOD — TBD]`, and `[VERIFY]` on
  Supabase/Vercel/Stripe (privacy §4/§7/§8 + Billing). Educator Agreement has **no provided content →
  five `[PLACEHOLDER]` section stubs** (no invented clauses). Also: `THEMES` dark swatch accent →
  sage; public footer gained Privacy/Terms/Educators links. Build + lint clean; browser-verified
  (explicit viewports — the harness reports 0-width on the native preset): no console errors, focus
  enters on open + Tab/Shift-Tab wrap + Esc closes, mobile sheet collapses with no horizontal overflow,
  all three docs render with their flags, billing free↔semester round-trips. **Open for the user:** set
  the age minimum (recommend 16+, or 14+ with parental consent given minors' grades under Quebec law),
  the refund policy, the renewal notice period, and confirm the Supabase/Vercel/Stripe stack.
- **2026-06-15** — Settings polish (user feedback): (1) **Themed scrollbars** — `index.css` base layer
  now styles `::-webkit-scrollbar` (10px, `--ct-border-strong` thumb on a transparent track, inset via
  a transparent border + `background-clip: padding-box`, `--ct-subtle` on hover) + Firefox
  `scrollbar-width: thin` / `scrollbar-color`; token-based so it swaps per theme. (2) **Account gained
  School/Faculty** (a `<select>`: Gina Cody · JMSB · Arts & Science · Fine Arts) **+ Major/Program**
  (text input), both in-memory like the display name. (3) **Switch knob fix** — the toggle was
  `absolute` with no `left`, so the knob escaped the pill; rebuilt as `inline-flex items-center` +
  `px-0.5` with the knob translating `0 → translate-x-4` (settles 2px inside each edge). (4) **Clean
  legal URLs** — added top-level routes `/terms`, `/privacy`, `/privacypolicy` (alias), `/educator`
  alongside `/legal/:doc`; `LegalPage` takes an explicit `doc` prop or the route param. Privacy-section
  + public-footer links now use the clean URLs. Build + lint clean; server restarted; browser-verified
  (knob stays inside the pill both states, scrollbar tokens applied, school/major present, all four
  clean routes resolve, no console errors).
- **2026-06-15** — **Custom dropdown — `components/ui/Select.tsx` (CONVENTION: no native `<select>`
  anywhere; custom scrollbars + custom dropdowns only).** Token-styled, keyboard-accessible combobox:
  the option list is **portaled to `<body>` with `position: fixed`** (repositions on scroll/resize) so
  it never clips against `overflow-hidden`/scroll ancestors — the reason a plain absolute menu wouldn't
  work in the course table / rail / modals. Focus stays on the trigger (aria-activedescendant pattern),
  so it composes with modal focus traps; handled keys (`Esc`, `Enter`, `Space`) `stopPropagation` so
  the dropdown closes without also closing the surrounding modal. Full keyboard model (↑/↓/Home/End/
  Enter/Esc/Tab), `role=combobox`+`listbox`/`option`, hover+selected states, optional per-option `dot`
  (a `bg-*` class — used for the status colors), `size` (sm/md) + `tone` (field=canvas / control=
  surface-2) variants; the list inherits the global themed scrollbar. **All four native selects were
  replaced**: Account School/Faculty, the Courses `AssessmentRow` status picker, the palette
  `AssessmentDetailModal` status picker (both with colored dots), and `GradeNeeded`'s target picker
  (numeric value ↔ string). Build + lint clean; browser-verified: list portals out of the dialog +
  out of `overflow-hidden` course containers (not clipped), ↓ opens / activedescendant moves / Enter
  selects / Esc closes the dropdown but keeps the modal open, status options render their 6 dots, no
  console errors. Preview reset to native size.
- **2026-06-15** — **"How is this calculated?" grade disclosure** (user ask: let students see + verify
  the math behind their grade; the shown formula must never drift from the computed number). New
  **single source of truth** in `lib/gpa.ts`: `gradeTerms(assessments)` → graded categories as
  `{kind, weight, percent}`, and `weightedAverage(terms)` → `Σ(wᵢ·pᵢ)/Σwᵢ`. `coursePercent()` (which
  drives the `CourseHeader` banner grade **and** GPA) was **refactored to delegate** to
  `weightedAverage(gradeTerms(...))` — mathematically identical (per-category vs per-assessment grouping
  yields the same weighted average), so GPA is unchanged. The disclosure (new `HowCalculated` in
  `GradeBreakdown.tsx`, **collapsed by default**) renders from the *same* `gradeTerms`/`weightedAverage`,
  so the formula can't diverge from the grade. It shows the **general form** (`grade = (weight × score
  + …) ÷ (sum of weights)`) **and** the plugged-in numbers from the student's real categories/weights
  (e.g. COMP 248 → `(Assignment 10 × 90) + (Lab 5 × 95) ÷ 15 = 91.7% (rounds to 92%)`), with a
  plain-language legend (weight = category share, score = your category average). Deliberate deviation
  from the user's fractional-weight example: the *current* grade divides by the weight graded **so far**
  (denominator → 100 once fully graded), shown honestly. Build + lint clean; browser-verified: collapsed
  by default, expands to the worked math, result rounds to the banner's 92%, no console errors, layout
  intact.
- **2026-06-15** — **Landing parse beat → fake cursor drag-and-drop intro** (user ask: when the "Drop
  your syllabus" section is in frame, show a mouse click the syllabus, pick up the PDF, and drag-drop it
  into the scanner, which then scans). Reworked `ParseRevealDemo.tsx` from "PDF drops from above" to an
  8-phase machine: `armed → reach` (a fake SVG cursor slides in to the loose file) `→ grab` (a
  `.ct-click-ping` ripple — new keyframe, replaced the now-unused `ct-drop-in`) `→ drag` (cursor + the
  `Comm 221_GG_Winter 2026.pdf` FileCard travel down into the dashed scanner bed) `→ drop` (bed
  highlights, file fades in) `→ scanning` (the raw page + `ct-scan-sweep`) `→ revealing` (6 assessments
  cascade) `→ done`. The scanner panel is fixed `h-[340px]` so the cursor/file positions are
  deterministic; both are `pointer-events-none` decoration driven by CSS transitions on phase-keyed
  `top`/`transform`/`opacity` (no animation lib). Trigger (IntersectionObserver + scroll/resize
  fallback) and the COMM 221 data are unchanged. **Reduced-motion safe**: dwell times collapse to ~0 and
  the cursor/file overlay isn't rendered (`!reduced`), so it jumps straight to scan → cascade. Phase
  machine deps are primitives `[phase, revealed, reduced]` (an earlier `MS`-object-in-deps caused a
  React "deps array changed size" warning during HMR — fixed). Build + lint clean; browser-verified via
  DOM timeline (reach → click-ping → drag → drop → scan-sweep → 6 staggered reveals → done) + a mid-drag
  screenshot (cursor dragging the PDF card into the bed); no console errors on a fresh server.
- **2026-06-16** — **Parse beat reworked → cursor drags the PDF out of the heading word** (user: "the
  cursor appears smoothly and drags the PDF out of the word syllabus"; preview name should be
  `syllabus.pdf`). Split the demo: shared data/types moved to `parse-demo-data.ts` (also fixes a
  `react-refresh/only-export-components` lint from exporting a const beside a component);
  `ParseRevealDemo.tsx` is now a **presentational** two-column view (scanner + plan cascade) driven by
  `phase`/`revealed` props with a `scannerRef`; `ParseShowcase.tsx` owns the phase machine, the scroll
  trigger, and the **cursor + dragged-PDF overlay**. Choreography: `reach` (a fake SVG cursor glides to
  the dashed-underlined word "syllabus" in the H2) → `grab` (`.ct-click-ping` ripple; a `syllabus.pdf`
  card lifts out of the word) → `drag` (cursor + card travel to the scanner bed) → `drop` → `scanning`
  → `revealing` → `done`. The overlay is **declarative**, not imperative: the word + scanner anchor
  points are measured into `coords` state (deferred in an effect; re-measured on resize) and the
  cursor/PDF `style` (left/top/transform/opacity + a per-phase `transition`) is computed from `phase` +
  `coords`, so React owns the style — an earlier imperative version fought React's `style` prop and the
  cursor never showed. Raw page + file card now read `syllabus.pdf` (was the long filename). Reduced-
  motion safe (overlay gated on `!reduced`, dwell ~0). Build + lint clean; verified via the **inline-
  style** timeline (cursor op 0→1 at the word → ping + PDF lifts out → both travel to the bed `top`
  76→448 → scan → 6 reveals). NOTE for future verification: this preview harness returns **stale
  `getComputedStyle` opacity for in-flight CSS transitions** and its screenshot pipeline can hang —
  read overlay state from **inline** `style` values, not computed.
- **2026-06-16** — **Today refined for calm + provenance removed from the default view** (user: reduce
  visual weight; provenance belongs on Courses + the assessment detail editor, not repeated daily on
  Today). Rows are now: title + **course as a small identity DOT + plain code** (not a full-color
  `CourseChip` pill — saturated color is reserved for urgency, e.g. overdue due text) + due. Kind shows
  always; **weight % is toggleable**. **No provenance badge by default**; the lone exception is a quiet
  `CircleDashed` "unverified" marker (title tooltip + sr-only text) so a shaky date still whispers
  caution — official/confirmed show nothing. The full `ProvenanceBadge` stays on Courses cards and the
  `AssessmentDetailModal` (unchanged). The `…` menu is trimmed to three quick actions — **Enter grade**
  (opens the detail editor), **Open in course**, **Delete** — and the round check is the fast path to
  done; the old status pills are gone (status is set via the editor). **Delete** is new: provider gained
  `removeAssessment(id)`; `TodayPage.deleteItem` removes it and `flashUndo`s a restore via
  `addAssessments([item])` (the existing Gmail-style toast). **"Customize Today"** = a small inline panel
  (toggled from the Due header, rendered in-flow so the Card clip never crops it) with exactly four
  controls: show weight %, show provenance (power-user opt-in), density (comfortable/compact → row
  padding), group by (time → overdue/this-week, or course → one section per class, soonest-due first).
  Backed by sticky `todayPrefs` in `AppDataProvider` (`DEFAULT_TODAY_PREFS`, resets on reload, like
  `coursesView`); reuses the settings `Switch`/`Segmented`. `DueList` builds its sections from the
  groupBy pref; the two-column layout + GlanceStrip rail are untouched. The landing `AppPreview` (a
  static marketing snapshot of Today) deliberately keeps its old look. Build + lint clean; browser-
  verified: calm default (no full badges, dot+code, 2 unverified markers), all four toggles work
  (weight hide, provenance show, compact padding 10→6px, group-by-course sections), menu = Enter
  grade/Open in course/Delete, delete→Undo restores (6→5→6), mobile no horizontal overflow + icon-only
  Customize button, no console errors.
- **2026-06-16** — **Row "⋮" menu → floating popover (`components/ui/DropdownMenu.tsx`)** (user: make
  it a real Gmail-style dropdown, not an inline panel that reflows the list; vertical dots). Reusable
  overflow menu: a **portaled, `position:fixed` popover** anchored to its trigger (right edge aligned),
  so it floats above content and **never reflows the list** (verified: Due card height unchanged on
  open). Closes on outside-click + Escape; **one open at a time** (opening another trigger's mousedown
  dismisses the first). Full menu-button keyboard model — ↓/↑/Home/End move focus (roving tabindex,
  real DOM focus on items), Enter/Space select, **Esc closes and restores focus to the trigger**, Tab
  is trapped. **Flips upward** when there isn't room below (`computePos` estimates height, checks
  `spaceBelow`) so it's never clipped (verified at a 420px viewport: menu sits above the trigger, in
  view). Items are data-driven (`MenuItem[]` = id/label/icon/onSelect/`danger`/`separated`); **Delete is
  destructive (red) with a divider above**. Trigger exposes `data-state=open|closed` so callers style
  the open state (Tailwind `data-[state=open]:`). The triple-dot is now **vertical** (`MoreVertical`).
  Replaced Today's inline `DueRowMenu` (deleted) in `DueRow` with `<DropdownMenu>` (Enter grade / Open
  in course / Delete) — the only "⋮" in the app. Build + lint clean; browser-verified: portaled (not in
  the card), no reflow, divider + red Delete, focus enters/Arrow/Enter/Esc+restore, outside-click +
  one-at-a-time, flip-up, no console errors.
- **2026-06-16** — **Today row actions: full "Edit" card + "Open in course" scroll-to-glow** (user
  ask). (1) **Edit** — the row "⋮" menu's "Enter grade" became **Edit**, opening the (extended)
  `AssessmentDetailModal` as a small popup card (ModalShell, `sm:max-w-md` — not full-page): edit the
  **due date + time** (`<input type="datetime-local">`, ISO↔local via new `toDateTimeLocal`/
  `fromDateTimeLocal`), **status** (now includes **`awaiting-grade`** = "completed, pending a grade";
  added to `EDITOR_STATUSES`), **grade**, and **notes** (textarea). Save writes ONE patch via the new
  provider `updateAssessment(id, patch)` and flashes a reversible Undo (reverts the whole patch). The
  command palette opens the same modal. (2) **Open in course** — navigates with React-Router
  `state:{ focus: id }`; `CourseDetailPage` reads `location.state.focus` and passes `focusId` to
  `AssessmentTable`, which switches to the Grades tab, `scrollIntoView({block:'center', smooth})` the
  row (`id="assess-${id}"`), and glows it via a new `ct-highlight` keyframe (accent wash + inset ring,
  ~2.2s, then cleared). Build + lint clean; browser-verified: menu = Edit/Open in course/Delete, Edit
  modal has datetime + status (incl. Awaiting grade) + grade + notes, Save persists (row due → "Due
  Fri", Undo toast), Open-in-course lands on `/app/courses/:id` with the row scrolled into view +
  `ct-highlight` applied then cleared; no console errors.
- **2026-06-16** — **Custom date+time picker (`components/ui/DateTimePicker.tsx`) replaces the native
  `datetime-local`** (user: "Use a custom date and time, not the default computer's one"). Token-themed,
  works in ISO (value in / value out). Trigger = a themed button showing `formatDueDateTime` + a
  calendar icon; clicking opens a **portaled, `position:fixed`** popover (flips up near the viewport
  bottom, repositions on scroll/resize, outside-click + Esc dismiss). Popover holds a **6×7 month grid**
  (prev/next month nav, selected = accent fill, today = accent text, adjacent-month days muted) + a
  **12-hour time row** (hour + minute custom `Select`s — minute options are the 5-min steps plus the
  item's actual minute so e.g. `:59` stays selectable — and an AM/PM segmented). Day clicks keep the
  time; time changes keep the day. Keyboard: ←/→/↑/↓ move the focused day (roving tabindex, rolls the
  month at edges), Esc closes; keys `stopPropagation` so the surrounding modal's focus trap doesn't
  hijack them. **z-index**: popover `z-[55]` (above the modal's `z-50`); the nested hour/minute Select
  lists are `z-[60]` so they layer **above** the popover. Wired into the Edit modal (`dueISO` state, no
  more local↔ISO conversion); the dead `toDateTimeLocal`/`fromDateTimeLocal` helpers were removed.
  Build + lint clean; browser-verified: no native input, 42-cell grid + month nav, day pick →
  "Sat, Jun 20", AM/PM toggle updates the value, Save persists (row → "Due Sat"), nested minute dropdown
  layers above the calendar, mobile popover fits (292px in a 375 viewport, no horizontal overflow), no
  console errors.
- **2026-06-16** — Step 4 (**Calendar**) shipped — built FRESH against the current mock model (the
  old calendar-sync code was abandoned). **Two layers, independently toggleable** (per spec, NOT
  separate tabs): **"My calendar"** (assignment deadlines from `assessments` + personal `tasks`) and
  **"Concordia"** (the official academic calendar). The Concordia dataset is **real** —
  `data/academic-calendar.ts` transcribes the registrar PDF the user provided (Summer 2026 · Fall 2026
  · Winter 2027): `AcademicEvent {id,title,start,end?,kind}` with **absolute** `YYYY-MM-DD` dates (a
  curated student-relevant subset — term bounds, exam periods, reading weeks, closures, add/drop +
  withdrawal + grad deadlines; niche grad-admin rows omitted for calm). Multi-day events use `end`
  (inclusive) and render as a chip on **each** day in range (no spanning-bar engine). Swap the array to
  load a different year/program. Approved decision (Concordia layer = **info-blue + per-kind icon**, NOT
  maroon brand — `ACADEMIC_META` maps term→Flag / exam→FileText / break→Coffee / holiday→PartyPopper /
  deadline→AlarmClock). **Personal tasks** are a new in-memory layer: `CalendarTask {id,title,due,done,
  note?}` seeded in `mock.ts` (`seedTasks`, runtime-relative), provider gained `personalTasks` +
  `addTask`/`toggleTask`/`removeTask` (`taskSeq` ref for ids). **Three views** (Month / Week / Agenda)
  as a `Segmented` toggle (NOT tabs), state in sticky `calendarPrefs` (`DEFAULT_CALENDAR_PREFS` = month
  + both layers on; resets on reload, like `coursesView`/`todayPrefs`). **Mobile defaults to Agenda**
  (approved): a module-level `mobileInitDone` flag + one-shot effect switches view→agenda on first
  calendar visit when `matchMedia('(max-width:1023px)')` and the view is still the `month` default — so
  it never fights a deliberate sticky desktop choice. Day-bucketing math lives in `features/calendar/
  calendar.ts` (`ymd` LOCAL key, `parseDay` no-UTC-shift, `monthGrid` 42-cell, `weekDays`, `dayItems`
  honoring the layer prefs, `agendaDays`). **Layout** = the Today/Courses two-column language
  (`max-w-5xl`: view in `main`, a recessed `CalendarRail` aside `lg:w-[272px]` — `bg-surface/50`
  glance-panel style — with the two layer `Switch`es + a university-dates legend + the gated Sync
  button). Period nav (‹ ›, Today, month/week label) shows for Month/Week; Agenda is forward-only so
  its nav is hidden. **Views**: `MonthView` (6×7 grid, ≤3 `EventPill`s/day + "+N more", today = accent
  circle, day cell = button → day modal); `WeekView` (7 day columns, horizontal-scroll on narrow, a
  pill → assignment opens its detail popover, else the day modal); `AgendaView` (phone-first; day-
  grouped `ItemRow` list over the next 60 days, only days with items, calm empty state). **`EventPill`**
  = the calm one-line marker (course identity dot for assignments, info-blue icon for Concordia, neutral
  dot for tasks; saturated red only for an overdue-and-open assignment). **`ItemRow`** (shared by Agenda
  + the day modal) = the detailed row: assignments carry a done-check + `CourseChip` + **full
  `ProvenanceBadge`** (provenance is shown in full here, consistent with Courses — only Today suppresses
  it) and open the **same** `AssessmentDetailModal` popover used everywhere; tasks toggle done + delete
  inline; Concordia events are read-only. **`DayDetailModal`** (reuses `ModalShell`) lists the day's
  items + an **add-task** form (title input + the custom `DateTimePicker` defaulting to that day at
  noon); opening an assignment from it calls `onClose` FIRST so the editor never stacks on the day
  modal. **Sync button (stub, Pro-gated)**: free → `openSettings('billing')` upgrade nudge; semester →
  click flips to a mock "Sync set up · Two-way sync coming soon" success (no real sync). Build + lint
  clean; browser-verified (desktop + mobile, no console errors): month grid (42 cells, today=16 ringed,
  course-color dots, info-blue academic icons, multi-day finals/reading-week ranges, "+N more", done =
  strikethrough); week (7 cols, pill→`Edit …` popover opens directly); agenda (forward day-groups, nav
  hidden); day modal (items + add-task + DateTimePicker, open-assignment closes the day modal then opens
  the editor — no stacking); layer toggle (Concordia off removes academic, keeps assignments); sync
  free→Billing, semester→"Sync set up"; mobile reload auto-selects Agenda, month grid + bottom-sheet
  modal fit 375px with no horizontal overflow. **Note (defensible scope choice):** the Agenda view is
  forward-looking from today, so overdue items don't appear there — they remain red in Month/Week, and
  Today centralizes overdue. **Reduced-motion:** views are static (no entrance motion); the only
  animations are the reused ModalShell/DateTimePicker, already reduced-motion safe.
- **2026-06-17** — **Contextual upgrade prompts → responsive (slim on mobile).** The three in-context
  Pro nudges (Today `PainNudge`, Courses `PaywallCallout`, Calendar free-state `SyncButton`) ate too
  much vertical space on phones. New shared `components/UpgradeChip.tsx` = the slim single-line form
  (accent-soft bar: feature icon + short label + a "Pro" tag + arrow; supports either a `to` Link or an
  `onClick`, so it stands in for both navigation nudges and the billing-modal ones). Each prompt now
  renders BOTH forms and swaps purely with `sm:` classes — chip `sm:hidden`, the **unchanged** full card
  `hidden … sm:flex` — so desktop is byte-identical and **< 640px** collapses to one ~38px line. Still
  present, contextual, and tappable on mobile (not hidden behind a tap); same Pro-gating + placement.
  Deliberately scoped to the **free/upsell** states only — the **semester** sync button stays a full
  card because it's a real action, not an upgrade prompt. Build + lint clean; browser-verified at 375px
  (all three show the 38px chip, full card hidden, no horizontal overflow) and 1280px (full cards back —
  Today 139px / Calendar 82px — chip hidden) across Today/Courses/Calendar. (Harness screenshot pipeline
  hung as before — verified via DOM measurements, not screenshot.)
- **2026-06-17** — **Update / version system shipped** (persistent history + non-intrusive "what's new").
  **Mock data**: `data/releases.ts` — `Release {version (semver), name, date YYYY-MM-DD, changes[]}` where
  each `ReleaseChange` is `{kind: 'new'|'improved'|'fixed', text}`; `RELEASES` is newest-first (add new
  entries at the TOP), `CURRENT_VERSION = RELEASES[0].version`, plus a `compareVersions` semver helper.
  Seeded with 4 real-ish releases (1.0.0 → 1.3.0). **State**: new `UpdatesProvider` (in `AppProviders`,
  inside Settings) owns `lastSeenVersion` (in-memory, **seeded to the PREVIOUS release** so an unseen
  update is demonstrable on load — resets on reload like the rest of the seed), `notificationsEnabled`
  (opt-out, default on), and the history-modal open state. Derived: `hasUnseen` (current > lastSeen),
  `showIndicator` (hasUnseen && notifications), `showToast` (showIndicator && !dismissed). `openHistory()`
  marks seen (clears the dot) + opens; `dismissToast()` hides the toast but **does NOT** mark seen (the
  dot persists — "not missed if the toast is gone"). **Toast** (`WhatsNewToast`): one line "New in
  v1.3.0 — see what's changed", bottom-right (`right-4 bottom-20 md:bottom-4` so it clears the mobile
  bottom nav), `ct-animate-pop` entrance (reduced-motion safe via the global duration-zero block), 6s
  auto-dismiss (a plain timer, motion-independent), `role=status`/`aria-live=polite`, click→history, X→
  dismiss. **History** (`WhatsNewModal`, reuses `ModalShell`): every release newest-first, changes grouped
  New/Improved/Fixed (colored dot+label), version badge + name + date + a "Latest" tag on index 0;
  Esc/backdrop close. **Persistent indicators** (all clear on view, persist on toast-dismiss, suppressed
  when the toggle is off): a small accent dot on the **profile avatar** — both the desktop sidebar footer
  and the mobile top bar — positioned **over the avatar circle so it never shifts layout**, whose
  destination is a **"What's new"** item in the avatar menu; and the **Settings → General "Updates"** group (a "What's
  new" `vX.Y.Z` button + the **"Show update notifications"** opt-out `Switch`, on by default). **Layer**:
  `UpdatesLayer` (toast + modal) mounted in `StudentLayout` alongside the quick-action/settings layers.
  Build + lint clean; browser-verified (desktop + mobile, no console errors): toast renders bottom-right /
  above the mobile nav with the right copy + a11y roles; X dismisses toast but keeps the dot; clicking the
  toast / version link / avatar item opens the history (4 releases, grouped changes, Latest tag) and
  clears the dot; Settings toggle OFF suppresses toast + all dots while history stays reachable; mobile
  avatar shows the unseen dot, "What's new" opens the bottom-sheet history, no horizontal overflow.
  (Verified the toast via a temporary longer auto-dismiss — the 6s timer outruns the eval round-trip —
  then reverted to 6s.)
- **2026-06-17** — **Update indicator relocated off the sidebar** (user: the standalone `vX.Y.Z` footer
  row "pushes up the user name and settings card"). Deleted `features/updates/VersionLink.tsx` and its
  Sidebar row; the desktop persistent cue now rides on the **profile avatar** dot (dropped the
  `compact`-only gate so it shows in the sidebar footer too — it's absolutely positioned over the avatar
  circle, so the profile/settings card stays pinned to the bottom edge, no layout shift). Destinations
  unchanged: the avatar-menu **"What's new"** item and **Settings → General → Updates** (which still shows
  the version number + history + the opt-out). Build + lint clean; verified: footer version row gone
  (profile card back at the bottom, 12px = sidebar padding), avatar shows the dot on desktop, avatar-menu
  "What's new" opens the history and clears the dot.
- **2026-06-17** — **Avatar-menu polish** (user nits). (1) `ThemeSwitcher` gained `showLabels` (default
  true); the avatar menu now uses `showLabels={false}` → **swatch circles only** (the long "Concordia
  Maroon" label was overflowing the narrow menu; name is preserved as title/aria-label, switching still
  works). Settings → Appearance keeps the labelled form. (2) Avatar-menu **"Back to landing page" →
  "Landing page"** (was wrapping to two lines while every other item is one). (3) Swapped the update
  system's **`Sparkles` → `Megaphone`** (toast + avatar "What's new" item) — the star read as
  AI-generated. Build + lint clean; verified: theme circles don't overflow (maroon right edge 185 ≤ menu
  189) + still switch theme, all menu items single-line (36px), no Sparkles left under features/updates.
- **2026-06-17** — **Promo "demo reel" at `/demo`** (throwaway full-bleed presentation surface for
  screen-recording a marketing video — NOT in app nav). Top-level route (no layout), `fixed inset-0`
  over `bg-canvas` + a faint `ct-grid-bg`; locked tokens (default dark theme via the root ThemeProvider).
  **Six timed scenes auto-advance** on a fixed `DWELL` timeline (`[4.2, 4.2, 7.8, 3.4, 5.6, 6.0]s`;
  scene 3 longest for the cascade; holds on the last). Manual stepping: **← →** (or click) step, **Space**
  play/pause, **R** restart; a **"Play from start"** control (a `runKey` bump re-arms the timeline even
  from scene 0). **All chrome auto-hides**: cursor (`cursor-none`) + the controls bar fade out after 2.6s
  idle, return on mousemove. **Motion is GPU-only** (opacity + transform; `will-change`), never layout —
  shared `DemoPrimitives`: `Stage` (per-scene crossfade, all scenes stay mounted, `active` toggles
  opacity+scale) and `Reveal` (staggered inner entrance via per-element `transitionDelay`, delay→0 on
  exit so Play-from-start restarts clean). **Scenes reuse the REAL app** per spec: **S3** drives the real
  `ParseRevealDemo` (landing's scanner+cascade) via a JS phase machine gated on `active`
  (scan→cascade→done) with the three pillars ("Every deadline, dated." / "…weight, calculated." / "…GPA,
  projected.") easing in as the plan lands; **S5** mounts the real `AppPreview` (the actual Today screen
  built from mock data + shared components) in a browser-chrome frame, remounted on entry (a `mountKey`)
  so its greeting types in on cue. S1 hook ("…five different places." → "Until now."), S2 scattered
  source tags (Moodle/eConcordia/MyLab/PDF/Email, rotated + staggered) "Five syllabi. One overwhelmed
  student.", S4 "The calmest way to run a semester.", S6 outro (big `Logo` → "Stop guessing what's due."
  → "Built for Concordia students."). Files: `features/demo/{DemoReel,DemoScenes,DemoParseScene,
  DemoPrimitives}.tsx`. **To record a clean run:** open `/demo` (full-screen the browser, e.g. F11) →
  click **Play from start** → stop moving the mouse; after ~2.6s the cursor + controls vanish and the
  reel plays through (~31s) and holds on the outro. Build + lint clean; browser-verified (fresh server,
  no console errors): all 6 scenes mounted with correct copy, crossfade (active opacity 1 / others 0),
  auto-advance + hold-on-last, R/Space/arrows, S3 reaches done with 6 cascaded rows, S5 shows the framed
  Today (greeting + due list + caption), S6 outro, idle hides cursor+controls and mousemove restores
  them, Play-from-start resets to scene 0. **Reduced-motion caveat (flagged):** the global block zeroes
  transition/animation durations, so under OS "reduce motion" the reel hard-cuts between scenes instead
  of easing — fine for recording on a normal machine; noted in case the user records with it on.
- **2026-06-17** — **Demo-reel feedback pass** (user, with screenshots). (1) **S2 cards were piling
  top-left** — bug: each `Reveal` wrapper was `absolute` with no offset (0×0 box), so the cards' `left/top`
  percentages resolved against nothing. Rewrote S2 to position the cards directly (no `Reveal`):
  `left/top` clustered around centre + `translate(-50%,-50%) rotate scale`, opacity/scale **POP** in on a
  back-ease (`cubic-bezier(0.34,1.56,0.64,1)`), 110ms stagger → centred + overwhelming (verified card
  centres span x≈539–741 around the 640 viewport centre). Labels shortened + `whitespace-nowrap` (no more
  4-line "Email from your prof"). (2) **Parse columns were unequal height** (left fixed 340, right grew
  with the 6 rows) — fixed in the shared `ParseRevealDemo` (so the **landing** gets it too, per request):
  grid `[1fr_1.2fr]`→`grid-cols-2` (equal width) and **both columns a fixed `h-[384px]`** (right is now
  `flex flex-col`, placeholder `flex-1`); 6 rows fit with no clip and nothing reflows as they cascade.
  Verified equal on both surfaces (demo 504×384 / landing 568×384). (3) **Outro spacing uneven** (logo→
  text gap larger than text→text) — S6 is now one `flex flex-col gap-8`; the logo renders at **real size**
  via a new `Logo size="lg"` (`size-14` mark + `text-[34px]`, no transform-scale) and its `Reveal` is
  `flex` to kill the inline baseline strut → all gaps exactly equal (measured 32/32). (4) **"Drop-in"
  feel** — word scenes now ease in from **above** (`Reveal from="down"`, hidden offset bumped to
  `-translate-y-8`, duration 720ms) for the SaaS launch-video look. Build + lint clean; no console errors;
  landing parse beat re-verified (equal columns, no errors).
- **2026-06-18** — **Blueprint browser shipped** (a marketplace inside Courses — NOT a sidebar tab).
  **Mock data**: `data/blueprints.ts` — `Blueprint {id,courseId,section,teacherVerified,author,upvotes,
  downvotes,uploadedDaysAgo,dates[]}`; helpers `netVotes`, `blueprintsForCourse`, `dateProvenance` (the
  accuracy summary), `blueprintToAssessments` (materialize → import), `agoLabel`. Seeded for coverage:
  teacher-verified + community (COMP 248, POLI 202), community-only ranked (MATH 205, ENGL 233, HIST 203),
  and **none** (COMM 217) for the empty state. **Two entry points, one browser** (route
  `courses/blueprints`, placed before `courses/:courseId` so the static segment wins): the Courses
  **"Import syllabus"** button → unfiltered; **empty course cards** (`assessments.length === 0`) now link
  to `…/blueprints?course=<id>` **pre-filtered** with a clear Upload CTA (whole card = the door, avoids
  invalid nested links; graded cards untouched → grid stays clean). **Browser** (`BlueprintBrowserPage`):
  a prominent search → when no course is picked, a `BlueprintCoursePicker` (your courses filtered live,
  each with blueprint count + a "Verified" hint); editing the search returns to the picker, an X clears.
  Pick → `BlueprintList`: groups by **section**, **teacher-verified pinned** (`ShieldCheck` badge +
  accent ring) and community **collapsed** behind a quiet "N community versions" expander (hidden, not
  deleted); no teacher → community ranked by **net votes**. **`BlueprintRow`** keeps the two credibility
  axes visually separate: a left **vote column** (▲/net/▼, toggles, `aria-pressed`) for popularity, and a
  **date-provenance summary** ("N dates · X confirmed · Y unverified", colored prov dots) for accuracy,
  plus author/handle, upload date, and an **Import** button. Votes are local to the page (in-memory,
  reset on leave — fine for the mock). **Import** → `navigate('/app/courses/:id', { state:{ importItems }})`
  → `CourseDetailPage` plays the **reused `SyllabusParseReveal`** (gained an `autoStart` prop so an import
  scans immediately instead of showing the idle "Upload & parse" CTA) → `onComplete` commits via
  `addAssessments` and `navigate(replace)` clears the import state so the reveal can't replay. Empty
  course detail (direct visit) shows a placeholder linking to the pre-filtered browser. **Empty state**:
  "No blueprint yet for COMM 217 — contribute one and earn theme credits" → `BlueprintContributeModal`
  (ModalShell, mock faux-upload → success "+50 theme credits"); a quiet "Contribute your outline" link
  also sits under every list. Build + lint clean; browser-verified (desktop + mobile, no console errors):
  both entry points, picker counts, teacher-pin + "3 community versions" collapse → expand ranks by net
  (maya 25 › devon 9 › sam 5), vote toggle (25→26 up, flip → 24 down), import → auto-play reveal →
  HIST 203 populated with the 6 blueprint dates (no replay), COMM 217 empty → contribute → "+50 theme
  credits", mobile single-column with full-width search and no horizontal overflow. **Lint note:** reading
  a `ref.current` during render is now an error (`react-hooks/refs`) — used `navigate(replace)` to clear
  the import state instead of a render-read ref.
- **2026-06-18** — **Blueprint browser — feedback pass** (sections, recency, back-nav, previews). (1)
  **Sections are first-class.** `Blueprint` gained `section` (already), `instructor`, `term`, `imports`;
  seeded **multiple sections** per class (COMP 248 BB+BC, HIST 203 AA+AB) with **different dates** per
  section. `BlueprintList` now leads with a **section switcher** (tabs), defaulting to the student's
  enrolled `course.section` (marked "yours"); viewing another section shows a **warning banner** ("you're
  in BB — these are for BC, dates may differ" + a "Show section BB" jump) and every row badges "Section X
  · not yours". The teacher-pin + community-collapse rule applies **per active section**. `key={course.id}`
  on the list resets section/votes when the course changes. (2) **Recency surfaced** — each row shows the
  **absolute upload date** ("Uploaded May 28, 2026", `uploadedOn`) and a **term badge**: current term
  (`=== mock term.name`) renders neutral, past terms render warning ("Winter 2026 · past term"); seeded a
  few past-term low-vote blueprints. (3) **Back-nav bug fixed** — selecting a course was in-page state, so
  browser Back skipped it to Courses. The selected course now lives in the **URL (`?course=`)** via
  `useSearchParams` (picking pushes a history entry; editing the search clears it); verified Courses →
  Import syllabus → pick a class → Back returns to the **picker**, Back again → Courses. Search input
  shows the code when selected and `select()`s on focus so typing replaces it. (4) **Expandable preview** —
  each row expands ("Preview outline") to show exactly what imports: instructor, section, term, item count
  + **weight total** (green ≥100 / warning if under), and the full date list (kind · title · date ·
  weight% · provenance dot). (5) **Counts** — the collapsed row shows **N items** and **M imports**
  (adoption, `Download` icon), kept separate from the vote column (approval) and the provenance summary
  (accuracy). Build + lint clean; browser-verified (desktop + mobile, no console errors): BB default with
  "yours" + teacher-pin + collapse and no warning; switch to BC → warning + community-ranked + "not yours"
  rows; preview shows instructor/assignments/weights/dates/totals; past-term badge on @sam.le (Winter
  2026); import still auto-plays into HIST 203 (6 rows); Back returns to picker; mobile no overflow.
  (`agoLabel` kept as an exported helper though the row now shows the absolute date.)
- **2026-06-18** — **Blueprint provenance correction** (user: per-date confirmed/unverified on COMMUNITY
  uploads claims certainty the system doesn't have — there's no ground truth at upload time). (1) **No
  per-date provenance shown anywhere in the browser** — deleted the row "N dates · X confirmed · Y
  unverified" summary AND the per-date provenance dot in the expand preview (preview now shows kind ·
  title · date · weight only). Removed `dateProvenance`/`DateProvenanceSummary`/`ProvenanceSummary` and
  the `cf` (confirmed) constructor. **Votes** are the community-credibility signal (kept). (2) **Data
  honesty** — all COMMUNITY blueprint dates are now `unverified` (single-source); only **teacher-verified**
  dates are `official`, and that's conveyed by the **badge**, not repeated per date. So importing a
  community blueprint lands its dates as **Unverified** in the course (verified: HIST 203 import shows
  "Unverified", never "Confirmed"); teacher imports stay official. (3) **Past-term hidden by default** —
  within the active section, current-term blueprints rank (teacher-pin + community collapse) and past-term
  ones move into a new "N from past terms · older — dates may have changed" `Collapser` (collapsed by
  default; @sam.le / Winter 2026 no longer inline). (4) **Section filter — no guessed default** — the
  filter now lands on the student's **enrolled** `course.section` always (known, not guessed; dropped the
  prior "fall back to first populated section" guess); the enrolled tab is always present + marked
  "yours". Build + lint clean; browser-verified (fresh server, no console errors): COMP 248 BB shows
  teacher-pin + "2 community versions" + "1 from past term", zero provenance words/dots anywhere, preview
  shows assignments/weights/dates/instructor only, past-term expands to @sam.le, community import →
  Unverified in the course, mobile no overflow. (Stale Vite HMR errors about a missing `dateProvenance`
  export appeared mid-edit — cleared by a dev-server restart; build was always clean.)
- **2026-06-18** — **Peer date-correction stub ("Waze for academics")** — **CONNECTION-PHASE feature,
  mocked in the seed.** Real convergence needs many real users + a backend (you can't infer a crowd date
  from one local user), so the seed only demonstrates the *interaction*; the convergence logic itself is
  deliberately deferred to the connection phase. **Data**: `data/peer-corrections.ts` — `PeerCorrection
  {assessmentId, proposedDue, changedCount, sectionSize}` + `correctionStrength` (a single voice is always
  weak; ≥60% of the section = strong, ≥34% = medium). Seeded 3 on upcoming imported assignments to cover
  the range: **strong** (comp248-a2, 5 of 6), **medium** (poli202-q1, 3 of 8), **weak** (engl233-e1,
  1 of 5). **Honesty is the point**: the prompt shows the raw "**N of M classmates**" + a 1/2/3-bar signal
  meter — never a fabricated "consensus" — so a one-person change reads thin and a majority reads strong.
  **Provider** (`AppDataProvider`): `peerCorrections` (in-memory, resets on reload), `applyPeerCorrection`
  (moves the date + marks it `confirmed`-by-N, then clears the suggestion) and `dismissPeerCorrection`
  (clears, no date change). **The change is always SUGGESTED, never automatic** — every prompt says "You
  decide — nothing changes automatically" with **Update yours** / **Dismiss**. **Component**:
  `components/PeerSuggestion.tsx` (icon + strength meter + "N of M … moved [old → new]" + the two
  buttons); an optional `onApplied` lets the edit modal sync its date field when you accept. **Surfaces**:
  (1) **Today** — a calm one-line `PeerNudge` ("N classmate date changes to review") that opens the first
  suggestion; (2) **Course detail** — full `PeerSuggestion` cards above the `AssessmentTable` for that
  course's pending corrections; (3) **Edit modal** (`AssessmentDetailModal`) — the prompt inline; accepting
  syncs `dueISO`. **Contribute half (mocked)**: changing a date in the edit modal flashes "Date shared with
  your <CODE> section" (the broadcast you'd send to classmates) instead of the generic "Updated …". Build +
  lint clean; browser-verified (desktop + mobile, no console errors): Today nudge → modal with the strong
  5-of-6 prompt; the three strengths render honestly (weak 1 bar / medium 2 / strong 3); Update yours
  applies + clears + syncs the modal date; Dismiss clears without touching the assignment; broadcast toast
  on date edit; mobile no overflow.
- **2026-06-18** — Step 5 (**Community**) shipped — the last core tab. ONE job: "what's happening around
  me that isn't my own coursework." NOT a social feed (no posts/reactions/comments/friends/presence).
  **Data**: one loadable `data/community.ts` — `CampusEvent {id,title,start,location,org,category,
  relevantTo?}` (categories clubs/career/academic/official; `relevantTo` tags drive personalization) +
  `Announcement {id,courseId,title,body,postedDaysAgo}` (course is the source of truth) + `isRelevantTo`.
  Events are runtime-relative (`daysFromNow`) so "upcoming" stays true. **Layout** (the two-column app
  language, `max-w-5xl`, events lead on mobile): **main = events feed (the hero)**, **aside = announcements
  digest (recessed `bg-surface/50`, quieter)**. **EventsFeed**: a compact filter row (All + the 4 category
  chips, each a fixed-hex dot via `features/community/category.ts` so categories read the same across
  themes) + an opt-in **"For my program"** toggle; events sort ascending and group **This week / Later this
  term**; calm empty state ("A quiet week on campus" / context-aware when the program filter empties). Each
  `EventCard` shows a category tag, title, date·time, location, host, a quiet **"For your program"** badge
  when it matches, and **Add to my calendar** → reuses the personal-calendar `addTask` (drops into the
  "My calendar" layer) and flips to an "Added — view in calendar" link. **AnnouncementsDigest**: compact
  cross-course rows (CourseChip + instructor + title + 1-line snippet + relative time) each linking to
  `/app/courses/:id`; calm empty state. **Personalization is real, not guessed**: lifted `school`/`program`
  off local `AccountSection` state into the **provider** (User gained `school`+`program`; `updateProfile`;
  `user` merges a `profile` state seeded from `currentUser` = Gina Cody / Computer Science). Settings →
  Account now writes to it and Community reads `user.program`/`user.school` for relevance (hay = program +
  school, case-insensitive substring). Build + lint clean; browser-verified (desktop + mobile, no console
  errors): 11 events grouped This week/Later, category filter (Career→3), "For my program" honest filter
  (Career+forMe → only the CS-relevant Tech Fair), Add→event appears in the Calendar personal layer + flips
  to Added, **Settings program change is live** (set Major=Business → JMSB event gains "For your program",
  4→5 badges), announcement → course detail, empty state, mobile events-lead + compact filters + no
  overflow. **Note:** the JS bundle now trips Vite's >500 kB advisory (no code-splitting yet) — fine for a
  seed; revisit with route-level `lazy()` if it grows. The announcement links land on the course detail,
  which doesn't yet render the announcement body (the digest is the aggregated view per spec; the snippet
  is shown there).
- **2026-06-18** — **Community refined → richer events + announcements moved out.** Community is now a
  **pure outward-facing events aggregator** (no announcements). (1) **Announcements relocated to Today** —
  it's the student's OWN coursework, which clashes with Community's "beyond your own coursework" purpose.
  Moved `Announcement`/`ANNOUNCEMENTS` to a new `data/announcements.ts`; new `features/today/Announcements
  Digest.tsx` renders a quiet "Announcements" panel **below the due list** in Today's main column. (2)
  **View toggle** — card vs dense row, sticky in the provider (`communityView`, default `card`, resets on
  reload like `coursesView`). (3) **Author + verification** — `CampusEvent.org` is now an `EventOrg
  {name, handle, verified, glyph, color}`; the row/card shows `@handle` + a `BadgeCheck` for **verified**
  orgs (credible source, like teacher-verified blueprints), and the expanded view has a full host block.
  (4) **In-person vs online** — `mode` field → a "In person · H 920" (MapPin) / "Online" (Video) tag near
  the meta + a location-detail line in the expanded view. (5) **Click-to-expand** — each `EventItem` is a
  toggle `<button>` (aria-expanded) that expands **in place** via a `grid-rows-[0fr↔1fr]` height animation
  (smooth, CSS-only); the collapsed body is `inert` so it's keyboard-skippable; reveals full description,
  location detail, host info. The add-to-calendar action is a **sibling overlay** (top-right, stopPropagation)
  so it isn't nested in the toggle button. (6) **Event media** (`EventMedia`, `banner`/`thumb`): two
  deliberate states — an org poster (a GENERATED branded graphic: org color + gradient sheen + glyph
  watermark + handle; **no sourced/stock photos** — licensing) for the 3 events with `poster: true`, else a
  clean **branded color-block fallback** (soft org-tint + glyph). Never an empty/broken box. **Production
  note:** event posters are SUPPLIED BY THE HOSTING ORG as part of submitted event data (consistent with
  the aggregator model) — we don't source/generate them; the color-block fallback covers events with none.
  **No RSVP/attendance** (per spec — social-graph + cold-start + privacy surface). **Deferred, not
  rejected:** RSVP / "attending" counts are a **GROWTH-STAGE** feature — revisit once a typical event would
  show a healthy count (~20+ attending) so low numbers don't make events look dead; personal intent is
  already captured by "Add to my calendar." Layout: Community is now a single reading column (`max-w-3xl`).
  Build + lint clean; browser-verified (fresh server, desktop + mobile, no console errors): events-only (no
  announcements panel), 7 verified badges + handles, in-person/online tags, click-to-expand reveals
  description/host (grid-rows 1fr, inert off when open / on when collapsed), poster events show the gradient
  graphic + no-poster show the branded fallback, view toggle switches card↔row + stays sticky across nav,
  Add (overlay, no accidental expand) → Added link → Calendar personal layer, announcements now on Today
  below the due list, mobile no overflow + expand works. (Stale Vite HMR `ANNOUNCEMENTS`-export errors
  appeared mid-edit — cleared by a dev-server restart; build was always clean. Bundle still trips the >500
  kB advisory.)
- **2026-06-18** — **Community refine v2 — full-screen detail, real grid, host-leads, animated filters.**
  Four moves (the inline accordion `EventItem` was **deleted**; replaced by `EventTile` + a full-screen
  `EventDetail`). (1) **Full-screen detail overlay (posh.vip feel), URL-driven.** Clicking an event opens
  `EventDetail` — a `fixed inset-0 bg-canvas` overlay (NOT a dropdown) via `?event=<id>` (`useSearchParams`
  in `EventsFeed`), so it's **linkable, back-button-friendly, and preserves feed scroll** (the feed stays
  mounted underneath). Built on `useModalDismiss` (focus trap / Esc / scroll-lock / focus-restore); a sticky
  header has a "← Events" back + X (both `onClose`). The reusable `EventDetailView` (split out so it can
  become a real route later) renders: hero `EventMedia`, `CategoryTag` + "For your program" pill, the full
  title, date/time + mode/location, **add-to-calendar** (accent → "Added — view in calendar" link, reuses
  `addTask`), an **About** section, a mode-aware section — **"Where"** = static `MapPlaceholder` (`ct-grid-bg`
  + pin + "Map preview — static in this build", **no live map**) for in-person, **"How to join"** =
  `OnlineNote` for online — and a **"Hosted by" `HostCard`** (big org logo, full name + `VerifiedBadge` +
  handle, Follow/Contact buttons — Follow toggles local state, and **"More from this host"** = other upcoming
  events by the same `org.handle` via new `moreFromHost(event, now)`, each navigating in-place with a
  scroll-reset). (2) **Card view = a real multi-column grid** — `grid grid-cols-1 sm:grid-cols-2
  lg:grid-cols-3` (media-on-top tiles); row view stays a dense single column (`flex max-w-3xl flex-col`);
  `CommunityPage` widened `max-w-3xl → max-w-5xl` for the grid. (3) **Host identity LEADS each tile**
  (`HostRow`: org logo + name + handle, with the verified seal, ABOVE the title — "who's it from" before
  "what is it"). The **`VerifiedBadge`** is a custom **filled** Twitter-style seal (scalloped disc in
  `text-info` + white check, an inline SVG — not the hollow `BadgeCheck`); meaning = an authenticated real
  org. `EventMedia` gained a `hero` variant for the detail. (4) **Filters: icons + FLIP animation.** Each
  category chip now carries its `CATEGORY_META.icon` tinted the category hex (color as subtle accent, not a
  bare dot) + a press animation (`active:scale-95`, transition incl. transform). When a filter changes,
  the new **`AnimatedEventList`** keeps the full (date-sorted) set, marks non-matching entries `exiting`
  (fade + `scale-0.96` in place, `inert`), removes them after `EXIT_MS`, and **FLIP-glides survivors** to
  their new slots (Web Animations API: translate-delta for movers, opacity/translateY fade for newcomers) —
  no hard snap. Reconcile is **adjust-state-during-render** but tracks the previous `visibleIds` in **state**
  (not a ref) to satisfy `react-hooks/refs`. Remounted on view change (`key={communityView}`) to avoid
  cross-layout FLIP jank. **Reduced-motion safe**: WAAPI gated on `!reduced`, exit timer collapses to 0, and
  the global block zeroes the CSS fades. Build + lint clean; browser-verified (desktop + mobile, no console
  errors): 13-card responsive grid (1/2/3 cols), 8 verified seals, host-leads tiles; Career filter 13→4 with
  FLIP exit; detail overlay opens `?event=` with About/Where(map)/Hosted-by; online event → "How to join"
  not a map; "More from this host" navigates in-detail + resets scroll; Esc closes + clears the URL; row
  view remounts to dense single column; mobile 1-col grid + full-screen detail, no horizontal overflow.
  (Stale Vite HMR errors about the deleted `EventItem` — cleared by a dev-server restart; build was always
  clean.)
- **2026-06-18** — **Community card consistency — equal-size cards + one uniform no-image banner.** Two
  fixes (user, with brand-asset screenshots). (1) **Equal-size cards** — every `EventTile` card now has a
  FIXED internal layout so the whole grid is uniform (not just per-row), with the Add button and bottom
  edge in the same place on every card regardless of content: fixed `h-32` banner, fixed 2-line `HostRow`,
  a **2-line-reserved clamped title** (`line-clamp-2 min-h-[2.75rem]` — over-long titles truncate cleanly),
  a **single-line meta row** with a **reserved height** (`min-h-[1.375rem]`, so the optional "For you" pill
  no longer adds 3px — date kept whole, location truncates, pill pinned right), and a bottom-pinned footer
  (`mt-auto`) on an `h-full flex-col` article. Verified: all 15 cards exactly 311px (one unique height),
  Add button 13px from the bottom on every card, row bottoms align; row view uniformly 110px. (2) **One
  uniform no-image banner** — `EventMedia` had TWO fallbacks (a gradient+monogram "poster" vs a small-logo
  tile on a plain banner). Collapsed to ONE: every image-less event renders the **org-brand-colored gradient
  + large faded org-initials monogram** (the HackConcordia/Gina Cody look) in card, row (thumb shows the
  centered initials), AND detail hero — so each org's events read with a **consistent identity colour**
  (`org.color`, fixed hex → same across themes). Real images render via a NEW **`CampusEvent.image?`** field
  (`<img object-cover>`); a broken image **hides itself on error** → the branded banner shows beneath, so
  it's never an empty box. `CampusEvent.poster?: boolean` was removed (the 4 `poster:true` flags deleted);
  the second "color-block fallback" branch + its `withAlpha` tint are gone. Added a **CASA JMSB** org
  (maroon `#9b2335`, `CJ`, verified) + two events (Stock Pitch / CASA Cares) so the org-identity colouring
  is demonstrable with a real Concordia entity. Build + lint clean; browser-verified (desktop + mobile, no
  console errors): 15 uniform 311px cards, 11 distinct org-colored banners (no plain-banner variant left),
  CASA shows maroon `CJ` in card + maroon hero in the detail, row thumbs org-colored, mobile 1-col uniform
  311px no overflow.
- **2026-06-18** — **Real brand images wired (user-supplied ImgBB links).** The user provided 5 hosted
  images (resolved each `ibb.co/…` PAGE link to its direct `i.ibb.co/…` file via WebFetch's og:image).
  Three integration points, all with a graceful **`onError` → branded fallback** (the `<img>` hides itself,
  revealing the gradient/initials beneath — never a broken box): (1) **Event banners** — `CampusEvent.image`
  set on the two CASA events (Stock Pitch = the photo banner, CASA Cares = the basic banner) → real image
  in card, row, AND detail hero (+ the "more from this host" thumb). (2) **Org logos** — `EventOrg` gained
  `logo?`; set on **JMSB**, **CASA JMSB**, and **JMIS** → the host avatar tile (`HostRow` size-7 + detail
  `HostCard` size-11) shows the real logo (object-cover) instead of coloured initials. JMSB's `color` moved
  blue → Concordia **maroon `#912338`** to match its real brand (distinct from CASA `#9b2335` by logo +
  content). (3) **New org: John Molson Investment Society (JMIS)** — added to the `ORG` map (navy `#1f4e8c`,
  glyph `JI`, the JMIS logo, verified) with a "JMIS Speaker Series" career event, so JMIS is a proper HOST
  in the feed. (Initial misread — first wired the JMIS logo as the *user's* profile picture via a
  `User.avatarUrl`; the user clarified JMIS is an org, so that was fully reverted — `avatarUrl` removed from
  the type + `currentUser`, `AvatarMenu` back to initials-only — and JMIS added as an org instead.) Images
  are **hot-linked** (runtime URLs, not in the repo) — fine for the seed; swap to `public/` assets for a
  self-contained build. Build + lint clean; browser-verified (desktop + mobile, no console errors): both
  CASA banners load (640px) in card/row/detail, JMSB + CASA + JMIS host logos load, the JMIS card renders
  navy with its logo, the user avatar is initials again, cards still uniform 311px, no overflow.
- **2026-06-18** — **Community: org profiles + profile search + a STUBBED follow/notifications system.**
  Two parts BUILT FULLY (work on mock data) and one part deliberately a UI SHELL (needs a backend). (A)
  **Org profile page** — new route `community/org/:handle` (`OrgProfilePage`), keyed by the handle (sans
  `@`) as a URL-safe slug; a real page in the app shell (sidebar stays), linkable + back-button friendly.
  Layout: an org-brand-colour **cover band** + overlapping logo (ring-4), name + `VerifiedBadge`, handle,
  **bio**, **stats = real event counts only** ("N upcoming · M past" — NO fabricated follower count), a
  **`FollowButton` + Contact**, then **Upcoming** and **Past** sections of REUSED `EventTile` cards, each
  with a "Posted Xd ago" caption (`postedAgoLabel`). Opening an event uses the SAME `?event=` detail
  overlay as the feed (via the new shared `useEventActions` hook). The event-detail **host card** now
  links its header to the profile (`ChevronRight` affordance) and uses `FollowButton`. (B) **Profile
  search** (`OrgSearch`) — a keyboard-accessible combobox (↑/↓/Enter/Esc, `role=combobox`/`listbox`/
  `option`, `aria-activedescendant`) in the Community header; matches orgs by name/handle (`searchOrgs`),
  results link to profiles. (C) **Follow + pinned bar + notifications — STUB, CONNECTION-PHASE.** A real
  follow graph + notification generation/delivery need a **multi-user backend** and CANNOT function on
  single-user mock data — so this is the *interaction* only. Follow state lives behind ONE swappable
  helper: **`app/providers/follows.tsx` (`FollowsProvider` + `useFollows`)** — an in-memory `Set<handle>`
  (seeded with `@hackconcordia` + `@ginacody` so the bar/notifications populate on load; resets on reload).
  **Re-implement that single file against Supabase and nothing else changes** — `FollowButton`,
  `FollowingBar` (pinned followed-org chips atop Community → profiles), and `NotificationsBell` all read
  through `useFollows`. The **notifications panel** is a shell: items are derived from followed orgs'
  upcoming events (`recentEventsFromOrgs` → "‹Org› posted a new event"), an unread dot clears on open,
  clicking an item opens that event's detail; a footer line + CLAUDE note flag it as mocked. **Data
  (`community.ts`):** `EventOrg` gained `bio`; `CampusEvent` gained `postedDaysAgo`; added 5 **past events**
  (negative `daysFromNow`, surfaced only on profiles since the feed filters to upcoming); **fixed a latent
  bug** — `president` + `university` both used `@concordia` (would collide when keying profiles by handle)
  → President's Office is now `@concordia.president`/glyph `OP`. New exports: `ORGS`, `orgSlug`,
  `orgBySlug`, `orgByHandle`, `eventsByOrg`, `searchOrgs`, `recentEventsFromOrgs`, `postedAgoLabel`. New
  shared bits: **`OrgLogo`** (the logo-or-initials tile, now reused by `HostRow`/`HostCard`/profile/search/
  following-bar) and **`useEventActions`** (open/close `?event=`, plus `isAdded` now **derived from
  `personalTasks`** so "Added" is consistent across feed + profile — replaced the feed's local `addedIds`).
  `FollowsProvider` mounted in `AppProviders` (inside `AppDataProvider`). Build + lint clean; browser-
  verified (desktop + mobile, no console errors): search "molson" → 2 orgs → profile; profile header +
  stats (2 upcoming/1 past) + Upcoming/Past cards w/ "Posted 1w ago"; Follow on profile → "Following" →
  pinned bar gains the chip (state propagates across surfaces); host-card link → profile; bell shows
  unread, panel lists 3–5 mock items, click → event detail, dot clears on open; mobile no overflow, panel
  fits, profile cards uniform 311px. **Lint note:** `setActive(0)` was moved out of a `useEffect` into the
  input `onChange` (`react-hooks/set-state-in-effect`).
- **2026-06-18** — **Community feedback: Twitter/X-style profile header, "Remind me", Following LIST.**
  (1) **Profile header reworked to an X profile** (user gave an X screenshot as the layout reference;
  asked to keep the horizontal upcoming-event cards) — replaced the cover-band+card with a full-width
  **banner**, an **overlapping circular avatar** (`OrgLogo rounded-full`, `-mt-12`, `ring-4 ring-canvas`),
  **Follow + Contact top-right** on the row below the banner, then name + `VerifiedBadge` / handle / bio /
  stats — no surface card, sits on canvas like X. `EventOrg` gained **`banner?`**; **CASA JMSB's banner is
  the nicer CASA photo banner** (per request); orgs without one fall back to the brand-colour cover
  (gradient), and a broken banner `onError`-hides to reveal the colour. The Upcoming/Past **card grids are
  unchanged** (kept per request). (2) **"Remind me" button** beside "Add to my calendar" in the event
  detail (`RemindButton`, Bell→BellRing, "Remind me"↔"Reminder set") — STUB backed by new in-memory app
  store state **`isReminderSet`/`toggleReminder`** (persists across the session + reopen; real reminder
  delivery is connection-phase). (3) **Pinned chip bar → a Following LIST** (user: the chip bar "looks
  odd" / clutters with many follows). Deleted `FollowingBar`; new **`FollowingMenu`** = a "Following N"
  button opening a scrollable popover list (org logo + name + handle + inline unfollow `FollowButton`,
  each row links to the profile) — same popover pattern as the bell, so it scales and **works on mobile**
  (the "Following" label collapses to just the count on `<sm`). Lives in the header controls row beside
  the search + bell. Build + lint clean; browser-verified (desktop + mobile, no console errors): CASA
  profile shows the photo banner + circular dot-logo avatar + X-style header; Remind toggles + persists on
  reopen; Following list shows the 2 seeded follows w/ inline unfollow; controls row + profile fit 375px
  with no overflow, cards still uniform 311px.
  **Follow-up (same day):** user feedback — "lack of divider" + "awkward empty space on the right below
  Follow and Contact." Both came from the profile using the feed's wide `max-w-5xl` column (buttons pinned
  far-right of a 1024px column → big right-side void; few events → empty grid cells; no header/section
  separation). Fix: narrowed the **profile** to `max-w-3xl` (the events grid drops to `grid-cols-1
  sm:grid-cols-2` — still the horizontal cards, now filling the row; the bio reaches under the buttons so
  the void mostly closes) and gave each event group a **full-width divider** (`border-t border-border
  pt-5`, replacing the old margin-only `Section` helper) — a Twitter-style rule under the header and above
  Past. The main FEED stays `max-w-5xl`/3-col. Verified: 768px column, 2-col→1-col on mobile, 1px dividers
  above Upcoming + Past, no overflow, cards uniform 311px, no console errors.
- **2026-06-18** — Step 6 (**Teacher portal**) shipped — the THIRD context (student / teacher / public),
  an invite-based, publish-only dashboard for professors. **Layout proposed + approved first.** Distinct
  chrome (`TeacherLayout` = plain top-bar dashboard, no student sidebar/command palette; shows the
  signed-in teacher + status + Sign out + an Admin link). Routes under `/teacher`: `index` (sign-in when
  signed out, dashboard when in), `invite/:token`, `course/:courseId`, `admin`. **State = one swappable
  helper** `app/providers/TeacherProvider.tsx` (`useTeacher`) — in-memory, resets on reload; data + seeds
  + pure helpers in `data/teacher.ts`. **CONNECTION-PHASE (flagged):** invite-email delivery, the
  email-confirmation step, approval, and verification are all stubs — the seed builds the UX shape only;
  swap the provider for Supabase and the screens are untouched (no real auth/passwords). **ACCESS MODEL —
  two gates:** (1) an admin **originates an invite** (`createInvite` pre-fills the teacher name from the
  course's instructor) → a **single-use, expiring, email-bound** token (`inviteStatus` → valid/expired/
  used/notfound; `TeacherInvitePage` shows the pre-scaffolded course + a stubbed "confirm your email to
  h••••@…" step; accepting creates a **pending** account, consumes the token, signs in). (2) **approval** —
  a pending teacher can prepare an outline but **cannot publish/post**; the admin `approveTeacher`s, and
  the dashboard/workspace flip to enabled. **Admin console** (`/teacher/admin`, openly reachable = your
  mock control panel): create-invite form, a teachers list (pending rows get **Approve**), an invites
  list (Used/Expired/expires-in labels). **Teacher dashboard**: managed-course cards (Published / Draft·N /
  empty) + a **`LinkCourseModal`** (link an existing catalog section OR create a new course). **Course
  workspace** (`TeacherCourseWorkspace`): build the outline via **the same two input paths students have**
  — **Upload syllabus** (reuses `SyllabusParseReveal`, `autoStart`, → fills the editor) or **enter
  manually** via `OutlineEditor` (kind `Select` / title / `DateTimePicker` / weight / remove rows + a
  **running weight total**); a **Publish** button (gated while pending); plus an **announcement composer**.
  **Publish-only** — a footer states no student grades/standings/import-counts are shown. **THE SUPPLY
  PIPE (key):** a published outline IS the teacher-verified `Blueprint`, NOT a separate record — the 2
  hard-coded teacher-verified blueprints were **removed from `data/blueprints.ts`** (it now holds COMMUNITY
  uploads only) and are now **published from the portal** (`outlineToBlueprint`); `publishedBlueprints` is
  derived in the provider and **merged into the student browser** (`BlueprintList` + `BlueprintCoursePicker`
  read `[...community, ...publishedBlueprints]`) so a portal publish **pins + collapses community** exactly
  as before. **Announcement pipe:** `postAnnouncement` → merged into Today's `AnnouncementsDigest` AND a
  new course-detail `CourseAnnouncements` panel. **Seed (resets on reload):** 2 approved teachers
  (Hanna→COMP 248, Salée→POLI 202, both published → they SOURCE the two verified pins now), 1 pending
  (Dafni→MATH 205, draft) for the approve demo, a **valid** invite `demo-comm217` (COMM 217 has no
  blueprints → the publish→student-browser pipe is visibly new) + an **expired** one; session starts
  signed-out. Build + lint clean; browser-verified (desktop + mobile, no console errors): sign-in →
  demo dashboard (Hanna, approved, COMP 248 published); workspace 6-row outline @100% + published-live;
  the seeded pipe (COMP 248 student browser pins "Dr. Aiman Hanna" from the portal); the **full runtime
  flow** — accept `demo-comm217` → pending Tremblay (publish gated) → admin **Approve** → parse fills 5
  rows @100% → **Publish** → student COMM 217 browser flips empty→"Dr. Hélène Tremblay · Teacher-verified ·
  5 items" pinned; announcement post → Today digest + course-detail panel; admin shows Used/Expired
  invites; mobile workspace rows stack with no overflow. **Note:** publishing makes the outline LIVE
  (edits to a published outline update the blueprint immediately — there's no draft-vs-published diff; that
  snapshotting is connection-phase). Bundle now ~578 kB (still no code-splitting — fine for the seed). The
  teacher portal is intentionally a bit more "tool/dashboard" than the student app.
  **Follow-up (same day):** three teacher-side additions. (1) **Preview as student** (`StudentPreviewModal`,
  a workspace header button, disabled on an empty outline) — a read-only view of the outline as students
  see it once imported: kind · title · `formatDueDateTime` · weight · an **Official** `ProvenanceBadge` +
  the weight total. (2) **Past announcements** — the workspace's announcement list now MERGES the seeded
  `ANNOUNCEMENTS` with the teacher's posts for that course (sorted, labeled "Past announcements"), so a
  course's history shows even before the teacher posts (e.g. Hanna's COMP 248 shows "Assignment 2 deadline
  extended"). (3) **Verify a student blueprint** (`CommunityBlueprintsPanel`) — a new workspace panel lists
  the COMMUNITY blueprints for the teacher's section (current-term, ranked by net votes, with items/weight/
  ▲votes/imports). **Verify** (a 2-click confirm; gated while pending) **adopts that blueprint's dates as
  the teacher's PUBLISHED outline** (it becomes the teacher-verified pin, authored by them) AND **absorbs**
  the original out of the student community pool — exactly "it becomes the teacher's blueprint, no longer
  the student's, granting it verification." Provider gained `absorbedBlueprintIds` + `verifyCommunityBlueprint`
  (adopt→`updateOutline`+publish, add the id to absorbed); the student browser (`BlueprintList` +
  `BlueprintCoursePicker`) **filters absorbed** community ids from the merge. Build + lint clean; browser-
  verified (desktop + mobile, no console errors): preview modal shows the 6-row outline w/ Official badges
  @100%; past-announcements label + seeded item render; verifying @maya.codes on COMP 248 BB **adopted her
  5 dates** as Hanna's outline (published) and **removed her from the panel** → the student COMP 248 BB
  browser then pins "Dr. Aiman Hanna" with those dates and community versions dropped 2→1 (maya absorbed),
  with no console errors. (Harness screenshot pipeline hung again — verified via DOM.)
  **Follow-up 2 (same day):** five workspace refinements. (1) **`LinkCourseModal` → search + grouped by
  course → sections** (was one row per course-section): a search bar filters the catalog; each course
  shows its code/title with its **sections as pickable chips** (`[course.section, …sectionsForCourse]`),
  already-linked courses excluded (HIST 203 surfaces AA+AB). (2) **Verify → review FIRST**: each
  `CommunityBlueprintsPanel` row now **expands ("Review")** to show the blueprint's full dated assessments
  before a "Verify & make it your outline" button — no blind verify. (3) **Preview → a REAL embed**
  (`StudentCoursePreview`, a full-screen overlay replacing the old summary modal) renders the actual
  student course-detail components — `CourseHeader` banner + the editable `CourseInfoPanel` + `GradeBreakdown`
  + a read-only assessment list — fed by the teacher's outline (`outlineItemToAssessment` / `teacherCourseToCourse`
  moved to `data/teacher.ts` so the parse path + preview share them). (4) **Edit course info students see** —
  the embedded `CourseInfoPanel` is the same inline-editable one (writes via `updateCourse`), so the teacher
  sets instructor/TA/section/meets/**office hours**/location/credits/syllabus right in the preview; verified
  the edit flows to the student course detail. Added an optional **`Course.officeHours`** field (seeded on
  COMP 248 + COMM 217) shown as an editable row in `CourseInfoPanel`. (5) **Section order** is now
  Announcements (composer) → Past announcements → Course outline → Verify blueprints (per request). Build +
  lint clean; browser-verified (desktop + mobile, no console errors): link search + section chips,
  review-expand → verify absorbs (community 2→1, outline adopts the 5 dates), the full embed renders the
  real course view, editing office hours in the preview updates the student course detail, reordered
  sections, mobile no overflow.
  **Follow-up 3 (same day):** editable/deletable announcements + a self-serve access-request flow.
  (A) **Announcements are now mutable + carry provenance.** `Announcement` gained `editedDaysAgo?`; the
  **seeded `ANNOUNCEMENTS` are cloned into provider state** (so every announcement — seeded or posted — is
  editable), and ALL surfaces now read `teacherAnnouncements` only (no more static merge). New provider
  `editAnnouncement` (stamps `editedDaysAgo: 0`) + `deleteAnnouncement`. A shared **`AnnouncementMeta`**
  (`components/`) renders "**Posted {absolute date}**" + an "**Edited · {when}**" tag — shown identically to
  students (Today `AnnouncementsDigest` + course-detail `CourseAnnouncements`) and teachers. The workspace
  past-announcements list (`TeacherAnnouncementList`) gives each row inline **Edit** (title+body, re-stamps
  Edited) and **Delete** (2-click confirm), gated while pending. (B) **Self-serve access requests**
  (STUB/connection-phase). New `data/teacher.ts` `AccessRequest {caseId, name, email, message, status:
  pending|accepted|denied, requestedDaysAgo}` + `SEED_REQUESTS` + sortable `caseIdFor`/`FIRST_CASE_NUMBER`
  (REQ-1043…, a `useRef` counter). Provider: `accessRequests`, `submitAccessRequest` (assigns the Case ID,
  returns it), `setRequestStatus`, `getRequest`. New route **`/teacher/request`** (`TeacherRequestPage`):
  a **Request access** form (name/email/what-you-teach) → a success card with the **Case ID** + an
  instruction to also email **concordiatracker@gmail.com** (a `mailto:` with the Case ID in the subject) to
  speed up + verify identity; and a **Check a request** tab (enter Case ID → status + "Requested {ago}").
  The sign-in page links "Request teacher access". The **admin console** gained an **Access requests**
  block — **search** (case ID / name / email) + a **sort-by-Case-ID** toggle (numeric, default newest-first)
  + per-row **Accept/Deny** (pending only). Build + lint clean; browser-verified (desktop + mobile, no
  console errors): edit a seeded announcement → new title + "Edited · today" on the workspace AND the
  student Today digest (with "Posted {date}"); delete removes it everywhere; submit a request → REQ-1043 +
  mailto + pending; admin search/sort + Accept flips it; the requester's Check-status shows "accepted —
  invite sent". **Note:** Accept just sets the request status (the admin still sends the actual invite via
  the Create-invite form); auto-linking an accepted request to a pre-filled invite is connection-phase.
