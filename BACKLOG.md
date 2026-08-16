# ConcordiaTracker — Backlog

Everything raised and deliberately deferred, so it stops living in chat history.
Newest sections first within each group. When something ships, move it to **Done**
with the date, don't delete it — knowing we already decided something is as useful
as the decision.

Status key: **NEXT** (agreed, not started) · **NEEDS A DECISION** (blocked on you) ·
**BLOCKED** (blocked on someone else) · **IDEA** (worth doing, not committed).

---

## Messaging & notifications

- [ ] **Custom SMTP for auth email** — **NEXT, and arguably already broken.**
      Supabase's built-in email is capped at **2 messages/hour** and is explicitly
      not for production, so signup emails silently fail during any burst. Custom
      SMTP raises the default to 30/hour, tunable after.
      Provider candidates: Resend (free 3,000/mo but **100/day**; Pro $20/mo for
      50,000), AWS SES, Postmark.
      → *Decision needed: which provider.*
- [ ] **Transactional email** — seat opened, deadline digest, trial ending,
      receipts. Same provider as above.
- [ ] **News / promotional email** — **must be a separate stream with its own
      opt-in and its own unsubscribe.** Auth email is not commercial and CASL
      does not apply; promo email is and does.
- [ ] **SMS seat alerts as a premium tier** — **NEEDS A DECISION.**
      Twilio to Canada is ~1.5–1.7¢/message ($0.0083 + carrier fee) plus $1.15/mo
      for the number, so unit economics are fine. The constraint is **CASL**:
      express opt-in, sender ID in the message, working unsubscribe honoured
      within 10 business days, **up to $10M per violation**. A seat alert someone
      explicitly requested is the easiest possible CASL case; promotional SMS is
      not, and should stay off the table.
      → *Decision needed: existing Pro tier, or a new higher tier?*
      → *Open question for Twilio: the A2P 10DLC paperwork is documented for US
      traffic; the Canada-specific registration rules could not be confirmed from
      their own docs. Ask before committing.*
- [ ] **iMessage / RCS** — richer alerts than SMS, but Apple has no public
      business-messaging API for this scale. Revisit only if RCS via Twilio
      becomes worth the extra branch. **IDEA.**

## Planner

- [ ] **Prerequisite tree** — the tab ships as an honest "Soon" placeholder.
      Concordia publishes prerequisites as PROSE. Codes can be extracted (already
      done in `extractCourseCodes`); the **logic between them** — and/or,
      "previously or concurrently", "or equivalent", minimum-grade conditions —
      is the hard part. A half-understood rule shown as fact is worse than showing
      the sentence, so anything we build states what it could not read.
- [ ] **Schedule builder** — build a week from real sections, flag conflicts,
      check cross-campus gaps against the shuttle timetable. Has its section data
      now that the catalogue is synced.
- [ ] **Populate the catalogue** — `course_catalog` exists but has **0 rows**;
      `/api/sync-catalog` has never run, so the directory and the unlock list
      have nothing to show. **NEXT — one command, see the note below.**
- [ ] **Minimum-grade conditions in prerequisites** — the parser handles and/or,
      antirequisites and credit floors, but not "with a minimum grade of C-".
      We store final grades, so this IS decidable; it just is not done. **IDEA.**

## Data & integrations

- [ ] **RateMyProfessors ratings** — **held off deliberately.** Their ToS
      prohibits scraping, and we take real payments under a real name, so the
      exposure is not hypothetical. Revisit only via a licensed feed or
      first-party reviews we collect ourselves.
- [ ] **Live shuttle positions** — investigated, currently **NO**.
      `shuttle.concordia.ca` is an ASP.NET page whose `GService.asmx` returns 404
      from outside. Even if reachable it is an internal service, not a published
      API. **BLOCKED on:** emailing shuttle@concordia.ca to ask — which also opens
      a university relationship ahead of the association strategy.
- [ ] **Open Data polling limits** — drafted an email to Concordia asking what
      request rate is acceptable. **BLOCKED on:** sending it.
- [ ] **Regenerate the Concordia API key** — it was shared in a chat screenshot.
      **NEXT.**
- [ ] **Catalogue re-sync on a schedule** — `/api/sync-catalog` exists and is
      CRON_SECRET-gated, but nothing calls it periodically yet. Course
      descriptions change yearly, so a monthly cron is enough.

## Monetization & growth

- [ ] **AI auto-translation as an org revenue tier** — the bilingual publishing
      schema (`translations jsonb`) was built to accept exactly this. Charge
      organizers to auto-translate their events. **IDEA.**
