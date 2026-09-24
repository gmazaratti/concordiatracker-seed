/**
 * Docs content. Plain data: the renderer turns it into static HTML.
 *
 * SCOPE: this documents the PRODUCT: what the features are, how they work, how
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
    pages: ['introduction', 'quick-start', 'faq', 'support', 'support-status', 'contact'],
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
    pages: ['today', 'calendar', 'calendar-sync', 'moodle-sync', 'notifications'],
  },
  {
    title: 'Planner',
    pages: [
      'planner',
      'my-record',
      'my-programme',
      'course-directory',
      'prerequisites',
      'schedule-builder',
      'seat-watch',
      'radar',
      'costs',
    ],
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
    title: 'Developers',
    pages: ['api'],
  },
  {
    title: 'For teachers',
    pages: ['teacher-portal', 'teacher-setup', 'teacher-first-outline'],
  },
  {
    title: 'For organizations',
    pages: ['organizer-portal', 'organizer-setup', 'organizer-first-event'],
  },
]

/* The signed-out ticket-status widget: markup, styles, and behaviour. Kept
 * beside its page rather than in the renderer, since it is specific to this
 * one page rather than part of the docs shell. */
const SUPPORT_STATUS_UI = `<div class="ticket-tool"><div class="ticket-lookup"><label>Case number<input type="text" id="t-case" placeholder="TKT-1001" autocomplete="off" /></label><label>Access key<input type="text" id="t-token" placeholder="From your ticket link" autocomplete="off" /></label><button type="button" id="t-load">Open conversation</button></div><p class="ticket-err" id="t-err" hidden></p><div id="t-thread" hidden></div></div>`

const SUPPORT_STATUS_STYLE = `<style>.ticket-tool{margin:18px 0 8px}.ticket-lookup{display:grid;grid-template-columns:1fr 1fr auto;gap:10px;align-items:end}.ticket-lookup label{display:block;font-size:12px;font-weight:500;color:var(--muted);margin:0}.ticket-lookup input{display:block;width:100%;margin-top:4px;background:var(--canvas);border:1px solid var(--border);border-radius:9px;padding:8px 10px;color:var(--fg);font:inherit;font-size:13.5px}.ticket-lookup input:focus{outline:0;border-color:var(--accent)}.ticket-lookup button,.tm-reply button{background:var(--accent);color:#0e1c14;border:0;border-radius:9px;padding:9px 14px;font:inherit;font-size:13.5px;font-weight:600;cursor:pointer;white-space:nowrap}.ticket-err{margin:12px 0 0;font-size:13px;color:#f0676b}#t-thread{margin-top:22px;border:1px solid var(--border);border-radius:13px;overflow:hidden}.tm-head{display:flex;align-items:center;gap:10px;padding:12px 15px;border-bottom:1px solid var(--border);background:var(--surface)}.tm-head strong{flex:1;min-width:0;font-family:var(--display);font-size:14.5px}.tm-status{font-size:11.5px;text-transform:capitalize;padding:2px 8px;border-radius:99px;background:var(--surface-2);color:var(--muted)}.tm-status.s-open{color:#e7a93a}.tm-status.s-answered{color:#5aa9f0}.tm-status.s-solved{color:#4ec9a5}.tm{padding:13px 15px;border-bottom:1px solid var(--border)}.tm-who{margin:0 0 5px;font-size:11.5px;color:var(--subtle)}.tm-body{font-size:13.5px;line-height:1.6;white-space:pre-wrap;color:var(--muted)}.tm.staff{background:var(--accent-soft)}.tm.staff .tm-body{color:var(--fg)}.tm-reply{display:flex;gap:10px;padding:13px 15px;align-items:flex-end}.tm-reply textarea{flex:1;background:var(--canvas);border:1px solid var(--border);border-radius:9px;padding:8px 10px;color:var(--fg);font:inherit;font-size:13.5px;resize:vertical}.tm-reply textarea:focus{outline:0;border-color:var(--accent)}@media (max-width:640px){.ticket-lookup{grid-template-columns:1fr}}</style>`

const SUPPORT_STATUS_SCRIPT = `
// Ticket status + reply, for people who are not signed in. Everything is gated
// on the access key from the ticket link: a guessed case number reveals nothing.
(function () {
  var caseEl = document.getElementById('t-case');
  var tokEl = document.getElementById('t-token');
  var errEl = document.getElementById('t-err');
  var thread = document.getElementById('t-thread');
  if (!caseEl) return;

  var params = new URLSearchParams(location.search);
  if (params.get('case')) caseEl.value = params.get('case');
  if (params.get('token')) tokEl.value = params.get('token');

  function esc(t) {
    return String(t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function render(t) {
    var msgs = (t.messages || []).map(function (m) {
      var staff = m.author_role === 'staff';
      return '<div class="tm ' + (staff ? 'staff' : 'me') + '">' +
        '<p class="tm-who">' + esc(m.author_name) + ' · ' + new Date(m.created_at).toLocaleString() + '</p>' +
        '<div class="tm-body">' + esc(m.body) + '</div></div>';
    }).join('');
    thread.innerHTML =
      '<div class="tm-head"><strong>' + esc(t.subject) + '</strong>' +
      '<span class="tm-status s-' + esc(t.status) + '">' + esc(t.status) + '</span></div>' +
      msgs +
      '<div class="tm-reply"><textarea id="t-reply" rows="3" placeholder="Write a reply…"></textarea>' +
      '<button type="button" id="t-send">Send reply</button></div>';
    thread.hidden = false;
    document.getElementById('t-send').addEventListener('click', function () { post('reply'); });
  }

  function post(action) {
    errEl.hidden = true;
    var payload = {
      action: action,
      caseId: (caseEl.value || '').trim(),
      token: (tokEl.value || '').trim()
    };
    if (action === 'reply') {
      var box = document.getElementById('t-reply');
      if (!box || !box.value.trim()) return;
      payload.message = box.value.trim();
    }
    fetch('/api/ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.d && res.d.error ? res.d.error : 'Could not load that ticket.');
        render(res.d.ticket);
      })
      .catch(function (e) { errEl.textContent = e.message; errEl.hidden = false; });
  }

  document.getElementById('t-load').addEventListener('click', function () { post('check'); });
  if (caseEl.value && tokEl.value) post('check');
})();
`

/**
 * The setup walkthrough, as a silent looping clip — a GIF that happens to be
 * an MP4 (same 26 seconds at 1.2 MB instead of ~25 MB, and without a GIF's
 * 256 colours fringing every label). No controls and no click target: a
 * control bar invites you to operate it, and the point is that it plays
 * itself while you read the steps beside it.
 *
 * Autoplay is dropped under `prefers-reduced-motion`, which a stylesheet
 * cannot do for a <video>; controls appear in that one case so the poster is
 * not a dead end. Done in the page script rather than with attributes,
 * because this markup is static HTML.
 */
const MOODLE_VIDEO =
  '<video id="moodle-loop" src="/moodle/setup.mp4" poster="/moodle/setup-poster.jpg"' +
  ' muted loop playsinline preload="metadata" aria-label="The Moodle setup, start to finish"' +
  ' style="display:block;width:100%;margin:18px 0;border-radius:12px;border:1px solid var(--border)"></video>'

