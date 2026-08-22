/**
 * The product's release history — the single source for the version-history view
 * and the "what's new" notification. Mock + in-memory like the rest of the seed.
 *
 * To cut a new release: add an entry at the TOP of `RELEASES` (newest first).
 * `CURRENT_VERSION` and the notification logic read from index 0 automatically.
 */

export type ReleaseChangeKind = 'new' | 'improved' | 'fixed'

export interface ReleaseChange {
  kind: ReleaseChangeKind
  text: string
}

export interface Release {
  /** Semver, e.g. "1.3.0". */
  version: string
  /** Short, human title for the release. */
  name: string
  /** Release date, `YYYY-MM-DD`. */
  date: string
  changes: ReleaseChange[]
}

/** Newest first — index 0 is the current release. */
export const RELEASES: Release[] = [
  {
    version: '1.26.0',
    name: 'Try before you buy',
    date: '2026-08-22',
    changes: [
      {
        kind: 'new',
        text: 'Tap a locked theme to wear it. It takes over the whole app for two minutes so you can see how it reads across your own due list and course banners, then hands itself back \u2014 which is a fairer way to decide than a ninety-pixel swatch.',
      },
      {
        kind: 'new',
        text: 'A renewal email at least seven days before every charge, with the amount and the date. Nobody should find out their pass renewed from their bank statement.',
      },
      {
        kind: 'improved',
        text: 'Refunds are now written down: 14 days, no reason needed, and it covers renewal charges too. Email us and it is done.',
      },
      {
        kind: 'improved',
        text: 'The Terms, Privacy Policy and Educator Agreement are finalised \u2014 no more bracketed placeholders. The minimum age is 16, and the Educator Agreement now spells out the thing instructors ask first: a teacher account can publish, and can never see a single student\u2019s grades.',
      },
      {
        kind: 'fixed',
        text: 'A Semester theme now steps back to Dark or Light when a pass lapses, matching whichever you were on. It is held rather than forgotten, so it returns on its own the moment the pass does.',
      },
    ],
  },
  {
    version: '1.25.0',
    name: 'Next term, filled in for you',
    date: '2026-08-22',
    changes: [
      {
        kind: 'new',
        text: 'Adding a class for a later term now lands you straight on Concordia’s section list, so the times, room and section fill themselves. Pick the lecture and the tutorial you registered for and the schedule is done.',
      },
      {
        kind: 'new',
        text: 'Say you are on the waitlist. A waitlisted class is marked as a maybe rather than counted as a certainty, so its credits do not quietly become part of your full-time status or your cost estimate.',
      },
      {
        kind: 'new',
        text: 'Course not in the calendar? Add it yourself. It goes in immediately as a normal class, and tells us what our copy of the calendar is missing so we can fix it for everyone.',
      },
      {
        kind: 'new',
        text: '“Something here is wrong” on every class. Almost everything in the class details came from a mirror of Concordia’s calendar, which is only as fresh as the last sync — now there is a way to say so, and someone reads it.',
      },
      {
        kind: 'fixed',
        text: 'The upcoming-term picker was still offering terms that had already ended, and asking for a Fall schedule showed you Winter. Both fixed.',
      },
      {
        kind: 'fixed',
        text: 'Demo announcements from the teacher-portal build were attaching themselves to real classes that happened to share a course code. They are gone.',
      },
    ],
  },
  {
    version: '1.24.0',
    name: 'Radar, and knowing where you stand',
    date: '2026-08-17',
    changes: [
      {
        kind: 'new',
        text: 'Radar checks your semester for you. It reads your courses, grades, outlines and the registrar’s calendar and tells you what is coming but not yet obvious — a week where too much of your grade lands at once, a drop deadline about to close, a course the marks can no longer save. Nine checks, and it shows you all of them, whether or not it found anything.',
      },
      {
        kind: 'new',
        text: 'See the shape of your term: one bar per week, as tall as the share of your grade landing in it. Switch a course off to see the rest of the term without it — including what dropping it would cost you.',
      },
      {
        kind: 'new',
        text: 'My programme: how far through your degree you are. Required courses tick off exactly against your record; elective rules are shown in the calendar’s own words rather than guessed at. Computer Science and Commerce to start.',
      },
      {
        kind: 'new',
        text: 'Money (Pro): what the term costs at Concordia’s published rates, worked out from the credits you are actually registered for — and what each course is worth if you are deciding whether to keep it, next to the refund deadline.',
      },
      {
        kind: 'new',
        text: 'Add next term’s classes from the calendar itself, so the code, title and credits are right from the start.',
      },
      {
        kind: 'improved',
        text: 'A class for a term that has not started now waits quietly instead of asking for assignments. Outlines are published in the first week — last term’s dates would be wrong in a way you would plan around.',
      },
      {
        kind: 'improved',
        text: 'Every section of the Planner now has its own link, so the back button works and you can send someone straight to the right place.',
      },
      {
        kind: 'fixed',
        text: 'The prerequisite board no longer stacks courses on top of each other, and you can read the cards.',
      },
    ],
  },
  {
    version: '1.23.0',
    name: 'The Planner',
    date: '2026-08-16',
    changes: [
      {
        kind: 'new',
        text: 'Planner is a new tab. Next term lives here — your record, the course directory, what a class unlocks, and a schedule you can build — so the term you are running stays on Today, Courses and Calendar.',
      },
      {
        kind: 'new',
        text: 'My record: add the courses you have already taken, with or without grades. It works out your credits and GPA, and from then on every course in the app knows whether you can take it.',
      },
      {
        kind: 'new',
        text: 'Paste your transcript instead of typing it. Everything it reads lands in a table next to the line it came from, and nothing is saved until you have checked it.',
      },
      {
        kind: 'new',
        text: 'Schedule builder: search Concordia for real sections, drop them on a week, and see clashes and back-to-back classes on opposite campuses before you register. Save as many versions as you like, print one, or share a read-only link.',
      },
      {
        kind: 'new',
        text: 'Drag on the week to block out hours you work, commute or sleep. Sections that clash get marked in the search rather than hidden, so it is still your call.',
      },
      {
        kind: 'new',
        text: 'Prerequisite tree: pick a course and see what it needs, all the way down, with what you have already done marked off. Or start from a course you have passed and see what it opens up.',
      },
      {
        kind: 'new',
        text: 'Course directory: all 7,884 courses Concordia publishes, with descriptions, credits and the prerequisite text as the calendar words it.',
      },
      {
        kind: 'new',
        text: 'Saved courses: keep a shortlist for a future term, add notes, and compare a few side by side.',
      },
      {
        kind: 'new',
        text: 'Seat watch tells you the moment a section opens, and now keeps telling you until you have seen it, with the class number ready to copy into the Student Centre.',
      },
      {
        kind: 'improved',
        text: 'Past terms are editable, future ones too — enter your fall classes in the summer. FNS and the other notations are supported, and repeated courses follow Concordia’s rule.',
      },
      {
        kind: 'improved',
        text: 'Adding a course searches every course in the calendar, not only ones somebody has already uploaded an outline for.',
      },
    ],
  },
  {
    version: '1.22.0',
    name: 'Payments live, and français',
    date: '2026-08-14',
    changes: [
      { kind: 'new', text: 'ConcordiaTracker now speaks French. Pick your language during setup or any time in Settings → General: the whole app follows, dates included ("Dû demain", "2 jours de retard"), and so does the public site.' },
      { kind: 'new', text: 'Checkout is live. The Semester pass ($15 CAD) and monthly ($5 CAD) are real payments now, taken inside the app.' },
      { kind: 'new', text: 'Every plan opens with a 3-day free trial. A card is required up front, nothing is charged until the trial ends, and cancelling before then costs you nothing.' },
      { kind: 'fixed', text: 'The pricing page no longer describes checkout as a mock: it now reflects whether payments are actually live, on its own.' },
    ],
  },
  {
    version: '1.21.0',
    name: 'Go Pro',
    date: '2026-07-27',
    changes: [
      { kind: 'new', text: 'Subscriptions are live: the Semester pass ($15) or monthly ($5), paid right inside Settings → Billing without leaving the app.' },
      { kind: 'new', text: 'Every plan starts with a 7-day free trial. Cancel before it ends and you’re never charged.' },
      { kind: 'new', text: 'Upgrading never wastes what you’ve paid for: switch from monthly to the Semester pass and your remaining days carry straight over.' },
      { kind: 'new', text: 'Invoices live in Billing with PDF receipts, and you can cancel or resume in one click: access always runs to the end of the period you paid for.' },
      { kind: 'improved', text: 'Prices are shown in Canadian dollars for everyone, so what you see is exactly what you’re charged.' },
    ],
  },
  {
    version: '1.20.0',
    name: 'Know your term',
    date: '2026-07-26',
    changes: [
      { kind: 'new', text: 'A Daily Debrief on Today reads your situation back to you: what’s landing next, and how much of your grade is due this week.' },
      { kind: 'new', text: 'Tell it what you want to prioritise: catching up, protecting your GPA, getting ahead, or one specific class: and the briefing rewrites itself around that.' },
      { kind: 'new', text: '“Your term, week by week” charts your workload by weight, so you can see the crunch weeks coming.' },
      { kind: 'new', text: 'A study planner ranks what to work on by weight, urgency, and how much each class can still move: with the reasoning shown, never a black box.' },
      { kind: 'new', text: 'Past semesters: keep finished terms, see your transcript, and track a cumulative GPA across your degree.' },
      { kind: 'improved', text: 'The sidebar now badges overdue work and classmate date changes waiting on you.' },
    ],
  },
  {
    version: '1.19.0',
    name: 'A smoother start',
    date: '2026-07-22',
    changes: [
      { kind: 'improved', text: 'Onboarding is shorter and clearer: the confusing hands-on steps are gone, replaced by one calm overview.' },
      { kind: 'new', text: 'Finished setting up? You’ll be offered the guided tour, and the Getting-started checklist stays in the corner if you’d rather explore alone.' },
      { kind: 'new', text: 'Feedback moved into the app: request features, report bugs, and vote without losing your sidebar.' },
      { kind: 'new', text: 'After a few days with the app you can take a short survey and get 3 days of Pro, free.' },
      { kind: 'improved', text: 'Teachers get a proper sidebar, with each class split into Assignments, Course outline, Announcements, and Student blueprints.' },
      { kind: 'fixed', text: 'Onboarding no longer faded its own content out on the background grid.' },
      { kind: 'fixed', text: 'Org logos no longer show a coloured halo behind transparent images.' },
      { kind: 'fixed', text: 'Club bios keep their line breaks instead of collapsing to one line.' },
    ],
  },
  {
    version: '1.18.0',
    name: 'Take the tour',
    date: '2026-07-01',
    changes: [
      { kind: 'new', text: 'A guided walkthrough of every tab: launch it anytime from your profile menu → Take a tour.' },
      { kind: 'new', text: 'It runs on a temporary demo course, so the tour never touches your real classes.' },
      { kind: 'improved', text: 'Each step highlights the real feature, scrolls it into view, and explains it in a clear side panel (a bottom sheet on mobile).' },
    ],
  },
  {
    version: '1.17.0',
    name: 'Clearer and calmer',
    date: '2026-06-29',
    changes: [
      { kind: 'improved', text: 'Grade fields are simpler: just type a percent, or a score like 15/20.' },
      { kind: 'improved', text: 'Assignment rows are more compact and consistent, with a ⋯ menu to edit or delete.' },
      { kind: 'new', text: 'A “Getting started” checklist tracks your first steps and fades away once you’re set up.' },
      { kind: 'new', text: 'Gentle one-time tips point out the key spots the first time you visit.' },
    ],
  },
  {
    version: '1.16.0',
    name: 'Never miss a deadline',
    date: '2026-06-27',
    changes: [
      { kind: 'new', text: 'Get a push notification before a deadline: choose 1 hour, 1 day, or 1 week ahead.' },
      { kind: 'new', text: 'Turn on notifications in Settings and send yourself a test to check it works.' },
      { kind: 'new', text: '“Remind me” on any campus event, so you don’t forget the ones you’re into.' },
    ],
  },
  {
    version: '1.15.0',
    name: 'Install it like an app',
    date: '2026-06-24',
    changes: [
      { kind: 'new', text: 'Install ConcordiaTracker on your phone or desktop: add it to your home screen and open it like a native app.' },
      { kind: 'new', text: 'It launches full-screen, with proper notch and safe-area handling on iPhone.' },
      { kind: 'fixed', text: 'Your theme now stays put between visits.' },
      { kind: 'fixed', text: 'No more empty gap beneath the bottom navigation on installed iPhones.' },
    ],
  },
  {
    version: '1.14.0',
    name: 'Public profiles',
    date: '2026-06-20',
    changes: [
      { kind: 'new', text: 'Public profiles at concordiatracker.com/@yourhandle: your name, program, courses, and uploaded blueprints.' },
      { kind: 'new', text: 'Choose public or private when you pick your handle; a private profile shows only your handle.' },
      { kind: 'new', text: 'Add a bio and flip your profile public/private any time in Settings → Privacy.' },
    ],
  },
  {
    version: '1.13.0',
    name: 'Pick your program',
    date: '2026-06-20',
    changes: [
      { kind: 'new', text: 'Choose your program from a searchable list of Concordia programs: just start typing.' },
      { kind: 'new', text: 'Can’t find yours? Choose “Other” and tell us: we’ll add it.' },
      { kind: 'improved', text: 'Programs are now stored as consistent data, so program-based features work reliably.' },
    ],
  },
  {
    version: '1.12.0',
    name: 'Hands-on welcome',
    date: '2026-06-20',
    changes: [
      { kind: 'new', text: 'The welcome tour is now interactive: check off a task, toggle calendar layers, and mark an assignment yourself.' },
      { kind: 'new', text: 'Change your @handle from Settings → Account (once every 14 days).' },
      { kind: 'improved', text: 'The Today preview in onboarding is clearer: no longer zoomed in.' },
      { kind: 'fixed', text: 'Replaying onboarding no longer re-asks for your name, handle, or major.' },
    ],
  },
  {
    version: '1.11.0',
    name: 'A smoother welcome',
    date: '2026-06-19',
    changes: [
      { kind: 'new', text: 'Pick your theme right in onboarding: the whole app reskins as you choose.' },
      { kind: 'new', text: 'Add several courses during setup, not just one.' },
      { kind: 'new', text: 'Import now shows the section you’re adding, and lets you choose it.' },
      { kind: 'new', text: 'New welcome tour pages explaining the calendar and how editing & marking work.' },
      { kind: 'fixed', text: 'Course import no longer lists outlines from older semesters.' },
    ],
  },
  {
    version: '1.10.0',
    name: 'Two new looks',
    date: '2026-06-19',
    changes: [
      { kind: 'new', text: 'A clean Light theme: calm and premium, with the signature sage accent.' },
      { kind: 'new', text: 'A Purple Dark theme: deep navy surfaces with a vivid purple accent.' },
      { kind: 'improved', text: 'The theme switcher and ⌘K “Switch theme” now cycle through all four themes.' },
    ],
  },
  {
    version: '1.9.0',
    name: 'Little touches',
    date: '2026-06-19',
    changes: [
      { kind: 'new', text: 'Pick your own keyboard shortcut for the search & command palette, in Settings → General.' },
      { kind: 'improved', text: 'A redesigned “What’s new”: a proper changelog timeline (you’re reading it).' },
      { kind: 'improved', text: 'Date-confidence badges now use distinct icons, not just colored dots, so they’re clearer at a glance.' },
    ],
  },
  {
    version: '1.8.0',
    name: 'Smoother & more reliable',
    date: '2026-06-19',
    changes: [
      { kind: 'improved', text: 'A cleaner, more trustworthy Google sign-in: it now shows our own concordiatracker.com address.' },
      { kind: 'fixed', text: 'Your @handle is now guaranteed unique, with a live availability check as you pick one.' },
      { kind: 'fixed', text: 'The setup preview now greets you by your own name.' },
    ],
  },
  {
    version: '1.7.0',
    name: 'Make it yours',
    date: '2026-06-18',
    changes: [
      { kind: 'new', text: 'Add a course your way: find a blueprint, upload a syllabus, or create one by hand.' },
      { kind: 'new', text: 'Build a course from scratch: edit the class details and add assessments inline.' },
      { kind: 'improved', text: 'Dates you enter yourself are clearly marked unverified, so provenance stays honest.' },
    ],
  },
  {
    version: '1.6.0',
    name: 'Share & connect',
    date: '2026-06-18',
    changes: [
      { kind: 'new', text: 'Share any event with a direct link: anyone can open it, no account needed.' },
      { kind: 'new', text: 'Org profiles now link out to Instagram, X, LinkedIn, and a custom site.' },
      { kind: 'improved', text: 'A custom colour picker and image-upload tips when you set up a profile.' },
      { kind: 'improved', text: 'Outbound links tell you before they open an external site in a new tab.' },
    ],
  },
  {
    version: '1.5.0',
    name: 'For organizers',
    date: '2026-06-18',
    changes: [
      { kind: 'new', text: 'An Organizer portal for clubs and student orgs to post and manage their events.' },
      { kind: 'new', text: 'Invite teammates to help run your org’s dashboard.' },
      { kind: 'new', text: 'See your reach: followers, calendar adds, and views (aggregate only, never per-student).' },
    ],
  },
  {
    version: '1.4.0',
    name: 'Teachers & community',
    date: '2026-06-18',
    changes: [
      { kind: 'new', text: 'A Community tab: campus events from clubs, faculties, and student orgs.' },
      { kind: 'new', text: 'Follow an org and get a heads-up when it posts something new.' },
      { kind: 'new', text: 'Teacher portal: professors publish their outline as a verified blueprint.' },
      { kind: 'new', text: 'Blueprint browser: import a classmate’s or teacher’s syllabus in a tap.' },
      { kind: 'new', text: 'Peer date-corrections: when classmates move a date, you decide whether to follow.' },
    ],
  },
  {
    version: '1.3.0',
    name: 'Calendar, in context',
    date: '2026-06-17',
    changes: [
      { kind: 'new', text: 'Calendar with Month, Week, and Agenda views.' },
      { kind: 'new', text: 'Concordia academic dates and your deadlines as toggleable layers.' },
      { kind: 'new', text: 'Add personal tasks and notes to any day.' },
      { kind: 'improved', text: 'Upgrade prompts collapse to a slim bar on mobile.' },
      { kind: 'improved', text: 'Today reads calmer: less per-row clutter.' },
      { kind: 'fixed', text: 'The sidebar no longer scrolls away from the profile block.' },
    ],
  },
  {
    version: '1.2.0',
    name: 'Settings & polish',
    date: '2026-06-15',
    changes: [
      { kind: 'new', text: 'A floating Settings panel: profile, billing, usage, and privacy.' },
      { kind: 'new', text: 'Custom date & time picker and dropdowns that never clip.' },
      { kind: 'new', text: '“How is this calculated?” shows the math behind every grade.' },
      { kind: 'improved', text: 'Scrollbars now follow the active theme.' },
      { kind: 'fixed', text: 'The settings toggle knob stays inside its track.' },
    ],
  },
  {
    version: '1.1.0',
    name: 'Courses, reimagined',
    date: '2026-06-15',
    changes: [
      { kind: 'new', text: 'Google-Classroom-style course cards with per-class colors.' },
      { kind: 'new', text: 'Command palette: edit a grade or open a class from anywhere.' },
      { kind: 'improved', text: 'Smart grade field: type 15/20 and it reads 75%.' },
      { kind: 'improved', text: 'A roomier course detail panel for instructor and logistics.' },
    ],
  },
  {
    version: '1.0.0',
    name: 'Hello, ConcordiaTracker',
    date: '2026-06-14',
    changes: [
      { kind: 'new', text: 'Today and Courses, with editable mock grades.' },
      { kind: 'new', text: 'A working grade-needed calculator and GPA what-if.' },
      { kind: 'new', text: 'The syllabus parse-reveal and two themes (dark + Concordia maroon).' },
    ],
  },
  {
    version: '0.0.0',
    name: 'A fresh start',
    date: '2026-06-13',
    changes: [
      { kind: 'improved', text: 'A complete rebuild: the entire interface was remade from scratch, replacing the old site.' },
      { kind: 'new', text: 'A brand-new design system, navigation, and foundation built to grow into a real product.' },
      { kind: 'fixed', text: 'The old version was an early testing phase: its accounts and data were wiped, so everyone begins fresh here.' },
    ],
  },
]

/** The current (latest) version. */
export const CURRENT_VERSION = RELEASES[0].version

/** Semver compare: negative if a < b, 0 if equal, positive if a > b. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff < 0 ? -1 : 1
  }
  return 0
}
