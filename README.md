<div align="center">

# 🎓 ConcordiaTracker

**One calm home for everything a Concordia student has due — pulled out of the five different sites it's scattered across.**

[![License: All Rights Reserved](https://img.shields.io/badge/license-All_Rights_Reserved-red.svg)](./LICENSE)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Supabase](https://img.shields.io/badge/Supabase-backend-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com)

[The problem](#-the-problem-five-different-sites) · [The solution](#-the-solution) · [Highlights](#-highlights) · [Tech stack](#-tech-stack) · [Getting started](#-getting-started) · [Architecture](#-architecture) · [Roadmap](#-roadmap)

_Not affiliated with Concordia University._

</div>

---

ConcordiaTracker is a school-specific academic hub: a single, fast, keyboard-driven app that lifts every deadline, grade, and course detail out of the half-dozen disconnected systems a student logs into — so the answer to _"what's actually due?"_ is one glance, not five tabs.

> **Project status.** This is a production-quality **front-end foundation**: every screen, interaction, and animation is real and runs on a single in-memory mock-data module. The architecture is deliberately built so the planned **Supabase** backend (auth, Postgres, Realtime) slots in behind one swappable provider per feature — no UI rewrites required. See [Architecture](#-architecture).

## 🎯 The problem: five different sites

A Concordia student's semester doesn't live in one place. The real information for a single term is fragmented across — at minimum — **five different sites**, each with its own login:

1. **Moodle** — assignments, some grades, course pages
2. **eConcordia** — other courses that live entirely outside Moodle
3. **The Student Hub** — registration, add/drop, official university dates
4. **Publisher platforms** — MyLab, Connect, WileyPLUS, and friends, where the weekly quizzes hide
5. **PDF syllabi + professor emails** — where the deadlines that actually matter are buried

There is no single, trustworthy view of what's due this week. Dates get missed not because students don't care, but because "the schedule" is smeared across five systems that don't talk to each other — and the most important dates are stuck inside a PDF or a one-line email.

## 💡 The solution

ConcordiaTracker collapses those five sites into **one** Concordia-specific home:

- **Drop a syllabus, get a semester.** A scripted parse extracts every assessment, weight, and deadline from a course outline and cascades it into the app — the product's hero moment.
- **Every date carries its origin.** A first-class **provenance system** badges each deadline as _official_, _confirmed by N classmates_, or _unverified_, so you know what to trust.
- **One place for "what's due."** A calm Today view, a month/week/agenda **Calendar** with toggleable personal + university layers, and editable **Courses** with real grade math.
- **Calculators that actually compute.** A free _"what grade do I need to pass?"_ solver and a Pro _GPA what-if_ slider — real arithmetic on the Concordia 4.30 scale, not vibes.
- **Crowd-sourced syllabi.** A **blueprint marketplace** lets you import a classmate's or professor's outline, with a "Waze for academics" peer date-correction layer when a deadline moves.
- **A teacher portal.** An invite-based, publish-only context where professors confirm the authoritative outline — which becomes the verified blueprint students import.

The front end is built in **React + TypeScript**; the backend is **Supabase** (Postgres, Auth, Realtime).

## ✨ Highlights

Things in here worth a closer look:

| Feature | What's interesting |
| --- | --- |
| **Syllabus parse-reveal** | A scripted, reduced-motion-safe extraction animation — drop a PDF, watch dates cascade into the course. |
| **Provenance everywhere** | `official` / `confirmed-by-N` / `unverified` is a reusable, first-class UI primitive on every date. |
| **Command palette** | `Cmd/Ctrl + K` is the real navigation spine — typeahead, full keyboard a11y, focus-trapped, mobile bottom sheet. |
| **Three separate auth contexts** | Public marketing site · student app · teacher portal — deliberately never blended into one nav. |
| **Grade math** | A single source of truth (`lib/gpa.ts`) drives the banner grade, the grade-needed solver, and the GPA projector. |
| **Blueprint supply pipe** | A teacher's published outline _is_ the verified blueprint students import — one record, not a copy. |
| **Theming in one file** | Tailwind v4 CSS-first `@theme` tokens; a refined dark theme + a Concordia maroon/gold theme swap at runtime. |
| **Accessibility & motion** | Keyboard nav, visible focus, ARIA roles, focus traps; CSS-only motion that respects `prefers-reduced-motion`. |
| **Built to scale to a backend** | Each stub (auth, follows, teacher invites, calendar sync) sits behind a single swappable provider. |

There's also a self-running **demo reel** at `/demo` (a ~30-second auto-advancing tour built for screen recording).

## 🧰 Tech stack

| Layer | Technology |
| --- | --- |
| **Framework** | [React 19](https://react.dev) + [TypeScript 6](https://www.typescriptlang.org) (strict mode) |
| **Build tooling** | [Vite 8](https://vite.dev) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com) (CSS-first `@theme`, no `tailwind.config.js`) |
| **Routing** | [React Router 7](https://reactrouter.com) |
| **State** | React Context + hooks (no Redux) |
| **Icons** | [lucide-react](https://lucide.dev) |
| **Backend** _(integration phase)_ | [Supabase](https://supabase.com) — Postgres, Auth, Realtime |

> Data today is a single in-memory mock module so the whole app is explorable without a backend. Supabase is the designated production backend, and the codebase is structured to adopt it one provider at a time.

## 🚀 Getting started

**Prerequisites:** [Node.js](https://nodejs.org) 20+ and npm.

```bash
# 1. Clone
git clone https://github.com/<your-username>/concordiatracker.git
cd concordiatracker

# 2. Install
npm install

# 3. Run the dev server (http://localhost:5173)
npm run dev
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server with HMR |
| `npm run build` | Type-check (`tsc -b`) and build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint over the project |

No environment variables are needed yet — everything runs on mock data. (Supabase keys land here in the integration phase.)

## 🗂 Project structure

```
src/
├── app/            # Cross-cutting providers + hooks (the swappable backend seam)
│   └── providers/  #   AppData, Theme, Settings, Follows, Teacher, …
├── components/     # Shared UI primitives (Card, Select, DateTimePicker, ModalShell, …)
├── data/           # The single mock-data module + domain types
├── features/       # Screen-level features, one folder each
│   ├── today/      #   the launch view
│   ├── courses/    #   course list, detail, grade editor, blueprint browser
│   ├── calendar/   #   month / week / agenda, layered
│   ├── community/  #   campus-events aggregator + org profiles
│   ├── teacher/    #   the invite-based teacher portal
│   ├── settings/   #   profile, billing, usage, legal
│   └── landing/    #   the public marketing site
├── layouts/        # The three context shells (public / student / teacher)
├── lib/            # Pure logic: gpa, grade, date, course-color, …
└── index.css       # ALL design tokens (colors, type, spacing) — reskin in one file
```

## 🏛 Architecture

A few decisions that make the codebase pleasant to grow:

- **Three deliberately separate contexts** — public marketing, the student app (exactly four tabs: Today · Courses · Calendar · Community), and a plainer teacher portal — never blended into one navigation.
- **One mock-data module, one write surface.** All in-session mutations (grades, statuses, follows, teacher publishes) flow through context providers that clone a single seed, so there's exactly one place state lives.
- **Designed for a clean Supabase swap.** Backend-dependent pieces — authentication, the follow graph, teacher invites/approval, calendar sync, notifications — are isolated behind **one provider each**. Re-implementing that single file against Supabase connects the feature with no UI changes. These seams are flagged in-code as _connection-phase_.
- **All design tokens in one file.** Colors, type scale, spacing, and radii are CSS custom properties in `index.css`, exposed to Tailwind via `@theme inline`; re-skinning or adding a theme is a one-file change.
- **Discipline.** TypeScript strict on, files kept small and single-purpose, motion CSS-only and reduced-motion safe.

## 🛣 Roadmap

The front end is feature-complete on mock data. The next phase wires the backend:

- [ ] **Supabase Auth** — replace mock sign-in across all three contexts
- [ ] **Postgres schema + RLS** — courses, assessments, blueprints, provenance, follows
- [ ] **Realtime** — peer date-corrections and the "confirmed by N students" counts, live
- [ ] **Teacher invites & approval** — real single-use, email-bound, expiring tokens
- [ ] **Stripe** — the semester pass / monthly billing made real
- [ ] **A real syllabus parser** — swap the scripted reveal for genuine extraction

## 🤖 Development & AI assistance

Built with the assistance of Claude Code for refactoring and feature implementation.

## 📄 License & usage

**© 2026 Alex Degryse — All rights reserved.**

This repository is public for **portfolio review only**. It is **not** open source: you're welcome to read the code, but copying, modifying, redistributing, or reusing it in another project is not permitted without written permission. See [LICENSE](./LICENSE).