const MOODLE_VIDEO_SCRIPT = `
(function () {
  var v = document.getElementById("moodle-loop")
  if (!v) return
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    v.controls = true
    return
  }
  // Autoplay is a request, not a guarantee: a browser may refuse it even
  // muted, and a rejected promise must not surface as an unhandled error.
  var p = v.play()
  if (p && p.catch) p.catch(function () { v.controls = true })
})()
`

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
        p: 'It runs in the browser and installs as an app on phones and desktops. There is nothing to download and no extension. You sign in with Google, Apple, or an email address, and your data syncs across your devices.',
      },
      {
        p: 'ConcordiaTracker is an independent project. It is **not affiliated with Concordia University**. It never connects to eConcordia or your student record. It can read your Moodle calendar, but only if you choose to paste in the calendar link Moodle gives you: see [Connect Moodle](/docs/moodle-sync).',
      },

      { h2: 'How it works' },
      {
        p: 'A course outline lists what is due, when, and how much it is worth. ConcordiaTracker gets that information into your account in one of three ways: importing a shared outline another student or professor already uploaded, reading a syllabus PDF for you, or letting you type it in.',
      },
      {
        p: 'From there everything else follows automatically. Deadlines appear on Today and the calendar, and as you enter grades the app computes your standing in each course and your GPA on Concordia’s 4.30 scale. If you connect Moodle, dated Moodle events join your calendar too and are checked again every night.',
      },
      {
        p: 'Beyond your own courses, the **Community** tab is where student clubs and organizations publish events and posts, and the **Planner** is where you look ahead to next term.',
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
        p: 'Go to [concordiatracker.com](/) and choose **Open app**. You can sign in with Google or Apple, or create an account with an email and password. There is no charge to create an account and no card required.',
      },

      { h2: '2. Set up your profile' },
      {
        p: 'Onboarding asks for a display name, a handle, and your program. The program is used to mark campus events as relevant to you: nothing else. You also pick a theme and a language here, and both are changeable later in Settings.',
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
      'Common questions about ConcordiaTracker: how Moodle sync works, how the GPA scale works, what is free, how clubs join, and who can see your data.',
    blocks: [
      { h2: 'Is it affiliated with Concordia University?' },
      {
        p: 'No. ConcordiaTracker is an independent project built for Concordia students. It has no connection to the university, and the university does not endorse or supply it.',
      },

      { h2: 'Does it connect to Moodle?' },
      {
        p: 'Yes, one way, and only if you set it up. In Moodle you copy your calendar link (Calendar, then Export, then **Get calendar URL**) and paste it into **Settings → Moodle**. From then on, dated Moodle events are pulled into your calendar and checked again every night, and a date your professor moves shows the old and new date side by side. It never needs your Moodle password, and it cannot read your grades or submissions. See [Connect Moodle](/docs/moodle-sync).',
      },

      { h2: 'Does it connect to eConcordia or my student record?' },
      {
        p: 'No. eConcordia has no equivalent calendar link, and there is no connection to your student record or the Student Centre. The app never asks for those credentials. Course information otherwise gets in through a shared outline, a syllabus you upload, or manual entry.',
      },

      { h2: 'What is in the Community tab?' },
      {
        p: 'Events and posts published by Concordia student clubs and organizations. You follow the clubs you care about, add their events to your calendar in one tap, and react to posts. Students do not publish there: only approved organizations do. See [Community](/docs/community).',
      },

      { h2: 'How does my club get listed?' },
      {
        p: 'Apply at [concordiatracker.com/organizer/apply](/organizer/apply). You sign in first, answer a few questions, and your organizer dashboard opens straight away. The club stays **pending**, and nothing reaches students until an administrator approves it. See [Setting up your organization](/docs/organizer-setup).',
      },

      { h2: 'Which GPA scale does it use?' },
      {
        p: 'Concordia’s 4.30 scale. Course percentages are converted to letter grades and grade points, then weighted by credits to produce your GPA. See [Grade calculators](/docs/grade-calculators) for the arithmetic, which the app also shows you in full inside each course.',
      },

      { h2: 'Is it free?' },
      {
        p: 'The core is free: unlimited courses, deadline tracking, grade entry, the calendar, Moodle sync, Community, the grade-needed calculator, and 5 syllabus scans a month. The Semester pass adds GPA projection, the calendar feed for Google or Apple, term cost estimates, more themes, more seat watches, and no monthly scan cap. See [Plans](/docs/plans).',
      },

      { h2: 'Do I need to install anything?' },
      {
        p: 'No. It runs in any modern browser. You can optionally install it as an app on your phone or desktop for a full-screen experience and notifications: your browser will offer this, or you can use **Add to Home Screen** on iOS.',
      },

      { h2: 'Can other students see my grades?' },
      {
        p: 'No. Grades are private to your account and are never shared, shown to other students, or published anywhere. What can be shared is a course **outline**: the list of assessments, dates, and weights: and only if you choose to contribute one. See [Privacy](/docs/privacy).',
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
        p: 'The [FAQ](/docs/faq) covers the most common questions. If a deadline looks wrong, check its provenance badge first: an unverified date came from a single student and may simply need correcting, which you can do yourself in seconds. See [Provenance](/docs/provenance).',
      },
    ],
  },

  /* ── Your courses ──────────────────────────────────────────────────────── */


  support: {
    title: 'Support',
    section: 'Getting started',
    description:
      'How ConcordiaTracker support works: open a ticket from the app or the docs, and follow the conversation with a case number.',
    blocks: [
      {
        p: 'Support is a conversation, not a form that disappears into an inbox. Every ticket keeps its full history, and you can reply to it as long as it is open.',
      },

      { h2: 'If you have an account' },
      {
        p: 'Open **profile menu → Support** in the app to write to us. Your tickets and our replies also live in **Community → Messages → Support**, beside your other conversations. It is the best route, because your account details come attached and there is nothing to look up.',
      },
      { p: 'You can also jump straight there: [open support in the app](/app?support=1).' },

      { h2: 'If you do not have an account' },
      {
        p: 'Use the **Support** button at the top of any page in these docs. It only needs an email address so we can reach you.',
      },
      {
        note: 'You will get a **case number** like `TKT-1001` and a private link. Save the link: it is the only way back into the conversation, and we cannot recover it for you if it is lost.',
      },
      { p: 'To pick a conversation back up, use [Check a ticket](/docs/support-status).' },

      { h2: 'What happens next' },
      {
        table: {
          head: ['Status', 'Means'],
          rows: [
            ['**Open**', 'Waiting on us. Newly submitted tickets and any you have replied to.'],
            ['**Answered**', 'We have replied and it is with you. Reply again and it reopens.'],
            ['**Solved**', 'Closed out. Writing back on it opens it again: nothing is ever locked.'],
          ],
        },
      },

      { h2: 'What to include' },
      {
        ul: [
          'What you were trying to do, and what happened instead',
          'The course or page it happened on',
          'Your browser, and whether you are on a phone or a computer',
        ],
      },
      {
        p: 'For billing questions, write from the email address on the account: it saves a round trip. And if a charge looks wrong, please open a ticket before disputing it with your bank; almost everything is sorted out faster directly.',
      },
    ],
  },

  'support-status': {
    title: 'Check a ticket',
    section: 'Getting started',
    description:
      'Look up a ConcordiaTracker support ticket with its case number and access key, read the replies, and respond.',
    script: SUPPORT_STATUS_SCRIPT,
    blocks: [
      {
        p: 'Enter the case number and access key from your ticket link to read the conversation and reply. Both are required: a case number on its own will not open anything.',
      },
      { raw: SUPPORT_STATUS_STYLE + SUPPORT_STATUS_UI },
      {
        p: 'Signed in? Your tickets are in the app under **profile menu → Support**, with no case number needed.',
      },
    ],
  },

  'adding-courses': {
    title: 'Adding courses',
    section: 'Your courses',
    description:
      'Three ways to add a Concordia course to ConcordiaTracker: import a shared blueprint, upload a syllabus PDF, or enter it manually.',
    blocks: [
      {
        p: 'Every course needs the same information: what is due, when, and what each item is worth. There are three ways to get it in, and they differ only in how much typing you do.',
      },

      { h2: 'Import a blueprint (fastest)' },
      {
        p: 'A **blueprint** is a course outline someone has already shared: another student in your section, or the professor. Importing one fills in every assessment, date, and weight at once. This is the fastest method and gets faster as more outlines are shared.',
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

      { h2: 'Next term, before it starts' },
      {
        p: 'From **Courses → Upcoming**, add a class for a term that has not begun. Pick it out of Concordia’s calendar so the code, title and credit value are the university’s own rather than something you retyped, then choose the term.',
      },
      {
        p: 'You land on the class with the section list already open, so the meeting times, room and section fill themselves from what Concordia publishes. Lectures, tutorials and labs are separate registrations, so pick one of each you attend.',
      },
      {
        note: 'The instructor is the one field that will not fill in. Concordia’s published schedule carries the class number, times, room, delivery mode and seat counts, and no teaching staff at all: guessing one would attach a real person’s name to something unverifiable.',
      },
      {
        p: 'No assignments or dates are added for a future term. Outlines are published in the first week, and last term’s dates would be wrong in a way you would plan around. If you genuinely have the syllabus early, the course page has a quiet way in.',
      },
      {
        p: 'If you are **on the waitlist**, say so when you add the class. It is then marked as a maybe rather than a certainty, so its credits are not folded into your full-time status or your cost estimate as though the seat were already yours.',
      },

      { h2: 'A course the calendar does not have' },
      {
        p: 'Our copy of the course calendar is a mirror, refreshed on a schedule, so a brand-new course or one added between syncs genuinely will not be there. Choose **My course isn’t here** and fill in the code, name and credits. It goes in immediately as a normal class, and it also tells us what the mirror is missing.',
      },

      { h2: 'Course details' },
      {
        p: 'Whichever method you use, each course has an editable details panel: instructor, TA, section, meeting times, office hours, location, credits, enrolment status, and a link to the syllabus. Credits matter: they are what weights each course in your GPA.',
      },
      {
        p: 'Most of that came from a mirror of Concordia’s calendar, which is only as fresh as its last sync. Every field is editable, so fix yours straight away, and **Something here is wrong** at the bottom of the panel reports it so the copy everyone else sees gets fixed too. Filing a report never blocks you.',
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
      'Blueprints are shared Concordia course outlines: teacher-verified or community-uploaded: that fill in every deadline and weight in one import.',
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
          '**Teacher-verified**: published by the professor through the teacher portal. These are pinned to the top of the list and their dates import as **official**.',
          '**Community**: uploaded by a student. These are ranked by votes from other students in the section, and their dates import as **unverified**, because a single upload has nothing corroborating it yet.',
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
        p: 'Each entry shows who uploaded it, when, how many items it contains, how many students have imported it, and its net votes. Expanding **Preview outline** shows exactly what will be added: every assessment with its kind, date, and weight, plus whether the weights total 100%.',
      },
      {
        note: 'Blueprints from past terms are collapsed separately and hidden by default. An outline from a previous year is often close but rarely exact.',
      },

      { h2: 'Contributing' },
      {
        p: 'Once you have a course set up, you can share your outline back so the next student in your section does not have to. Only the outline is shared: never your grades, and never your name unless you choose a public handle.',
      },
      {
        p: 'Some outlines come from the university itself: for online courses, the outline eConcordia publishes is imported and marked as coming from the course outline, with a link to the PDF so you can check it.',
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
          'Wait a few seconds while it is read.',
          'Review the result, then confirm to add them to the course.',
        ],
      },
      {
        p: 'If that course code is already in your list for the same term, the items are added to it rather than creating a second copy of the course, and only details you have left blank are filled in.',
      },

      { h2: 'What it extracts' },
      {
        p: 'The assessment name, its kind (assignment, quiz, midterm, final, lab, reading, or project), its due date, and its weight as a percentage of the final grade.',
      },
      {
        p: 'It works best on a syllabus with a grade-composition table, which is the standard format for most Concordia courses. A syllabus that describes weighting only in prose will produce a thinner result.',
      },
      {
        p: 'Dates are never invented. An item the outline gives no date for (a final set by the Examinations Office, say) arrives undated and is highlighted so you can add the date later or mark it as not needing one.',
      },

      { h2: 'Always check the result' },
      {
        note: 'Extraction is automated and it is not perfect. Check the dates and weights before you rely on them: particularly that the weights total 100%. Anything that looks wrong can be edited directly.',
      },
      {
        p: 'Dates read from a syllabus you uploaded are marked **unverified**, because a single upload has nothing to cross-check it against. See [Provenance](/docs/provenance).',
      },

      { h2: 'Limits' },
      {
        p: 'Free accounts get **5 syllabus scans a month**, resetting on the 1st; a scan that fails is not counted. The Semester pass removes the monthly cap. Every plan also has a short-term ceiling of 10 scans an hour, which only exists to stop abuse. Your current usage is shown in Settings → Usage.',
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
        p: 'Unverified is not an accusation. It is the honest state of a date that one person typed in: including one you typed in yourself.',
      },

      { h2: 'Where badges appear' },
      {
        p: 'On course pages, in the calendar, and in the assessment editor. Today hides them by default to keep the list calm, showing only a quiet marker on unverified dates; you can turn full badges on in **Customize Today**.',
      },

      { h2: 'When Moodle disagrees' },
      {
        p: 'If you have connected Moodle and a Moodle deadline matches an assessment in one of your courses but on a different day, the course shows both dates side by side and you choose which to keep. Nothing changes automatically. See [Connect Moodle](/docs/moodle-sync).',
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
        p: 'Grades go in on the course page, in the assessment table. Everything downstream: your course standing, the calculators, your GPA: is computed from what you enter here.',
      },

      { h2: 'Two ways to type a grade' },
      {
        p: 'The grade field accepts either form and works out which you meant:',
      },
      {
        ul: [
          'A **percentage**: type `85` for 85%.',
          'A **raw score**: type `17/20` and it resolves to 85% as you type.',
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
        note: 'Status is set by you and never guessed from the date. An item you finished on time still reads **Done** even if you record it weeks later: the app will not quietly mark your work late.',
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

      { h2: 'Grade needed: free' },
      {
        p: 'Pick a target letter grade and the calculator solves for the average you need across everything still ungraded.',
      },
      {
        p: 'It answers honestly in every case. If the target is already locked in no matter what, it says so. If it has become unreachable even with a perfect score, it says that too, rather than showing an impossible number.',
      },
      {
        note: 'This is free and stays free. Knowing what you need to pass is the question students most need answered, and it should not sit behind a payment.',
      },

      { h2: 'GPA what-if: Semester pass' },
      {
        p: 'The projection tool takes the opposite direction: assume a score on everything still outstanding, and see where the course and your term GPA land.',
      },
      {
        p: 'Move the slider and both update live: the projected course percentage with its letter grade, and your projected term GPA with the change from where you are now. It is how you find out which deadline actually moves your average, which is rarely the one that feels most urgent.',
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
      'Today is the ConcordiaTracker launch screen: what is due, what is next, and where your GPA stands.',
    blocks: [
      {
        p: 'Today is what opens when you sign in. It answers one question: what needs attention now.',
      },

      { h2: 'The due list' },
      {
        p: 'The heart of the screen, grouped into Overdue, This week, Coming up, and No date yet. Each row shows the title, the course, the kind of assessment, and when it is due: with overdue and same-day items coloured, and everything else deliberately calm.',
      },
      {
        p: 'Alongside your course assessments it lists the personal tasks you have added, and, if you have connected Moodle, Moodle deadlines that do not already match an assessment in one of your courses. A Moodle item that does match is shown once, as the assessment, since that is the one carrying the weight and the grade.',
      },
      { p: 'Tapping the circle on a row marks it done. It moves to a **Completed today** section with an undo, so a mis-tap costs nothing. On a phone you can also swipe a row: right to mark it done, left for its actions.' },
      { p: '**Add task** at the top of the list adds a personal task without leaving Today.' },

      { h2: 'Row actions' },
      {
        p: 'The menu on each row opens the full editor for that item: due date and time, status, grade, and notes: or jumps to it inside its course, or deletes it. Deleting is undoable from the toast that follows.',
      },

      { h2: 'Widgets' },
      {
        p: 'Around the due list sit up to five widgets you choose, such as your term at a glance, your next class, the SGW to Loyola shuttle timetable, seat watch, or a focus timer. The due list itself can be moved but never removed.',
      },

      { h2: 'Customize Today' },
      {
        p: 'The **Customize** control is where you add, remove and reorder widgets, and it tunes the list to how you read:',
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

  'calendar-sync': {
    title: 'Google and Apple Calendar',
    section: 'Planning your term',
    description:
      'Subscribe to your ConcordiaTracker deadlines from Google Calendar, Apple Calendar or Outlook with one link, so a date you change here changes there too.',
    blocks: [
      {
        p: 'Most people already live in one calendar, and it is usually not ours. Calendar sync puts your ConcordiaTracker deadlines into that calendar and keeps them right: change a date here, or let a moved Moodle deadline arrive overnight, and the entry over there follows.',
      },

      { h2: 'Turning it on' },
      {
        ol: [
          'Open **Settings → Calendar sync** (the gear beside your name, or Calendar and then *Sync your calendar* in the right-hand rail).',
          'Press **Turn on calendar sync**.',
          'Press **Add to Google Calendar** or **Add to Apple Calendar**, or copy the link and paste it into whatever calendar you use.',
        ],
      },
      {
        p: 'For Outlook, Thunderbird or anything else, look for *Subscribe from web*, *From URL*, or *New calendar subscription* and paste the link there. It is an ordinary iCalendar feed, so anything that keeps a calendar can read it.',
      },

      { h2: 'It goes one way' },
      {
        p: 'Your deadlines show up in your calendar. Nothing travels back: events you create in Google or Apple stay there, we never read your calendar, and we never ask for access to your Google or Apple account. There is no sign-in step because there is nothing for us to sign in to.',
      },

      { h2: 'How often it updates' },
      {
        p: 'This is the part worth knowing before you rely on it, because it is the one thing we do not control.',
      },
      {
        ul: [
          '**Apple Calendar** asks you how often to refresh when you subscribe, and honours it, every five minutes if you want.',
          '**Google Calendar** uses its own schedule for every subscribed calendar. In practice that is usually a few hours and can be up to a day. Google does not offer a refresh button and does not let the publisher set the interval.',
          '**Outlook** behaves like Google: its own schedule, typically a few hours.',
        ],
      },
      {
        p: 'So a deadline that moves this afternoon is correct in ConcordiaTracker immediately and correct in Google whenever Google next looks. If something has just changed and it matters today, check here rather than there.',
      },

      { h2: 'The link is a key' },
      {
        p: 'Anyone holding your feed link can read those dates without signing in. That is exactly how it works at all: Google fetches it from Google\'s servers, with no session of yours. Treat it the way you would treat a password.',
      },
      {
        p: 'If you have shared it, screenshotted it, or just want a fresh one, press **Rotate link**. The old link stops working immediately everywhere it has been pasted, and you re-add the calendar with the new one.',
      },

      { h2: 'What is in the feed' },
      {
        ul: [
          '**Course deadlines**: assignments, quizzes and exams, each named with its course code so they read clearly among your other events.',
          '**Tasks and Moodle deadlines**: anything you added yourself, plus whatever your Moodle calendar sends.',
        ],
      },
      {
        p: 'Each switch can be turned off on its own. Items with no date set are never included: a deadline nobody has written down is not something to put in a calendar.',
      },
      {
        p: 'Anything you have marked done still appears, with a tick in front of it, so a week you have finished does not look empty.',
      },

      { h2: 'If nothing shows up' },
      {
        p: 'The Settings panel says whether anything has actually read the link, and when. That single line separates the two problems: if it says nothing has read it yet, the subscription did not take and it is worth adding the link again; if it says Google read it two hours ago, the link is fine and Google simply has not refreshed since.',
      },

      { h2: 'Turning it off' },
      {
        p: 'Press **Turn off**. The link stops working, and the entries disappear from your calendar the next time it looks. Nothing is written to your Google or Apple account, so there is nothing left behind to clean up.',
      },
      {
        p: 'Calendar sync is part of the Semester pass. If a pass lapses the feed stops carrying your deadlines and carries one event saying so, rather than emptying your calendar with no explanation.',
      },
    ],
  },

  'moodle-sync': {
    script: MOODLE_VIDEO_SCRIPT,
    title: 'Connect Moodle',
    section: 'Planning your term',
    description:
      'Bring your Moodle assignment deadlines into ConcordiaTracker with one link, re-checked every night, so a date your professor moves shows up here too.',
    blocks: [
      {
        p: 'Concordia hands you deadlines in three places and joins none of them. ConcordiaTracker already holds your syllabus dates and the registrar calendar; Moodle holds what your professor actually posted: the assignment that moved, the quiz added in week six. Connecting it is the missing third.',
      },

      { h2: 'What you need' },
      {
        p: 'One link from Moodle. Not your password. We never ask for one, and Concordia signs you in through its own system anyway.',
      },

      { raw: MOODLE_VIDEO },

      { h2: 'Where to get the link' },
      {
        ol: [
          'Open [Moodle → Calendar → Export](https://moodle.concordia.ca/moodle/calendar/export.php) and sign in if it asks.',
          'Choose **All events** and **Recent and next 60 days**. Pick **Custom range** instead if you want the whole term.',
          'Press **Get calendar URL**, *not* the Export button, which downloads a file to your computer instead.',
          'A long link appears underneath. Copy the whole thing.',
        ],
      },

      { h2: 'Where to paste it' },
      {
        p: 'In ConcordiaTracker, open **Settings → Moodle** (the gear beside your name, or your avatar menu → Settings). Paste the link and press **Connect Moodle**.',
      },
      {
        p: 'It checks the link straight away and tells you how many deadlines it found. If nothing comes back, the most common reason is that Export was pressed instead of Get calendar URL.',
      },

      { h2: 'What happens next' },
      {
        ul: [
          'Your Moodle deadlines appear in **Calendar** on their own *Moodle* layer, which you can switch off, and on **Today** when they do not already match an assessment in one of your courses.',
          'The Moodle feed also names your courses, so the app can offer to add any class it sees that is not in your list yet. Nothing is added unless you tick it.',
          'They are re-checked **every night**, and **Sync now** in Settings forces a check immediately.',
          'Only items still ahead of you are imported. Work you have already finished is left in Moodle.',
        ],
      },

      { h2: 'When a professor moves a date' },
      {
        p: 'This is the part that pays for the setup. Nothing is ever changed behind your back:',
      },
      {
        ul: [
          'The synced calendar item shows **the old date and the new one**, so you can see what changed rather than finding it already moved. Dismiss it with *Got it*.',
          'If the deadline also exists as an assessment in one of your courses (from a syllabus or a blueprint), that course shows **Moodle has a different date**, with your date and Moodle’s side by side. You choose. Your weight, grade and notes are never touched, only the date.',
        ],
      },
      {
        p: 'The second one is a match made by name, so the card shows which Moodle event it matched. If it looks wrong, choose **Keep mine**: nothing changes.',
      },

      { h2: 'What the link can and cannot do' },
      {
        table: {
          head: ['', ''],
          rows: [
            ['**Reads**', 'Your Moodle calendar: event names, dates, and the course each belongs to.'],
            ['**Cannot read**', 'Your grades, your submissions, your messages, or anything else in Moodle.'],
            ['**Cannot change**', 'Anything at all. The link is read-only.'],
            ['**Is not**', 'Your password. It is a calendar key Moodle generates for you.'],
          ],
        },
      },
      {
        p: 'It is still a private key: anyone holding it could read your calendar. So it is stored where **our own app cannot read it back** (only the nightly sync can use it), and it is never shown again after you paste it.',
      },

      { h2: 'Turning it off' },
      {
        ul: [
          '**Settings → Moodle → Disconnect** forgets the link and removes everything it added.',
          'Resetting the calendar token in Moodle kills **every** copy of that link at once, including ours.',
        ],
      },

      { h2: 'Things it does not do' },
      {
        ul: [
          'Moodle does not say what an assignment is **worth**, so synced items arrive as calendar deadlines, not graded assessments. They will not change your GPA or your grade breakdown.',
          'It is one-way. Nothing you do in ConcordiaTracker is written back to Moodle.',
          '**eConcordia is a different system** and has no equivalent link. Those courses are covered instead by published course outlines, which carry weights as well as dates.',
        ],
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

      { h2: 'Layers' },
      {
        p: 'Content comes from independent layers, each toggleable in the side panel:',
      },
      {
        ul: [
          '**My calendar**: your assignment deadlines and any personal tasks you add.',
          '**Moodle**: deadlines synced from your Moodle calendar. It appears once you have [connected Moodle](/docs/moodle-sync) and something has synced.',
          '**Concordia**: the official academic calendar: term boundaries, exam periods, reading weeks, closures, and registration deadlines.',
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
        p: 'Open any day to see everything on it and add a task with its own date and time: study blocks, a group meeting, anything that is not a graded deadline. A task can carry a note, a checklist you tick off in place, and a repeat (every day, every weekday, or every week). Tasks live on the My calendar layer and also show on Today.',
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
      'How ConcordiaTracker notifications work: the in-app notification list, and push notifications for reminders and seat alerts.',
    blocks: [
      {
        p: 'There are two kinds: a notification list inside the app, and push notifications that reach you when the app is closed.',
      },

      { h2: 'In the app' },
      {
        p: 'The bell (beside the settings gear on a computer, on your profile on a phone, and in the profile menu) opens your notifications: new followers, new posts from clubs you follow, replies and status changes on feedback you posted, and, if you help run a club, invitations and role changes on its team. A short banner also points to anything new when you open the app. **Mark all as read** clears the badge without deleting anything; swipe a single notification to remove it.',
      },

      { h2: 'Push: turning it on' },
      {
        p: 'Enable notifications in Settings → General. Your browser or phone will ask for permission: that prompt is the operating system’s, and the app cannot send anything until you accept it.',
      },
      {
        note: 'On iPhone, web push requires the app to be **installed to the Home Screen** first. Open the site in Safari, tap Share, then **Add to Home Screen**, and enable notifications from there.',
      },

      { h2: 'What gets pushed' },
      {
        ul: [
          'Reminders you set on a specific assessment or a campus event',
          'A seat opening in a section you are watching',
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

  /* ── Planner ───────────────────────────────────────────────────────────── */

  planner: {
    title: 'Planner',
    section: 'Planner',
    description:
      'The Planner is where you decide what to take next term at Concordia: your record, your degree requirements, the course calendar, prerequisites, a schedule builder, and seat alerts.',
    blocks: [
      {
        p: 'Today, Courses and Calendar are all about the term you are running. The Planner is about the one you are choosing, plus the checks that tell you whether the current one is going well.',
      },
      {
        p: 'It is one tab with several sections, grouped by the order you actually work through them.',
      },

      { h2: 'What you have done' },
      {
        p: '**My record** is everything you have already passed. **My programme** measures that against your degree requirements. **Radar** checks the term you are in now for problems that are coming but not obvious yet.',
      },

      { h2: 'What you could take' },
      {
        p: '**Course directory** searches every course Concordia publishes. **Prerequisite tree** shows what a course needs and what it unlocks. **Saved** is your shortlist for a future term.',
      },

      { h2: 'What you are taking' },
      {
        p: '**Schedule builder** puts real sections on a week so you can see clashes before you register. **Seat watch** tells you when a full section opens. **Costs** prices the term.',
      },

      {
        note: 'Every section has its own link. Copy the address bar and you are sending someone to exactly the section you are looking at, not the top of the Planner.',
      },
    ],
  },

  'my-record': {
    title: 'My record',
    section: 'Planner',
    description:
      'Add the Concordia courses you have already passed so ConcordiaTracker can work out your credits, your GPA, and which courses you are eligible to take.',
    blocks: [
      {
        p: 'Your record is the list of courses you have finished. Almost everything else in the Planner depends on it: prerequisite checks, degree progress, and the eligibility filter in the schedule builder all read from it.',
      },

      { h2: 'Adding courses' },
      {
        p: 'Add them one at a time, or paste your transcript and let the app read it. Pasting shows you every row it found next to the line of text it came from, and nothing is saved until you have checked it. Rows it could not place a term for are held back rather than guessed at.',
      },
      { p: 'Grades are optional. A course without one still counts toward your credits and still satisfies prerequisites; it just does not affect the GPA.' },

      { h2: 'Marking it complete' },
      {
        p: 'When your record is complete, say so. Until you do, nothing in the app will tell you that you are missing a prerequisite, because telling somebody they lack a course they took two years ago is worse than staying quiet.',
      },

      { h2: 'Past and future terms' },
      {
        p: 'Terms that have already happened are editable at any time, including grades and notations like FNS. Repeated courses follow Concordia’s rule for which attempt counts.',
      },
    ],
  },

  'my-programme': {
    title: 'My programme',
    section: 'Planner',
    description:
      'See how far through your Concordia degree you are: which required courses you have cleared, what is left, and how many credits are still unaccounted for.',
    blocks: [
      {
        p: 'Pick your programme and this measures your record against the requirements published in Concordia’s undergraduate calendar.',
      },

      { h2: 'What it counts exactly' },
      {
        p: 'Requirement groups that name their courses, like the Computer Science Core or the JMSB Core, are ticked off precisely. Every course shows as done or outstanding, with the credit value the calendar gives it.',
      },

      { h2: 'What it deliberately does not count' },
      {
        p: 'Elective requirements are rules, not lists: "14 credits chosen from Computer Science courses at the 300 level or above, subject to exclusions". Those are shown in the calendar’s own words and counted at zero.',
      },
      {
        note: 'This is on purpose. A tool that guessed at those rules would eventually tell somebody they could graduate when they could not, and that is the most expensive mistake this app could make.',
      },
      {
        p: 'What fills the gap is a figure that is a fact rather than a guess: credits you have passed that no named requirement has claimed. Those almost certainly go toward your electives, and an advisor would start from the same number.',
      },

      { h2: 'Checking it' },
      {
        p: 'Each programme shows the calendar year it was transcribed from and links to the page it came from. Requirements change; the year tells you whether this one has.',
      },
      { p: 'Programmes are added by hand, one at a time. If yours is not listed yet, ask and it can be.' },
    ],
  },

  'course-directory': {
    title: 'Course directory',
    section: 'Planner',
    description:
      'Search every course in Concordia’s calendar by code or name, with credits, prerequisites and descriptions.',
    blocks: [
      {
        p: 'The directory mirrors Concordia’s published course calendar: every subject, every course, searchable by code or by words in the title.',
      },

      { h2: 'What a course shows' },
      {
        p: 'The code, the title, the credit value, the prerequisite text exactly as the calendar words it, and the description where one has been published. Expanding a course pulls the course codes out of its prerequisite sentence so you can follow the chain.',
      },

      { h2: 'Prerequisite colouring' },
      {
        p: 'Once your record is marked complete, prerequisite codes are marked as met or outstanding against it. Where the wording is a rule the app cannot read, like "18 credits in the programme", it says so instead of guessing.',
      },

      { h2: 'Saving for later' },
      { p: 'Anything can be saved to your shortlist, which lives in the Saved section with room for notes and a planned term.' },

      { h2: 'How fresh it is' },
      { p: 'The mirror is refreshed on a schedule and the page states when it last ran. Registration always goes through the Student Centre.' },
    ],
  },

  prerequisites: {
    title: 'Prerequisite tree',
    section: 'Planner',
    description:
      'See what a Concordia course requires, all the way down, and what taking it would unlock.',
    blocks: [
      {
        p: 'Two views of the same question, because the two questions are different.',
      },

      { h2: 'Board' },
      {
        p: 'A course library on the left and a canvas on the right. Drag a course onto the board and it brings in what it requires above it and what it unlocks below, so one drag gives you a chain rather than a single card. Cards can be moved, zoomed, and tidied back into rows.',
      },
      {
        p: 'An arrow between two cards means Concordia’s calendar names the upper course inside the lower one’s prerequisite. Where the wording is a rule that cannot be read as a course code, no arrow is drawn rather than a wrong one.',
      },

      { h2: 'List' },
      {
        p: 'Pick one course and see its full requirement chain as an indented list, with what you have already cleared marked off, plus every course that names it as a prerequisite.',
      },

      {
        note: 'Meeting a prerequisite is not the only condition a course can carry. Standing, programme and permission requirements exist too, and the department is the authority.',
      },
    ],
  },

  'schedule-builder': {
    title: 'Schedule builder',
    section: 'Planner',
    description:
      'Build a Concordia timetable from real sections, see clashes and campus gaps before you register, and save or share drafts.',
    blocks: [
      {
        p: 'Search a course, pick a section, and it lands on a week. The point is to find the problems before registration rather than during it.',
      },

      { h2: 'Finding sections' },
      {
        p: 'Typing suggests courses by name from the calendar; picking one then looks up its real sections, with meeting times, rooms and how many seats are open.',
      },

      { h2: 'What it warns about' },
      {
        p: 'Two classes at the same time. Back-to-back classes on opposite campuses, where the shuttle will not get you there. Sections that fall inside time you have blocked out.',
      },

      { h2: 'Blocking out time' },
      {
        p: 'Drag down a column to block hours you work, commute or sleep, or type one in Filters (day, from, to). Right-click a block to remove it. Sections that clash get marked in the search rather than hidden, so it stays your call.',
      },

      { h2: 'Filters' },
      {
        p: 'Term, "only what I can take", and blocked time all narrow the same thing, so they sit behind one control with a count of how many are active.',
      },

      { h2: 'Saving, printing, sharing' },
      {
        p: 'Keep as many drafts as you like. Print produces a clean sheet with the week and the class list including rooms. Share creates a read-only link that shows the timetable without touching your account.',
      },

      {
        note: 'A schedule here is a plan, not a registration. Seat counts were read when you added the section and change constantly. Register in the Student Centre.',
      },
    ],
  },

  'seat-watch': {
    title: 'Seat watch',
    section: 'Planner',
    description:
      'Get told the moment a full Concordia section opens up, with the class number ready to paste into the Student Centre.',
    blocks: [
      {
        p: 'Pick a section that is full and the app checks it for you. When a seat appears you get a notification, and the app keeps telling you until you have acknowledged it, so an opening at three in the morning is still in front of you at nine.',
      },

      { h2: 'What the alert gives you' },
      {
        p: 'The class number first, with a copy button, because that is exactly what the Student Centre’s enrolment box asks for. Registration itself happens there; the app cannot enrol you.',
      },

      { h2: 'Waitlists and reserved seats' },
      {
        p: 'Where a section has a waitlist, its depth is shown: an open seat behind forty people waiting is not the same as an open seat. Some sections also hold seats back for particular programmes, and the alert says so when that applies.',
      },

      { h2: 'Limits' },
      { p: 'Free accounts can watch a small number of sections at once. The Semester pass raises the limit.' },
    ],
  },

  radar: {
    title: 'Radar',
    section: 'Planner',
    description:
      'An automatic check on your Concordia semester: crunch weeks, closing drop deadlines, and courses the marks can no longer save.',
    blocks: [
      {
        p: 'Today shows what is due. The calendar shows when. Radar is the one that says whether the term ahead is survivable, which needs every course added together, so nothing else in the app can answer it.',
      },
      {
        p: 'It runs every time you open it, against your own account. Nothing is sent anywhere and nothing it finds changes your registration.',
      },

      { h2: 'What it checks' },
      {
        p: '**Course load**: whether you have dropped under the 12 credits Concordia counts as full time, which affects loans, bursaries and some insurance.',
      },
      {
        p: '**Crunch weeks**: weeks where a large share of your grade lands at once, summed across every course rather than one at a time.',
      },
      { p: '**Same-day collisions**: two or more heavy things due on one day, in different courses.' },
      { p: '**Courses at risk**: where the marks left can no longer realistically reach a C.' },
      { p: '**Registrar deadlines**: add, drop and withdrawal windows closing in the next three weeks.' },
      { p: '**Grades that may block you**: finished courses below C-, which some programmes require you to repeat.' },
      { p: '**Dates worth double-checking**: upcoming dates nobody has confirmed.' },
      { p: '**Blind spots**: courses with no outline, which nothing above can see into.' },

      { h2: 'Seeing the whole sweep' },
      {
        p: 'Every check is listed with its state whether or not it found anything: found something, clear, or waiting on data. A check that cannot run says what it needs. A quiet page means nine things were looked at, not that nothing was.',
      },

      { h2: 'Why am I seeing this?' },
      {
        p: 'Every warning will show you the basis for its claim. A warning you cannot check is a warning you learn to ignore.',
      },

      { h2: 'The shape of your term' },
      {
        p: 'One bar per week, as tall as the share of your final grades landing in it. Tap a bar for what is in it.',
      },
      {
        p: 'Switching a course off re-runs every check without it, so you can see the term you would have if you dropped it, including what dropping it would cost, like falling under full time. Nothing is written to your account; it is a question, not an action.',
      },

      {
        note: 'Radar reads what you have already told the app. It cannot see a course you have not added or an outline you have not imported, and it is not advice: for anything touching your registration, your loan or your graduation, the department is the authority.',
      },
    ],
  },

  costs: {
    title: 'Costs',
    section: 'Planner',
    description:
      'What a Concordia term costs at the published rates, worked out from the credits you are registered for, and what a course is worth if you are deciding whether to keep it.',
    blocks: [
      {
        p: 'Concordia publishes its tuition rates and publishes its refund deadlines, and never puts the two together. This does.',
      },
      { p: 'Costs is part of the Semester pass.' },

      { h2: 'What it works out' },
      {
        p: 'Tuition at the rate for your fee status, plus every compulsory fee: administrative, student services, recreation, technology, copyright, your faculty’s student association, registration, and the rest. Each line shows its own arithmetic (rate times credits), so you can reconcile it against a real invoice instead of taking a total on trust.',
      },

      { h2: 'What a course is worth' },
      {
        p: 'Everything that scales with your load is added up separately, because that is the only figure that answers "what does dropping save". Each of your courses is then priced at its own credit count, next to the refund deadline.',
      },

      { h2: 'The health plan' },
      {
        p: 'The health and dental plan is billed once in the fall and covers the year. It is the one compulsory fee you can get back: if you are already covered elsewhere you can opt out through the student union, but the window closes early in the term and does not reopen.',
      },

      {
        note: 'This is an estimate at the published rates, not a bill. It does not know about bursaries, exemptions, late penalties or anything specific to your file. The Birks Student Service Centre is the only authority on what you owe.',
      },
    ],
  },

  /* -- Developers ---------------------------------------------------------- */

  api: {
    title: 'API reference',
    section: 'Developers',
    description:
      'The ConcordiaTracker HTTP API: API tokens, the owner statistics endpoints, the personal '
      + 'course and grade endpoints, the open course section endpoint, and JSON error codes.',
    blocks: [
      {
        p: 'ConcordiaTracker exposes a small HTTP API. Most of it backs the web app and needs a signed-in user, but one endpoint is open to anyone and is the useful one for an automated client: live section, meeting-time, and seat data for any Concordia course.',
      },
      {
        note: 'The machine-readable description lives at [/openapi.json](/openapi.json). It is OpenAPI 3.1, and every operation has a unique operationId, typed parameters, and a response schema, so it converts straight into tool definitions for an LLM function-calling runtime.',
      },

      { h2: 'Base URL' },
      { p: 'Every endpoint is under `https://concordiatracker.com/api/`. Every response, including every error, is JSON.' },

      { h2: 'Course sections (no authentication)' },
      {
        p: '`GET /api/sections?subject=COMP&catalog=248` returns every published section of that course for the terms Concordia currently lists, newest first.',
      },
      {
        ul: [
          '`subject`: two to six letters, case-insensitive. For example `COMP`.',
          '`catalog`: two to four digits with an optional trailing letter. For example `248`.',
        ],
      },
      {
        p: 'Each section carries `classNumber` (the value Concordia’s Student Centre asks for when you enrol), `termCode`, `section`, `component`, `meetingTimes`, `building`, `room`, `instructionMode`, and live `enrolled`, `capacity`, `waitlisted`, and `waitlistCap` counts. `hasReserved` is true when some seats are held for particular programmes, which is why an apparently open section can still refuse you.',
      },

      { h2: 'Authentication' },
      {
        p: 'The web app authenticates with a Supabase access token, which expires in an hour and is minted by a browser sign-in. That is no use to a script, a cron job, or an agent, so anything unattended uses an API token instead: long-lived, named, revocable one at a time, and scoped narrower than a session.',
      },
      {
        p: 'Send it the same way: `Authorization: Bearer <token>`. There are four scopes and a token can never widen its own.',
      },
      {
        ul: [
          '`ct_owner_…`: business statistics under `/api/v1/owner`. Created by an admin in the console. It reads counts and revenue and can never read an individual account.',
          '`ct_per_…`: your own data under `/api/v1/me`. Created by you in Settings → Developer. It can only ever see and edit your account. Older keys start `ct_pat_` and still work.',
          '`ct_sup_…`: the support desk under `/api/v1/support`. Created by an admin. It reads and answers support conversations and nothing else.',
          '`ct_adm_…`: everything the admin console shows, under `/api/v1/admin`, plus managing student organisations under `/api/v1/orgs`. Created by an admin. The widest key here by a distance.',
        ],
      },
      {
        note: 'An admin token can publish content on behalf of any organisation, and every write it makes is recorded in the audit log, marked as made on the club’s behalf when the account is not on that club’s team. What it cannot do is enforced by the database rather than by the endpoint: it cannot add itself to an existing club’s team, and deleting an organisation or removing a teammate is not reachable through the API at all.',
      },
      {
        note: 'A token is shown once, when it is created, and cannot be retrieved afterwards. Only its SHA-256 hash is stored, so a database dump is not a set of live credentials. If you lose one, the answer is to revoke it and make another. Revoking takes effect immediately.',
      },
      {
        p: 'Each token is limited to 120 requests a minute. Going over returns `rate_limited` with a `Retry-After` header, which is a different answer from `unauthorized`: a client that cannot tell them apart will either retry forever or give up on a token that is perfectly good.',
      },

      { h2: 'Owner API: how the business is doing' },
      {
        p: 'Four read-only endpoints, for a dashboard or an agent. Every response carries `generated_at`, `timezone: "UTC"`, and a `notes` array naming anything that makes the figures less than complete: Stripe paging, test mode, a missing key, or how far back visitor tracking actually goes.',
      },
      {
        ul: [
          '`GET /api/v1/owner/overview`: users, engagement, support load and revenue in one call.',
          '`GET /api/v1/owner/users`: cohorts (new, active, comped) and breakdowns by school and programme.',
          '`GET /api/v1/owner/payments`: revenue read live from Stripe.',
          '`GET /api/v1/owner/timeseries?days=30`: daily signups, visitors, active users and page views.',
        ],
      },
      {
        p: 'The definitions are fixed and worth knowing, because the same words mean different things in different dashboards. A **paying customer** has been charged more than $0 and the charge settled. A trial is not a paying customer. A comped account is counted as a user and never as paying. Internal and test accounts are excluded from every figure except the one that counts them. **MRR** comes only from subscriptions that have actually been charged, and **ARR** is labelled an estimate because it is one month multiplied by twelve, not a year of observed revenue.',
      },
      {
        note: '`/owner/users` returns counts and never identities: no names, no emails, no user ids. A long-lived token sitting in a cron job is a looser credential than a session, so the worst a leaked one can do is reveal how the business is doing, not export the user table.',
      },
      {
        p: 'Amounts are in **cents**, so `mrr_cents: 375` is $3.75. Timestamps are ISO-8601 in UTC, always. A dashboard in another timezone silently shifting a day is the classic wrong answer nobody notices.',
      },

      { h2: 'Personal API: your own courses and grades' },
      {
        ul: [
          '`GET /api/v1/me/courses`: your classes. `?archived=true` for finished ones.',
          '`GET /api/v1/me/assignments`: every deadline with its weight and status. Filter with `course_id`, `status`, or `upcoming=true`.',
          '`PATCH /api/v1/me/assignments/{id}`: change status, grade or notes.',
          '`GET /api/v1/me/gpa`: your standing, per course and overall.',
        ],
      },
      {
        p: 'A PATCH body takes any of `status`, `notes`, and `grade`. A grade is either `{"percent": 87}` or `{"earned": 17, "total": 20}`, and `null` clears it. The response returns the assessment as it now stands, so nothing has to guess whether the write landed.',
      },
      {
        p: 'Those three fields are the whole write surface, deliberately. A token cannot change a weight, move a date, or set provenance: a weight edited by a script is a grade computed from a number nobody checked, and provenance is a claim about where a date came from that a script cannot honestly make.',
      },
      {
        p: 'Two things the responses are careful about. An assessment with no date returns `due: null` rather than today. An outline that says the Examinations Office will set the date has not given us one, and inventing it would put a made-up deadline on the highest-stakes item you have. And `/me/gpa` averages over the weight graded **so far**, returning that denominator as `graded_weight`, so a term two assessments in is not reported as though the ungraded 80% were zeros.',
      },

      { h2: 'Errors' },
      {
        p: 'Every failure returns the same shape, so one parser handles all of them: `error` (the human message, kept for older clients), `code`, `message`, `hint`, `status`, and `docs`.',
      },
      {
        p: '`code` is stable and safe to branch on. The values are `bad_request`, `unauthorized`, `forbidden`, `not_found`, `method_not_allowed`, `conflict`, `rate_limited`, `not_configured`, `upstream_error`, and `internal_error`.',
      },
      {
        p: 'An unknown path under `/api/` returns a JSON `not_found`, never an HTML error page. An unknown path anywhere else on the site returns a real HTTP 404 with a short body pointing at the sitemap, llms.txt, and this reference.',
      },

      { h2: 'Markdown content negotiation' },
      {
        p: 'The homepage, every documentation page, and the About, Contact, and Developers pages are available as markdown. Send `Accept: text/markdown` and you get markdown back, with `Vary: Accept` set so a shared cache cannot hand you the wrong variant.',
      },

      { h2: 'Rate limits and etiquette' },
      {
        p: 'There is no published quota on the sections endpoint, but it proxies Concordia’s own directory: cache what you fetch, do not poll in a tight loop, and identify your client with a `User-Agent`. Ticket creation is rate limited per IP address. If you are building something that needs more than casual use, get in touch first.',
      },

      { h2: 'For AI agents' },
      {
        p: 'Start from [llms.txt](/llms.txt). It carries a "when to use this" section naming the questions this site can answer well (course content, prerequisites, section times and seats, Concordia’s GPA scale, tuition rates, registrar deadlines) and states plainly what it cannot answer, namely anything about an individual student’s private record.',
      },

      {
        cards: [
          {
            icon: 'book',
            title: 'OpenAPI specification',
            desc: 'The full machine-readable description of every endpoint.',
            href: '/openapi.json',
          },
          {
            icon: 'check',
            title: 'Developer overview',
            desc: 'The same material with runnable examples, outside the docs shell.',
            href: '/developers',
          },
        ],
      },
    ],
  },

  /* ── Community ─────────────────────────────────────────────────────────── */

  community: {
    title: 'Community',
    section: 'Community',
    description:
      'Community is where Concordia student clubs and organizations publish events, posts and stories, and where you follow them, message people, and keep your profile.',
    blocks: [
      {
        p: 'Community answers a different question from the rest of the app: what is happening around you that is not your own coursework. It has four sections: **Feed**, **Events**, **Messages**, and **You**.',
      },
      {
        note: 'Only approved organizations publish here. Students follow, react, comment and message, but there is no student posting: it is a campus noticeboard with a conversation attached, not a place to broadcast yourself.',
      },

      { h2: 'Feed' },
      {
        p: 'The Feed is everything organizations have published, newest first, with the clubs you follow leading. It mixes their **posts** (a picture, a set of pictures, or a short video, with a caption) and their **events**. Stories from clubs sit in a row at the top and disappear after one to three days.',
      },
      {
        p: 'On a post you can like it, comment (and reply to a comment), repost it to your profile, or send it to someone. Anything you have already scrolled past moves below a **You are all caught up** line on that device, so the new things are always first; nothing is removed.',
      },

      { h2: 'Events' },
      {
        p: 'Events lists the same events by when they **start**, grouped into this week and later. Each shows its host, category, date and time, whether it is in person or online, and where. Filter by category, or switch on **For my program** to show only events tagged for what you study, matched against the program on your profile.',
      },
      {
        p: 'Opening an event shows the full description, location, and host. From there you can add it to your calendar in one tap (it lands on your personal layer), set a reminder, or share it. Shared links open a public page that **anyone can view without an account**.',
      },

      { h2: 'Clubs and organizations' },
      {
        p: 'Every organization has a profile with its bio, links, events, posts, and reposts. A blue seal marks a verified organization: an account confirmed as genuinely representing that group. Following one puts its posts and events first in your Feed, and you get a notification when it publishes a new post.',
      },
      {
        p: 'You can also message a club from its profile, and its team answers from their organizer inbox. A club can only start a conversation with you if you follow it and have not switched club messages off.',
      },
      {
        p: 'Running a club? Apply at [concordiatracker.com/organizer/apply](/organizer/apply). See [Setting up your organization](/docs/organizer-setup).',
      },

      { h2: 'People and messages' },
      {
        p: 'You follow people the same way you follow clubs. When two people follow each other they are connected, which is what lets you send each other messages freely and, if you choose, share your class schedule. Someone you are not connected to can send you one first message, without links, which you can answer or ignore. Settings let you limit who can message you.',
      },
      {
        p: 'Messages also holds your conversations with clubs and your support tickets, each in its own filter.',
      },

      { h2: 'Your profile' },
      {
        p: '**You** is your own profile, exactly as others see it, with an edit button. Your profile is **private by default**: until you make it public in Settings → Privacy, it does not appear in search.',
      },
      {
        note: 'Follower and following **counts and lists** can be opened from a profile. Your grades are never on your profile or anywhere else another person can see.',
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
        p: 'Most of ConcordiaTracker is free forever. The paid tier covers projection, your deadlines in an outside calendar, and a few extras.',
      },

      { h2: 'What each plan includes' },
      {
        table: {
          head: ['', 'Free', 'Semester pass'],
          rows: [
            ['Courses tracked', 'Unlimited', 'Unlimited'],
            ['Deadline tracking and calendar', 'Yes', 'Yes'],
            ['Moodle sync', 'Yes', 'Yes'],
            ['Community and messages', 'Yes', 'Yes'],
            ['Grade entry and course standing', 'Yes', 'Yes'],
            ['Grade-needed calculator', 'Yes', 'Yes'],
            ['Syllabus scans', '5 a month', 'No monthly cap'],
            ['Seat watches at once', '1', '25'],
            ['GPA projection (what-if)', 'No', 'Yes'],
            ['Calendar feed for Google, Apple or Outlook', 'No', 'Yes'],
            ['Term cost estimates (Planner)', 'No', 'Yes'],
            ['Themes', 'Dark and Light', 'Every theme, including a custom colour'],
          ],
        },
      },

      { h2: 'Price' },
      {
        p: 'All prices are in **Canadian dollars** and are the same for everyone: no currency conversion at checkout.',
      },
      {
        ul: [
          '**Semester pass: $15 CAD**, renewing every four months, which is the length of a Concordia term.',
          '**Monthly: $5 CAD**, renewing monthly.',
        ],
      },
      {
        p: 'The Semester pass works out cheaper across a full year. Both unlock exactly the same features; the difference is only the billing period.',
      },

      { h2: 'Free trial' },
      {
        p: 'Every plan starts with a **3-day free trial**. A card is required to start it, nothing is charged until the trial ends, and cancelling before then costs nothing.',
      },
      { p: 'We send a notification before the trial ends and the first charge is taken, so it is never a surprise.' },

      { h2: 'Switching plans' },
      {
        p: 'Switching from monthly to the Semester pass carries your remaining paid days across: you are never charged twice for the same period.',
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
        p: 'Choose a plan in Settings → Billing and complete checkout in place: no redirect to another site. Your plan activates immediately, starting with the [free trial](/docs/plans).',
      },

      { h2: 'Auto-renewal' },
      {
        note: 'Subscriptions **renew automatically** at the end of each period: every four months for the Semester pass, monthly for the monthly plan: until you cancel. This is stated at checkout and in Settings → Billing.',
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
        p: 'If something went wrong with a charge, email [concordiatracker@gmail.com](mailto:concordiatracker@gmail.com) from the address on the account. Please write before disputing a charge with your bank: a dispute is slower for you and costly for us, and almost everything can be sorted out directly.',
      },
    ],
  },

  settings: {
    title: 'Settings',
    section: 'Account & billing',
    description:
      'ConcordiaTracker settings: themes, language, notifications, account details, and usage.',
    blocks: [
      {
        p: 'Settings opens as a panel over whatever you are doing, from the gear beside your profile or the profile menu.',
      },

      { h2: 'General' },
      {
        p: 'Themes, language, push notifications, motion, and update notes.',
      },
      {
        p: '**Dark** and **Light** are free. The Semester pass adds Concordia Maroon, Purple Dark, Light Rose, and a custom theme built from a colour you pick; a locked theme can be tried on for two minutes before you decide. Language is English or French, and switching updates the whole interface including dates.',
      },

      { h2: 'Account' },
      {
        p: 'Display name, handle, school or faculty, and program, plus the sign-in methods on your account (Google, Apple, email). Program feeds the relevance filter in Community. Deleting your account is also here, and it is permanent.',
      },

      { h2: 'Calendar sync' },
      { p: 'The private calendar feed for Google, Apple or Outlook. See [Google and Apple Calendar](/docs/calendar-sync).' },

      { h2: 'Moodle' },
      { p: 'Connect, re-sync or disconnect your Moodle calendar. See [Connect Moodle](/docs/moodle-sync).' },

      { h2: 'Privacy' },
      {
        p: 'The public profile switch, who can message you, whether clubs you follow can message you first, schedule sharing, and links to the legal documents and your data rights. See [Privacy](/docs/privacy).',
      },

      { h2: 'Billing' },
      { p: 'Your plan, renewal date, invoices, and card. See [Billing](/docs/billing).' },

      { h2: 'Usage' },
      {
        p: 'What you have used this month against your plan’s limits, such as syllabus scans, and which features are locked.',
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
          'A course **outline** you contribute as a blueprint: assessments, dates, and weights, with no grades attached.',
          'Your profile, if you switch it to public. Private is the default, and a private profile does not appear in search.',
          'Who you follow and who follows you. Follower and following lists can be opened from a profile.',
          'Your class schedule, only to the people you allow in Settings → Privacy.',
          'Messages, comments, likes and reposts you send, to the people and clubs involved.',
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
          'We never ask for your Moodle, eConcordia or Concordia password, and never connect to your student record. Moodle sync uses only the read-only calendar link you choose to paste in, and it is stored where the app itself cannot read it back.',
          'Club organizers never see which students viewed, followed or added their events: only totals.',
        ],
      },
    ],
  },

  /* ── Portals ───────────────────────────────────────────────────────────── */


  'teacher-setup': {
    title: 'Setting up your teacher account',
    section: 'For teachers',
    description:
      'Step-by-step: request access to the ConcordiaTracker teacher portal, accept your invitation, and link your courses.',
    blocks: [
      {
        p: 'A walkthrough from having no account to being ready to publish. It takes a few minutes once your invitation arrives.',
      },

      { h2: '1. Request access' },
      {
        p: 'Go to [concordiatracker.com/teacher/request](/teacher/request) and fill in your name, your Concordia email, and what you teach. Use your university address: it is how we confirm you are faculty.',
      },
      {
        p: 'You will get a **case number** back, something like `REQ-1043`. Keep it: the same page has a **Check a request** tab where you can enter it to see where your request stands.',
      },

      { h2: '2. Accept your invitation' },
      {
        p: 'Once approved you receive an invitation link. It is **single-use, tied to your email, and expires**, so open it on a device you can finish setting up on.',
      },
      {
        p: 'The link shows the course it was issued for and asks you to confirm your email. Accepting creates your account and signs you in.',
      },
      {
        note: 'A new account starts as **pending**. You can build an outline straight away, but publishing and posting stay disabled until an administrator approves you. This is a one-time check.',
      },

      { h2: '3. Find your way around' },
      {
        p: 'The teacher portal has its own layout: a sidebar of your courses, each expanding to its own sections. It is deliberately plainer than the student app; it is a publishing tool, not a dashboard.',
      },

      { h2: '4. Link your courses' },
      {
        p: 'Your first course is usually attached to your invitation. To add more, use **Link a course**, search the catalog by code, and pick your section from the chips shown. If a course is not listed, you can create it.',
      },
      {
        p: 'Sections matter: students see the outline for **their** section, so link the specific ones you teach rather than the course as a whole.',
      },

      { h2: '5. Fill in the course details' },
      {
        p: 'Set the instructor name, TA, meeting times, office hours, location, credits, and a syllabus link. Students see all of it on the course page, and **Preview as student** shows you exactly what they see.',
      },
      {
        p: 'Credits are worth getting right: they weight the course in every student’s GPA.',
      },

      {
        cards: [
          {
            icon: 'upload',
            title: 'Publish your first outline',
            desc: 'Get your dates in front of students, verified.',
            href: '/docs/teacher-first-outline',
          },
          {
            icon: 'book',
            title: 'Teacher portal reference',
            desc: 'What the portal does, and what it deliberately does not show.',
            href: '/docs/teacher-portal',
          },
        ],
      },
    ],
  },

  'teacher-first-outline': {
    title: 'Publishing your first outline',
    section: 'For teachers',
    description:
      'How to build, preview, and publish a course outline so your students import verified dates, and how to post announcements.',
    blocks: [
      {
        p: 'Publishing an outline is the highest-value thing you can do here. It replaces every student in your section separately transcribing your syllabus: and it makes their dates **official** instead of guesses.',
      },

      { h2: '1. Build the outline' },
      { p: 'Two ways, and you can mix them:' },
      {
        ul: [
          '**Upload your syllabus**: the PDF is read for you and the assessments, dates, and weights are filled in.',
          '**Enter it manually**: add a row at a time with a kind, title, due date, and weight.',
        ],
      },
      {
        p: 'A running total shows whether the weights reach 100%. It is the fastest way to catch a missing item.',
      },

      { h2: '2. Adopt a student outline instead' },
      {
        p: 'If students in your section have already uploaded one, the community blueprints panel lists them. Expand **Review** to see the full dated list first: never verify one blind.',
      },
      {
        p: 'Adopting it makes it your outline and promotes its dates to **official**, pinned above the community uploads. It is often faster than starting from scratch, since a student has usually already done the transcription.',
      },

      { h2: '3. Preview as a student' },
      {
        p: '**Preview as student** opens the real course view your students will see: the same components, filled with your outline. Check the dates and weights here before publishing.',
      },

      { h2: '4. Publish' },
      {
        p: 'Publishing makes your outline the **teacher-verified blueprint** for that course and section. It is pinned above community uploads, and students who import it get dates marked official.',
      },
      {
        note: 'Publishing is **live**. Editing a published outline updates what students see immediately: there is no separate draft-then-release step. Get it right in preview first.',
      },

      { h2: '5. Post an announcement' },
      {
        p: 'The announcement composer posts to every student enrolled in that course. It appears on their Today screen and on the course page, with the date it was posted.',
      },
      {
        p: 'Announcements can be edited or deleted afterwards, and an edit is visibly marked as edited: so a corrected deadline never looks like it was always that way.',
      },

      { h2: 'What students cannot see' },
      {
        p: 'Nothing about you beyond what you publish. And you see nothing about them: no grades, no standings, no who-imported-what. The portal is publish-only by design.',
      },
    ],
  },

  'organizer-setup': {
    title: 'Setting up your organization',
    section: 'For organizations',
    description:
      'Step-by-step: apply to list your club on ConcordiaTracker, set up your public profile, and bring your team in.',
    blocks: [
      {
        p: 'From no account to a public profile students can follow. Worth doing properly once: your profile is what every event and post you publish is attached to.',
      },

      { h2: '1. Apply' },
      {
        p: 'Go to [concordiatracker.com/organizer/apply](/organizer/apply) and sign in with the account you will run the club from (Google, Apple, or email). Then answer a few questions: the club’s name and handle, what it does, what it mostly posts, roughly how many members it has, your role, a contact email, and optionally a link that shows it is really you, such as an Instagram page.',
      },
      {
        p: 'Your organizer dashboard opens as soon as you submit, so you can set up the profile and draft events straight away.',
      },
      {
        note: 'A new club starts **pending**. Nothing you publish reaches students until an administrator approves the club; approval gates publication, not setup.',
      },
      {
        p: 'If we sent you an invitation link instead, open it: it either sets up a new club with you as its owner or hands you a profile we have already prepared, and you review everything before it is yours.',
      },

      { h2: '2. The setup walkthrough' },
      {
        p: 'The first time you open the dashboard, a short walkthrough asks whether you are the president (if not, you keep full access and invite them as an owner alongside you), then your handle, profile, a first event, and your team. Every step can be skipped and picked up later.',
      },

      { h2: '3. Your public profile' },
      {
        p: 'Profile is the most important screen in the portal. Students judge whether to follow you from it, and your brand colour carries through the feed so your events are recognisably yours.',
      },
      {
        ul: [
          '**Name and handle**: the handle is your address on the site, so pick it deliberately.',
          '**Bio**: a few lines on who you are and what you run. It can hold links.',
          '**Logo and banner**: uploaded from your device and cropped to the exact shape they appear in. The logo appears on every event card; the banner heads your profile.',
          '**Brand colour**: used for your event cards when an event has no image of its own.',
          '**Links**: website, Instagram, X, LinkedIn, each with an optional title. Only the ones you fill in are shown.',
        ],
      },
      {
        p: 'A live preview, drawn with the same component students see, updates as you type.',
      },

      { h2: '4. Get verified' },
      {
        p: 'Verified organizations show a blue seal, which tells students the account genuinely represents your group. Verification is granted by an administrator: reach out once your profile is filled in.',
      },

      { h2: '5. Bring your team in' },
      {
        p: 'From **Team**, invite someone who already has an account by name or handle, or anyone by email, and choose their role. An email invitation is a link you can also send however you like.',
      },
      {
        p: '**Roles** decide what each person can do (post, publish events, edit the profile, manage the team), and you can create your own. **Activity** records every change to the club with who made it, and most changes can be undone from there.',
      },
      {
        p: 'This matters more than it looks for student groups: when your executive turns over, remove the outgoing members, invite the incoming ones, and hand ownership over. The account, followers, and history carry on.',
      },

      {
        cards: [
          {
            icon: 'calendar',
            title: 'Publish your first event',
            desc: 'Write it, preview it, and get it into the feed.',
            href: '/docs/organizer-first-event',
          },
          {
            icon: 'users',
            title: 'Organizer portal reference',
            desc: 'What the portal does and what the metrics can show.',
            href: '/docs/organizer-portal',
          },
        ],
      },
    ],
  },

  'organizer-first-event': {
    title: 'Publishing your first event',
    section: 'For organizations',
    description:
      'How to create, preview, and publish a campus event to the ConcordiaTracker Community feed, and share it off-platform.',
    blocks: [
      {
        p: 'Events are the point of the portal. Each one lands in the Community feed, gets its own shareable public page, and can be added to a student’s calendar in one tap.',
      },

      { h2: '1. Create the event' },
      { p: 'From **Events** in the portal, start a new event. Every new event begins as a **private draft** that only your team can see. Fill in:' },
      {
        ul: [
          '**Title**: specific beats clever. Students scan the feed quickly.',
          '**Date and time**: pick both; the time drives where it lands in the day.',
          '**Mode**: in person or online. In-person events show a location; online ones show joining details.',
          '**Location**: the building and room, or the platform.',
          '**Description**: what it is, who it is for, and whether newcomers are welcome.',
          '**Category**: clubs, career, academic, or official. This drives the feed filters.',
          '**Banner image**: optional. Without one your card uses your brand colour and initials, which still looks intentional.',
          '**Relevant programs**: optional. Tagging programs makes the event show for students in them under **For my program**.',
        ],
      },

      { h2: '2. Preview it' },
      {
        p: 'The editor shows a live student-eye preview of the card as you type. Check the title is not truncating and the banner is not cropping badly.',
      },

      { h2: '3. Publish' },
      {
        p: '**Save draft** keeps it private; **Publish** puts it in the Community feed and on your public profile (for a pending club, once you are approved). Every event also gets a **public link that anyone can open without an account**: paste it into Instagram, a group chat, or a poster QR code.',
      },

      { h2: '4. Post about it' },
      {
        p: 'If the event has a banner image, you can also share it to the Feed as a post. Your followers get a notification when your club publishes a new post, so use posts deliberately: a group that posts constantly gets unfollowed.',
      },

      { h2: '5. See how you are doing' },
      {
        p: '**Insights** shows your followers, your posts, the events you have published, and how many are still to come.',
      },
      {
        note: 'Figures are **aggregate only**. You can never see which individual students viewed, followed, or added an event, and there is no tier that changes that. Per-event reach (views and calendar adds) is not measured yet, and the page says so rather than showing a zero.',
      },
    ],
  },

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
        p: 'If students in your section have already uploaded an outline, you can review it and adopt it as your own. It becomes your verified outline with its dates promoted to official, pinned above the community uploads.',
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
        p: 'The organizer portal is for student associations, clubs, and university offices publishing to the Community tab.',
      },

      { h2: 'Getting access' },
      {
        p: 'Apply at [concordiatracker.com/organizer/apply](/organizer/apply), or open an invitation link if we sent you one. Applying opens your dashboard immediately; the club is **pending** until an administrator approves it, and nothing reaches students before then.',
      },

      { h2: 'Publishing' },
      {
        p: '**Events** carry a title, date and time, whether they are in person or online, location, description, category, a banner image, and the programs they are relevant to. Every event gets a public link that anyone can open without an account, which makes it shareable on social media.',
      },
      {
        p: '**Posts** are a picture, a set of pictures, or a short video with a caption, and they notify your followers. **Stories** stay up for one to three days. Posts and stories can be saved as drafts for your team to finish, and two clubs can co-author a post so it appears on both profiles.',
      },

      { h2: 'Inbox' },
      {
        p: 'Students can message your club from its profile, and anyone on your team with access can reply. A club can only start a conversation with a student who follows it and has not switched club messages off.',
      },

      { h2: 'Your public profile' },
      {
        p: 'Set your name, handle, bio, logo, banner, brand colour, and links. Your brand colour carries through the feed, so your events are recognisably yours. Verified organizations show a seal.',
      },

      { h2: 'Insights' },
      {
        p: 'Aggregate numbers: followers, posts, events published, and events still to come.',
      },
      {
        note: 'Figures are **aggregate only**. Organizers can never see which individual students viewed, followed, or added an event. Students are frequently minors and always covered by Quebec privacy law, and there is no version of this feature that identifies them.',
      },

      { h2: 'Your team' },
      {
        p: 'Invite people by account or by email, give each a role, create custom roles with their own permissions, and hand ownership over when your executive turns over. Every change is recorded in **Activity**, where most can be undone.',
      },
    ],
  },
}

/** Flattened page order: drives prev/next and the sitemap. */
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