- [ ] **RSVP / attending counts on events** — **GROWTH-STAGE, not rejected.**
      Deliberately deferred until a typical event would show ~20+ attending, so
      low counts don't make events look dead. "Add to my calendar" already
      captures personal intent.
- [ ] **Theme gating** — light and dark free, the rest behind Pro.
- [ ] **Custom-colour theme** (Pro only).
- [ ] **Widget Pro gating + previews in the picker.**
- [ ] **Post-purchase onboarding** — what Pro just unlocked, and where it is.

## Product & polish

- [ ] **Mascot** — design and place one. **IDEA.**
- [ ] **Tickets tab inside Feedback** — asked for, not done.
- [ ] **Shuttle schedule in the Calendar** — open design question: a toggleable
      layer alongside "My calendar" and "Concordia", or a line inside the day
      detail? A layer is more discoverable; a day line is calmer.
- [ ] **French docs site** — `/docs` is English-only and the app is bilingual.
      Bill 96 applies to commercial content.
- [ ] **`data/releases.ts` is English-only** — the What's New modal doesn't
      translate, which reads oddly next to a release announcing French support.
- [ ] **Release 1.21.0 advertises a "7-day free trial"** — inaccurate now (it is
      3 days, and it never shipped as a real offer since payments were not live).
      Rewriting a historical changelog entry is a judgement call.
- [ ] **Retire `backend_infrastructure_audit.md`** — stale.
- [ ] **Code splitting** — the bundle is past Vite's 500 kB advisory. Fine for
      now; route-level `lazy()` when it starts mattering.

## Legal & compliance — **NEEDS A DECISION**

These are placeholders sitting in live legal documents right now.

- [ ] **`[AGE_MINIMUM — TBD]`** (Privacy §9, ToS §3). Recommendation: 16+, or 14+
      with parental consent, given minors' grades under Quebec law.
- [ ] **`[REFUND POLICY — NEEDS REVIEW]`** (ToS §5). The "non-refundable" wording
      was removed and nothing replaced it.
- [ ] **`[NOTICE PERIOD — TBD]`** on the auto-renewal clause (ToS §5).
- [ ] **`[VERIFY]` on Supabase / Vercel / Stripe** as named subprocessors
      (Privacy §4/§7/§8, Billing).
- [ ] **Educator Agreement is five `[PLACEHOLDER]` stubs** — no content was ever
      provided, and no clauses were invented.
- [ ] **Legal docs are English-only by design** — a French version can legally
      govern, so they need human translation, not machine translation.

---

## Open questions

- *(none open right now.)*

## Run once

```
curl -X POST https://concordiatracker.com/api/sync-catalog   -H "Authorization: Bearer $CRON_SECRET"
```

Fills `course_catalog` from Concordia (~7,900 courses, one 1.4MB fetch). Until
this runs, the course directory and the unlock list are correctly empty. Worth a
weekly cron so a new course appears without anyone remembering.

---

## Done

- **2026-08-16** — Planner tab (seat watch + course directory), meeting-times
  autofill, catalogue-backed course picker, acknowledgement-based seat alerts,
  aggregate course-tracking counts.
- **2026-08-16** — Planner "My record": year of study + minor, past courses with
  optional grades, credits / GPA / subjects, and a conservative unlock list.
- **2026-08-16** — **Prerequisites are parsed for real** (`lib/prereq.ts`): ";"
  as AND, " or " as OR, antirequisites, credit floors, and an explicit "cannot
  decide" for permission clauses and "or equivalent". 30 checks against verbatim
  calendar sentences. Replaced code-set matching, which reported "COMP 232 or
  COEN 231" as needing both.
- **2026-08-16** — `browse_courses` + `my_subjects`: the directory and seat
  picker open with relevant courses and a Load more, instead of an empty box.
- **2026-08-16** — `npm run db:verify` — migrations with real logic now run
  against a real Postgres (PGlite, WASM) before anyone else is asked to run
  them. Added after a migration shipped with `x = any ((select arr from t))`,
  which Postgres reads as the SUBQUERY form of ANY and fails on. It verifies
  LOGIC only: GRANT/REVOKE lines are stripped because Supabase's roles do not
  exist there, so **RLS and permissions still need review by eye**.
- **2026-08-16** — **Instructor per section: ANSWERED.** Concordia's Open Data
  publishes no instructor name anywhere (the schedule feed's 41 fields have
  none; `/course/faculty` is faculty-and-department structure, not people). Now
  sourced from our own outlines instead — teacher-portal publications are
  "confirmed by the instructor", student uploads are "reported by N students",
  shown as different claims.
