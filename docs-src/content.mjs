/**
 * Docs content. Plain data — the renderer turns it into static HTML.
 *
 * SCOPE: this documents the PRODUCT — what the features are, how they work, how
 * billing works. It deliberately contains nothing that expires: no term dates,
 * no deadlines, no academic calendar. Those live in the app, where they're
 * generated from data; a doc page repeating them would eventually be confidently
 * wrong, which is worse than saying nothing.
 *
 * Adding a page: add it to PAGES, then list its slug in NAV. Order in NAV drives
 * the sidebar, the prev/next pager, and the sitemap.
 */

export const NAV = [
  {
    title: 'Getting started',
    pages: ['introduction', 'quick-start', 'faq', 'contact'],
  },
  {
    title: 'Your courses',
    pages: ['adding-courses', 'blueprints', 'syllabus-import', 'provenance'],
  },
  {
    title: 'Grades',
    pages: ['entering-grades', 'grade-calculators'],
  },
  {
    title: 'Planning your term',
    pages: ['today', 'calendar', 'notifications'],
  },
  {
    title: 'Community',
    pages: ['community'],
  },
  {
    title: 'Account & billing',
    pages: ['plans', 'billing', 'settings', 'privacy'],
  },
  {
    title: 'Portals',
    pages: ['teacher-portal', 'organizer-portal'],
  },
]

