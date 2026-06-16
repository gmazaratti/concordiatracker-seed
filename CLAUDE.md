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