export const PAGES = {
  /* ── Getting started ───────────────────────────────────────────────────── */

  introduction: {
    title: 'Introduction',
    section: 'Getting started',
    description:
      'ConcordiaTracker is a web app for Concordia students that turns your course outlines into one dashboard of deadlines, grades, and GPA. Here is what it does and how it works.',
    blocks: [
      { h2: 'What is ConcordiaTracker?' },
      {
        p: 'ConcordiaTracker is a web app that puts every deadline, grade, and GPA calculation for all of your Concordia courses in one place. You add your courses once, and the app tracks what is due, what each item is worth, and where your grade actually stands.',
      },
      {
        p: 'It runs in the browser and installs as an app on phones and desktops. There is nothing to download and no extension. You sign in with Google or an email address, and your data syncs across your devices.',
      },
      {
        p: 'ConcordiaTracker is an independent project. It is **not affiliated with Concordia University**, and it does not connect to Moodle, eConcordia, or your student record.',
      },

      { h2: 'How it works' },
      {
        p: 'A course outline lists what is due, when, and how much it is worth. ConcordiaTracker gets that information into your account in one of three ways: importing a shared outline another student or professor already uploaded, reading a syllabus PDF for you, or letting you type it in.',
      },
      {
        p: 'From there everything else follows automatically. Deadlines appear on Today and the calendar, and as you enter grades the app computes your standing in each course and your GPA on Concordia’s 4.30 scale.',
      },

      { h2: 'Start here' },
      {
        cards: [
          {
            icon: 'check',
            title: 'Quick start',
            desc: 'Sign in, add your first course, and see your term in about two minutes.',
            href: '/docs/quick-start',
          },
          {
            icon: 'book',
            title: 'Adding courses',
            desc: 'The three ways to get a course into your account, and when to use each.',
            href: '/docs/adding-courses',
          },
          {
            icon: 'calculator',
            title: 'Grade calculators',
            desc: 'What you need on what is left, and where your GPA lands.',
            href: '/docs/grade-calculators',
          },
          {
            icon: 'card',
            title: 'Plans and billing',
            desc: 'What is free, what the Semester pass adds, and how the trial works.',
            href: '/docs/plans',
          },
        ],
      },
    ],
  },

  'quick-start': {
    title: 'Quick start',
    section: 'Getting started',
    description:
      'Sign in, add your first Concordia course, and get your deadlines and GPA tracking in a couple of minutes.',
    blocks: [
      {
        p: 'From a cold start to a working term dashboard is about two minutes. You need your course codes, and ideally your section letters.',
      },

      { h2: '1. Sign in' },
      {
        p: 'Go to [concordiatracker.com](/) and choose **Open app**. You can sign in with Google or create an account with an email and password. There is no charge to create an account and no card required.',
      },

      { h2: '2. Set up your profile' },
      {
        p: 'Onboarding asks for a display name, a handle, and your program. The program is used to mark campus events as relevant to you — nothing else. You also pick a theme and a language here, and both are changeable later in Settings.',
      },
      {
        note: 'Your profile is **private by default**. Other students cannot find you in search until you turn on the public profile switch in Settings → Privacy.',
      },

      { h2: '3. Add your courses' },
      {
        p: 'Search for your course code. If another student or the professor has already shared an outline for your section, importing it fills in every deadline and weight instantly. If not, upload the syllabus PDF and the app reads it, or enter the items by hand.',
      },
      { p: 'Repeat for each class. Most students finish a full course load in a few minutes.' },

      { h2: '4. Use it' },
      {
        p: 'Today shows what is due and what is next. As grades come back, enter them on the course page and your standing and GPA update immediately.',
      },
      {
        cards: [
          {
            icon: 'book',
            title: 'Adding courses',
            desc: 'The three import methods in detail.',
            href: '/docs/adding-courses',
          },
          {
            icon: 'layout',
            title: 'The Today view',
            desc: 'What each part of your launch screen does.',
            href: '/docs/today',
          },
        ],
      },
    ],
  },

  faq: {
    title: 'FAQ',
    section: 'Getting started',
    description:
      'Common questions about ConcordiaTracker — whether it connects to Moodle, how the GPA scale works, what is free, and who can see your data.',
    blocks: [
      { h2: 'Is it affiliated with Concordia University?' },
      {
        p: 'No. ConcordiaTracker is an independent project built for Concordia students. It has no connection to the university, and the university does not endorse or supply it.',
      },

      { h2: 'Does it connect to Moodle or eConcordia?' },
      {
        p: 'No. There is no integration with Moodle, eConcordia, or your student record, and the app never asks for those credentials. Course information gets in through a shared outline, a syllabus you upload, or manual entry.',
      },

      { h2: 'Which GPA scale does it use?' },
      {
        p: 'Concordia’s 4.30 scale. Course percentages are converted to letter grades and grade points, then weighted by credits to produce your GPA. See [Grade calculators](/docs/grade-calculators) for the arithmetic, which the app also shows you in full inside each course.',
      },

      { h2: 'Is it free?' },
      {
        p: 'The core is free: unlimited courses, deadline tracking, grade entry, the calendar, and the grade-needed calculator. GPA projection and unlimited blueprint imports are part of the Semester pass. See [Plans](/docs/plans).',
      },

      { h2: 'Do I need to install anything?' },
      {
        p: 'No. It runs in any modern browser. You can optionally install it as an app on your phone or desktop for a full-screen experience and notifications — your browser will offer this, or you can use **Add to Home Screen** on iOS.',
      },

      { h2: 'Can other students see my grades?' },
      {
        p: 'No. Grades are private to your account and are never shared, shown to other students, or published anywhere. What can be shared is a course **outline** — the list of assessments, dates, and weights — and only if you choose to contribute one. See [Privacy](/docs/privacy).',
      },

      { h2: 'What happens to my data if I stop paying?' },
      {
        p: 'Nothing is deleted. Your courses, deadlines, and grades stay exactly as they are; the paid features simply lock again. You keep full access to everything in the free tier.',
      },

      { h2: 'Is it available in French?' },
      {
        p: 'Yes. Choose your language during setup or at any time in Settings → General. The whole interface follows, including dates and the public site.',
      },
    ],
  },

  contact: {
    title: 'Contact',
    section: 'Getting started',
    description:
      'How to reach ConcordiaTracker for support, bug reports, and feature requests, and what to include so you get a faster answer.',
    blocks: [
      { p: 'Stuck, found a bug, or have an idea? Every message gets read and answered.' },

      { h2: 'From inside the app' },
      {
        p: 'The fastest route is the feedback form: **profile menu → Feedback**. It attaches your account so there is nothing to look up, and you can follow the status of what you sent.',
      },

      { h2: 'Email' },
      {
        p: 'Write to [concordiatracker@gmail.com](mailto:concordiatracker@gmail.com). If your question is about billing, send it from the email address on the account.',
      },

      { h2: 'What to include' },
      {
        p: 'A faster answer usually comes from a message that covers:',
      },
      {
        ul: [
          'What you were trying to do, and what happened instead',
          'The course or page it happened on',
          'Your browser and whether you are on a phone or a computer',
          'A screenshot of any error message',
        ],
      },

      { h2: 'Before you write' },
      {
        p: 'The [FAQ](/docs/faq) covers the most common questions. If a deadline looks wrong, check its provenance badge first — an unverified date came from a single student and may simply need correcting, which you can do yourself in seconds. See [Provenance](/docs/provenance).',
      },
    ],
  },

  /* ── Your courses ──────────────────────────────────────────────────────── */

  'adding-courses': {
    title: 'Adding courses',
    section: 'Your courses',
    description:
      'Three ways to add a Concordia course to ConcordiaTracker — import a shared blueprint, upload a syllabus PDF, or enter it manually.',
    blocks: [
      {
        p: 'Every course needs the same information: what is due, when, and what each item is worth. There are three ways to get it in, and they differ only in how much typing you do.',
      },

      { h2: 'Import a blueprint (fastest)' },
      {
        p: 'A **blueprint** is a course outline someone has already shared — another student in your section, or the professor. Importing one fills in every assessment, date, and weight at once. This is the fastest method and gets faster as more outlines are shared.',
      },
      {
        p: 'From Courses, choose **Add a course → Find a blueprint**, search your course code, then pick your section. Read more in [Blueprints](/docs/blueprints).',
      },

      { h2: 'Upload a syllabus' },
      {
        p: 'If nobody has shared your section yet, upload the syllabus PDF. The app reads it and extracts the assessments, dates, and weights, then shows you the result before anything is saved. See [Syllabus import](/docs/syllabus-import).',
      },

      { h2: 'Create it manually' },
      {
        p: 'You can also start from a blank course and type in the details. Choose **Add a course → Create manually**, then fill in the code, name, and each assessment with its kind, due date, and weight. A running total tells you whether the weights add up to 100%.',
      },
      {
        note: 'Manually entered dates are marked **unverified**, because they came from one person with nothing to cross-check against. That is a statement about corroboration, not about you being wrong.',
      },

      { h2: 'Course details' },
      {
        p: 'Whichever method you use, each course has an editable details panel: instructor, TA, section, meeting times, office hours, location, credits, and a link to the syllabus. Credits matter — they are what weights each course in your GPA.',
      },

      { h2: 'Past terms' },
      {
        p: 'Courses from finished terms move to the **Past semesters** tab in Courses, where they form a running transcript and a cumulative GPA alongside your current term.',
      },
    ],
  },

  blueprints: {
    title: 'Blueprints',
    section: 'Your courses',
    description:
      'Blueprints are shared Concordia course outlines — teacher-verified or community-uploaded — that fill in every deadline and weight in one import.',
    blocks: [
      {
        p: 'A blueprint is a course outline that someone has already entered and shared: the full list of assessments with their dates and weights. Importing one means you never type a syllabus in twice, and neither does anyone else in your section.',
      },

      { h2: 'Teacher-verified vs community' },
      {
        p: 'Blueprints come from two places, and the difference matters:',
      },
      {
        ul: [
          '**Teacher-verified** — published by the professor through the teacher portal. These are pinned to the top of the list and their dates import as **official**.',
          '**Community** — uploaded by a student. These are ranked by votes from other students in the section, and their dates import as **unverified**, because a single upload has nothing corroborating it yet.',
        ],
      },
      {
        p: 'A professor can also review a community blueprint and adopt it. When that happens it becomes their published outline, and the dates become official.',
      },

      { h2: 'Sections matter' },
      {
        p: 'Dates differ between sections of the same course, so blueprints are grouped by section. The browser defaults to the section on your profile and marks it as yours. If you open a different section, a banner warns you that the dates may not apply to you, and every row is tagged accordingly.',
      },

      { h2: 'Judging a blueprint' },
      {
        p: 'Each entry shows who uploaded it, when, how many items it contains, how many students have imported it, and its net votes. Expanding **Preview outline** shows exactly what will be added — every assessment with its kind, date, and weight, plus whether the weights total 100%.',
      },
      {
        note: 'Blueprints from past terms are collapsed separately and hidden by default. An outline from a previous year is often close but rarely exact.',
      },

      { h2: 'Contributing' },
      {
        p: 'Once you have a course set up, you can share your outline back so the next student in your section does not have to. Contributing earns theme credits. Only the outline is shared — never your grades, and never your name unless you choose a public handle.',
      },

      { h2: 'Limits' },
      {
        p: 'The free plan includes one blueprint import. The Semester pass includes unlimited imports. Uploading a syllabus and manual entry are unrestricted on both plans.',
      },
    ],
  },

  'syllabus-import': {
    title: 'Syllabus import',
    section: 'Your courses',
    description:
      'Upload a syllabus PDF and ConcordiaTracker extracts every assessment, date, and weight automatically, showing you the result before it saves.',
    blocks: [
      {
        p: 'If nobody has shared a blueprint for your section, upload the syllabus itself. The app reads the document and pulls out the graded items so you do not have to transcribe them.',
      },

      { h2: 'How to use it' },
      {
        ol: [
          'From Courses, choose **Add a course → Upload a syllabus**.',
          'Drop in the PDF. Most Concordia syllabi are a direct download from Moodle or the department site.',
          'Watch the extraction — the assessments appear as they are found.',
          'Review the result, then confirm to add them to the course.',
        ],
      },

      { h2: 'What it extracts' },
      {
        p: 'The assessment name, its kind (assignment, quiz, midterm, final, lab, reading, or project), its due date, and its weight as a percentage of the final grade.',
      },
      {
        p: 'It works best on a syllabus with a grade-composition table, which is the standard format for most Concordia courses. A syllabus that describes weighting only in prose will produce a thinner result.',
      },

      { h2: 'Always check the result' },
      {
        note: 'Extraction is automated and it is not perfect. Check the dates and weights before you rely on them — particularly that the weights total 100%. Anything that looks wrong can be edited directly.',
      },
      {
        p: 'Imported dates are marked **unverified** until other students in your section confirm them. See [Provenance](/docs/provenance).',
      },

      { h2: 'Limits' },
      {
        p: 'Syllabus uploads are rate-limited on the free plan, with the allowance resetting monthly; your current usage is shown in Settings → Usage. The Semester pass raises the limit. This is a cost control on the processing, not a paywall on the feature — the free allowance covers a normal course load.',
      },
    ],
  },

  provenance: {
    title: 'Provenance',
    section: 'Your courses',
    description:
      'Every date in ConcordiaTracker carries a provenance badge showing whether it is official, confirmed by classmates, or unverified.',
    blocks: [
      {
        p: 'A deadline is only as good as its source. Rather than presenting every date with equal confidence, ConcordiaTracker labels where each one came from.',
      },

      { h2: 'The three levels' },
      {
        table: {
          head: ['Badge', 'Meaning'],
          rows: [
            ['**Official**', 'From the course syllabus or published by the professor.'],
            [
              '**Confirmed · N**',
              'Entered by a student and corroborated by N classmates in the same section.',
            ],
            ['**Unverified**', 'Entered once, by one person, with nothing to cross-check against.'],
          ],
        },
      },
      {
        p: 'Unverified is not an accusation. It is the honest state of a date that one person typed in — including one you typed in yourself.',
      },

      { h2: 'Where badges appear' },
      {
        p: 'On course pages, in the calendar, and in the assessment editor. Today hides them by default to keep the list calm, showing only a quiet marker on unverified dates; you can turn full badges on in **Customize Today**.',
      },

      { h2: 'Peer date corrections' },
      {
        p: 'When classmates in your section move a date that you also have — a midterm pushed back a week, say — the app surfaces it as a suggestion showing the raw numbers: how many students changed it, out of how many in the section, and what they changed it to.',
      },
      {
        note: 'Nothing changes automatically. You see **“5 of 6 classmates moved this”** and decide. A single voice reads as weak on purpose; a clear majority reads as strong. The app never invents a consensus it does not have.',
      },
      {
        p: 'Accepting a correction updates your date and marks it confirmed. Dismissing it leaves your assessment untouched.',
      },
    ],
  },

  /* ── Grades ────────────────────────────────────────────────────────────── */

  'entering-grades': {
    title: 'Entering grades',
    section: 'Grades',
    description:
      'How to record grades and assessment status in ConcordiaTracker, including percentage or raw-score entry.',
    blocks: [
      {
        p: 'Grades go in on the course page, in the assessment table. Everything downstream — your course standing, the calculators, your GPA — is computed from what you enter here.',
      },

      { h2: 'Two ways to type a grade' },
      {
        p: 'The grade field accepts either form and works out which you meant:',
      },
      {
        ul: [
          'A **percentage** — type `85` for 85%.',
          'A **raw score** — type `17/20` and it resolves to 85% as you type.',
        ],
      },
      {
        p: 'Use whichever your professor handed back. There is no mode to switch.',
      },

      { h2: 'Assessment status' },
      {
        p: 'Separately from the grade, each item carries a status describing where it stands:',
      },
      {
        table: {
          head: ['Status', 'Means'],
          rows: [
            ['Not started', 'No work done yet. Appears on Today.'],
            ['In progress', 'Started. Still appears on Today.'],
            ['Extension', 'You have more time. Still appears on Today.'],
            ['Awaiting grade', 'Handed in, waiting on a mark.'],
            ['Done', 'Finished on time.'],
            ['Done late', 'Finished after the deadline.'],
            ['Missed', 'Not submitted.'],
          ],
        },
      },
      {
        note: 'Status is set by you and never guessed from the date. An item you finished on time still reads **Done** even if you record it weeks later — the app will not quietly mark your work late.',
      },

      { h2: 'Saving' },
      {
        p: 'Edits stage as you type and commit when you save, so a mistyped grade never lands in your GPA mid-keystroke. Every save can be undone from the toast that follows it.',
      },

      { h2: 'How your course grade is computed' },
      {
        p: 'Assessments are grouped by kind, each group averaged, and the groups combined in proportion to their weights. The current grade divides by the weight graded **so far**, so it reflects where you stand today rather than assuming zeros for work not yet returned.',
      },
      {
        p: 'Every course page has a **How is this calculated?** disclosure that shows the formula with your own numbers filled in. It is generated from the same code that computes the grade, so the shown arithmetic cannot drift from the result.',
      },
    ],
  },

  'grade-calculators': {
    title: 'Grade calculators',
    section: 'Grades',
    description:
      'The grade-needed calculator (free) tells you what you need on remaining work; the GPA what-if projects where your term lands.',
    blocks: [
      {
        p: 'Two calculators, both doing real arithmetic on your actual grades and weights. Neither estimates or guesses.',
      },

      { h2: 'Grade needed — free' },
      {
        p: 'Pick a target letter grade and the calculator solves for the average you need across everything still ungraded.',
      },
      {
        p: 'It answers honestly in every case. If the target is already locked in no matter what, it says so. If it has become unreachable even with a perfect score, it says that too, rather than showing an impossible number.',
      },
      {
        note: 'This is free and stays free. Knowing what you need to pass is the question students most need answered, and it should not sit behind a payment.',
      },

      { h2: 'GPA what-if — Semester pass' },
      {
        p: 'The projection tool takes the opposite direction: assume a score on everything still outstanding, and see where the course and your term GPA land.',
      },
      {
        p: 'Move the slider and both update live — the projected course percentage with its letter grade, and your projected term GPA with the change from where you are now. It is how you find out which deadline actually moves your average, which is rarely the one that feels most urgent.',
      },

      { h2: 'The GPA scale' },
      {
        p: 'Concordia’s 4.30 scale. Each course percentage becomes a letter and its grade points; courses are weighted by credits; the weighted average is your GPA. Finished terms produce a cumulative GPA alongside the current one.',
      },
    ],
  },

  /* ── Planning ──────────────────────────────────────────────────────────── */

  today: {
    title: 'Today',
    section: 'Planning your term',
    description:
      'Today is the ConcordiaTracker launch screen — what is due, what is next, and where your GPA stands.',
    blocks: [
      {
        p: 'Today is what opens when you sign in. It answers one question: what needs attention now.',
      },

      { h2: 'The due list' },
      {
        p: 'The centre of the screen, grouped into Overdue, This week, and Coming up. Each row shows the title, the course, the kind of assessment, and when it is due — with overdue and same-day items coloured, and everything else deliberately calm.',
      },
      { p: 'Tapping the circle on a row marks it done. It moves to a **Completed today** section with an undo, so a mis-tap costs nothing.' },

      { h2: 'Row actions' },
      {
        p: 'The menu on each row opens the full editor for that item — due date and time, status, grade, and notes — or jumps to it inside its course, or deletes it. Deleting is undoable from the toast that follows.',
      },

      { h2: 'At a glance' },
      {
        p: 'The side panel holds the numbers: how far into the term you are, how much of today is done, your term GPA, what is overdue, what is due this week, what is next, and how many courses and credits you are carrying.',
      },

      { h2: 'Customize Today' },
      {
        p: 'The **Customize** control tunes the list to how you read:',
      },
      {
        ul: [
          'Show or hide the weight percentage on each row',
          'Show full provenance badges, which are hidden by default',
          'Comfortable or compact row density',
          'Group by time, or group by course',
        ],
      },

      { h2: 'Announcements' },
      {
        p: 'Below the due list, announcements posted by professors through the teacher portal appear for the courses you are enrolled in, with the date they were posted and whether they have been edited since.',
      },
    ],
  },

  calendar: {
    title: 'Calendar',
    section: 'Planning your term',
    description:
      'Month, week, and agenda views combining your assignment deadlines, personal tasks, and the official Concordia academic calendar as toggleable layers.',
    blocks: [
      {
        p: 'The calendar shows your deadlines next to the university’s own dates, so you can see a midterm landing in the same week as a withdrawal deadline.',
      },

      { h2: 'Two layers' },
      {
        p: 'Content comes from two independent layers, each toggleable in the side panel:',
      },
      {
        ul: [
          '**My calendar** — your assignment deadlines and any personal tasks you add.',
          '**Concordia** — the official academic calendar: term boundaries, exam periods, reading weeks, closures, and registration deadlines.',
        ],
      },
      { p: 'They are layers rather than separate tabs so you never have to check two places to find a conflict.' },

      { h2: 'Three views' },
      {
        table: {
          head: ['View', 'Best for'],
          rows: [
            ['Month', 'Seeing the shape of a term and spotting crunch weeks.'],
            ['Week', 'Working out a specific week in detail.'],
            ['Agenda', 'A single scrollable list of upcoming days. The default on phones.'],
          ],
        },
      },

      { h2: 'Personal tasks' },
      {
        p: 'Open any day to see everything on it and add a task with its own date and time — study blocks, a group meeting, anything that is not a graded deadline. Tasks live on the My calendar layer and can be checked off or deleted.',
      },

      { h2: 'Adding campus events' },
      {
        p: 'Events from the Community tab can be added to your calendar with one tap, and land on the same personal layer. See [Community](/docs/community).',
      },
    ],
  },

  notifications: {
    title: 'Notifications',
    section: 'Planning your term',
    description:
      'How ConcordiaTracker reminders and push notifications work, and how to enable or turn them off.',
    blocks: [
      {
        p: 'ConcordiaTracker can send push notifications so a deadline reaches you without your having to open the app.',
      },

      { h2: 'Turning them on' },
      {
        p: 'Enable notifications in Settings → General. Your browser or phone will ask for permission — that prompt is the operating system’s, and the app cannot send anything until you accept it.',
      },
      {
        note: 'On iPhone, web push requires the app to be **installed to the Home Screen** first. Open the site in Safari, tap Share, then **Add to Home Screen**, and enable notifications from there.',
      },

      { h2: 'What gets sent' },
      {
        ul: [
          'Reminders you set on a specific assessment',
          'A warning before a free trial ends and a card is charged',
        ],
      },
      {
        p: 'Nothing is sent for marketing, and there is no digest you did not ask for.',
      },

      { h2: 'Turning them off' },
      {
        p: 'Switch them off in Settings → General, or revoke the permission in your browser or phone settings. Either stops delivery immediately.',
      },
    ],
  },

  /* ── Community ─────────────────────────────────────────────────────────── */

  community: {
    title: 'Community',
    section: 'Community',
    description:
      'Community is a feed of Concordia campus events from student organizations, with follows, program relevance, and one-tap calendar adds.',
    blocks: [
      {
        p: 'Community answers a different question from the rest of the app: what is happening around you that is not your own coursework. It is an events feed, not a social network — there are no posts, comments, or friend requests.',
      },

      { h2: 'The events feed' },
      {
        p: 'Events are published by student organizations and university offices. Each shows its host, category, date and time, whether it is in person or online, and where.',
      },
      {
        p: 'Filter by category, or switch on **For my program** to show only events relevant to what you study — matched against the program on your profile, so keeping that accurate makes the filter better.',
      },

      { h2: 'Event pages' },
      {
        p: 'Opening an event shows the full description, location, and host. From there you can add it to your calendar, set a reminder, or share it. Shared links open a public page that **anyone can view without an account**.',
      },

      { h2: 'Organizations' },
      {
        p: 'Every host has a profile with its bio, links, upcoming and past events. A blue seal marks a verified organization — an account confirmed as genuinely representing that group.',
      },
      { p: 'Following an organization keeps its events in view and can notify you when it posts. Manage who you follow from the Following list in the Community header.' },

      { h2: 'Finding people' },
      {
        p: 'Search covers both organizations and students. Only **public** profiles appear — yours is private until you turn it on in Settings → Privacy, and a private profile is genuinely unsearchable rather than merely hidden.',
      },
      {
        note: 'Follower counts are public. Follower **lists** are not, and cannot be retrieved — nobody can enumerate who follows whom.',
      },
    ],
  },

  /* ── Account & billing ─────────────────────────────────────────────────── */

  plans: {
    title: 'Plans',
    section: 'Account & billing',
    description:
      'What is free in ConcordiaTracker and what the Semester pass adds, with prices in Canadian dollars.',
    blocks: [
      {
        p: 'Most of ConcordiaTracker is free forever. The paid tier covers projection and unlimited imports.',
      },

      { h2: 'What each plan includes' },
      {
        table: {
          head: ['', 'Free', 'Semester pass'],
          rows: [
            ['Courses tracked', 'Unlimited', 'Unlimited'],
            ['Deadline tracking and calendar', 'Yes', 'Yes'],
            ['Grade entry and course standing', 'Yes', 'Yes'],
            ['Grade-needed calculator', 'Yes', 'Yes'],
            ['Syllabus uploads', 'Rate-limited monthly', 'Raised limit'],
            ['Blueprint imports', '1', 'Unlimited'],
            ['GPA projection (what-if)', '—', 'Yes'],
          ],
        },
      },

      { h2: 'Price' },
      {
        p: 'All prices are in **Canadian dollars** and are the same for everyone — no currency conversion at checkout.',
      },
      {
        ul: [
          '**Semester pass — $15 CAD**, renewing every four months, which is the length of a Concordia term.',
          '**Monthly — $5 CAD**, renewing monthly.',
        ],
      },
      {
        p: 'The Semester pass works out cheaper across a full year. Both unlock exactly the same features; the difference is only the billing period.',
      },

      { h2: 'Free trial' },
      {
        p: 'Every plan starts with a **7-day free trial**. A card is required to start it, nothing is charged until the trial ends, and cancelling before then costs nothing.',
      },
      { p: 'We send a notification before the trial ends and the first charge is taken, so it is never a surprise.' },

      { h2: 'Switching plans' },
      {
        p: 'Switching from monthly to the Semester pass carries your remaining paid days across — you are never charged twice for the same period.',
      },

      { h2: 'If you stop paying' },
      {
        p: 'Nothing is deleted. Your courses, deadlines, and grades stay exactly as they are, and the paid features lock again. Access runs to the end of the period you already paid for.',
      },
    ],
  },

  billing: {
    title: 'Billing',
    section: 'Account & billing',
    description:
      'How to subscribe, update your card, find invoices, and cancel a ConcordiaTracker subscription.',
    blocks: [
      {
        p: 'Billing lives in **Settings → Billing**. Everything below happens inside the app.',
      },

      { h2: 'How payments are handled' },
      {
        p: 'Payments are processed by **Stripe**. Card details are entered directly into Stripe’s payment form and are never sent to or stored on ConcordiaTracker’s servers. What we keep is a customer reference, your plan, and its status.',
      },

      { h2: 'Subscribing' },
      {
        p: 'Choose a plan in Settings → Billing and complete checkout in place — no redirect to another site. Your plan activates immediately, starting with the [free trial](/docs/plans).',
      },

      { h2: 'Auto-renewal' },
      {
        note: 'Subscriptions **renew automatically** at the end of each period — every four months for the Semester pass, monthly for the monthly plan — until you cancel. This is stated at checkout and in Settings → Billing.',
      },

      { h2: 'Updating your card' },
      {
        p: 'Settings → Billing → **Update card**. Worth doing before a renewal if your card is close to expiring; a failed payment will suspend the paid features until it is resolved.',
      },

      { h2: 'Invoices' },
      {
        p: 'Every payment produces an invoice, listed in Settings → Billing with a downloadable PDF receipt.',
      },

      { h2: 'Cancelling' },
      {
        p: 'Settings → Billing → **Cancel**. One click, no email required, no retention flow. Your access continues to the end of the period you already paid for, and you can resume before then to undo it.',
      },
      {
        p: 'Cancelling during a free trial means no charge at all.',
      },

      { h2: 'Refunds and problems' },
      {
        p: 'If something went wrong with a charge, email [concordiatracker@gmail.com](mailto:concordiatracker@gmail.com) from the address on the account. Please write before disputing a charge with your bank — a dispute is slower for you and costly for us, and almost everything can be sorted out directly.',
      },
    ],
  },

  settings: {
    title: 'Settings',
    section: 'Account & billing',
    description:
      'ConcordiaTracker settings — themes, language, notifications, account details, and usage.',
    blocks: [
      {
        p: 'Settings opens as a panel over whatever you are doing, from the gear beside your profile or the profile menu. Five sections.',
      },

      { h2: 'General' },
      {
        p: 'Themes, language, notifications, and update notes.',
      },
      {
        p: 'There are **four themes** — Refined Dark, Concordia Maroon, Light, and Purple Dark. Choosing one animates the change outward from the swatch you clicked. Language is English or French, and switching updates the whole interface including dates.',
      },

      { h2: 'Account' },
      {
        p: 'Display name, handle, school or faculty, and program. Program feeds the relevance filter in Community. Deleting your account is also here, and it is permanent.',
      },

      { h2: 'Privacy' },
      {
        p: 'The public profile switch and links to the legal documents and your data rights. See [Privacy](/docs/privacy).',
      },

      { h2: 'Billing' },
      { p: 'Your plan, renewal date, invoices, and card. See [Billing](/docs/billing).' },

      { h2: 'Usage' },
      {
        p: 'What you have used this month against your plan’s limits — syllabus uploads, blueprint imports, and which features are locked.',
      },

      { h2: 'Keyboard' },
      {
        p: 'Press `Ctrl` `K` (or `Cmd` `K` on a Mac) anywhere in the app to open the command palette. It searches your courses and assessments and jumps straight to them, and it is fully keyboard-navigable.',
      },
    ],
  },

  privacy: {
    title: 'Privacy and your data',
    section: 'Account & billing',
    description:
      'What ConcordiaTracker stores, what other students can see, and your rights under Quebec Law 25.',
    blocks: [
      {
        p: 'A summary in plain language. The [Privacy Policy](/privacy) is the binding document.',
      },

      { h2: 'What other students can see' },
      {
        p: 'Your **grades are never visible to anyone else**. Not to other students, not to professors, not on any profile.',
      },
      {
        p: 'What can become visible, and only by your choice:',
      },
      {
        ul: [
          'A course **outline** you contribute as a blueprint — assessments, dates, and weights, with no grades attached.',
          'Your profile, if you switch it to public. Private is the default, and a private profile is genuinely unsearchable.',
          'Your follower count, if your profile is public. Your follower list is never retrievable by anyone.',
        ],
      },

      { h2: 'Payment data' },
      {
        p: 'Card details go directly to Stripe and are never stored by ConcordiaTracker. We keep a customer reference, your plan, and its status.',
      },

      { h2: 'Your rights under Law 25' },
      {
        p: 'Quebec’s Law 25 gives you the right to access your data, correct it, and have it deleted. Deleting your account from Settings → Account removes it. For a copy of your data or any other request, write to [concordiatracker@gmail.com](mailto:concordiatracker@gmail.com).',
      },

      { h2: 'What we do not do' },
      {
        ul: [
          'We do not sell your data.',
          'We do not show advertising in the app.',
          'We do not connect to Moodle, eConcordia, or your student record, and never ask for those credentials.',
        ],
      },
    ],
  },

  /* ── Portals ───────────────────────────────────────────────────────────── */

  'teacher-portal': {
    title: 'Teacher portal',
    section: 'Portals',
    description:
      'How Concordia professors publish a verified course outline and post announcements to students using ConcordiaTracker.',
    blocks: [
      {
        p: 'The teacher portal is a separate, deliberately plain workspace for professors. It is publish-only: it shows nothing about individual students.',
      },

      { h2: 'Getting access' },
      {
        p: 'Access is by invitation. Request it at [concordiatracker.com/teacher/request](/teacher/request) and you will receive a case number to track the request. Invitations are single-use, tied to your email, and expire.',
      },

      { h2: 'Publishing an outline' },
      {
        p: 'Build the course outline by uploading your syllabus, which is read for you, or by entering the assessments directly. A running total shows whether the weights reach 100%.',
      },
      {
        p: 'Publishing makes it the **teacher-verified blueprint** for that course and section. It is pinned above community uploads for your students, and its dates import as **official**.',
      },
      {
        note: 'Publishing is live: editing a published outline updates what students see immediately. There is no separate draft-and-release step.',
      },

      { h2: 'Verifying a student outline' },
      {
        p: 'If students in your section have already uploaded an outline, you can review it and adopt it as your own. It becomes your verified outline with its dates promoted to official, and it is removed from the community pool.',
      },

      { h2: 'Announcements' },
      {
        p: 'Post an announcement and it appears on the Today screen of every student enrolled in that course, and on the course page. Announcements can be edited or deleted, and an edit is visibly marked as such.',
      },

      { h2: 'What you cannot see' },
      {
        p: 'The portal shows no student grades, no standings, and no per-student activity. It is a publishing tool, and that boundary is deliberate.',
      },
    ],
  },

  'organizer-portal': {
    title: 'Organizer portal',
    section: 'Portals',
    description:
      'How Concordia student organizations publish events to the ConcordiaTracker Community feed and manage their public profile.',
    blocks: [
      {
        p: 'The organizer portal is for student associations, clubs, and university offices publishing events to the Community feed.',
      },

      { h2: 'Getting access' },
      {
        p: 'Access is by invitation. Request it at [concordiatracker.com/organizer/request](/organizer/request). Once approved, you can invite teammates to help run the account.',
      },

      { h2: 'Publishing events' },
      {
        p: 'Create an event with its title, date and time, whether it is in person or online, location, description, category, and a banner image. Every event gets a public link that anyone can open without an account, which makes it shareable on social media.',
      },
      {
        p: 'You can notify your followers when you post something new.',
      },

      { h2: 'Your public profile' },
      {
        p: 'Set your name, handle, bio, logo, banner, brand colour, and links. Your brand colour carries through the feed, so your events are recognisably yours. Verified organizations show a seal.',
      },

      { h2: 'Reach' },
      {
        p: 'The dashboard reports aggregate numbers: followers, calendar adds, event follows, and views.',
      },
      {
        note: 'Metrics are **aggregate only**. Organizers can never see which individual students viewed, followed, or added an event. Students are frequently minors and always covered by Quebec privacy law, and there is no version of this feature that identifies them.',
      },

      { h2: 'Your team' },
      {
        p: 'Invite teammates with a shareable single-use link and assign roles. Useful when an executive team turns over each year — remove the outgoing members, invite the incoming ones, and the account continues.',
      },
    ],
  },
}

/** Flattened page order — drives prev/next and the sitemap. */
export function flatten() {
  const out = []
  for (const group of NAV) {
    for (const slug of group.pages) {
      const page = PAGES[slug]
      if (!page) throw new Error(`NAV references a page that does not exist: ${slug}`)
      out.push({ ...page, slug })
    }
  }
  const missing = Object.keys(PAGES).filter((s) => !out.some((p) => p.slug === s))
  if (missing.length) throw new Error(`PAGES not listed in NAV: ${missing.join(', ')}`)
  return out
}
