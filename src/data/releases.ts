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
    version: '1.32.0',
    name: 'Clubs have an inbox',
    date: '2026-09-21',
    changes: [
      {
        kind: 'new',
        text: 'You can message a club. There is a Message button on every club profile, and replying to a story writes to the club too — not to whoever happens to have set it up.',
      },
      {
        kind: 'new',
        text: 'Clubs get an inbox in the organizer portal. Anyone on the team can answer and the reply goes out as the club, so a conversation does not leave when one person graduates.',
      },
      {
        kind: 'new',
        text: 'When a club you follow posts, you hear about it. That is what following one is for, so it starts on — and there is a switch in Settings if you would rather it did not. Stories never notify: they are on the ring at the top of the feed.',
      },
      {
        kind: 'improved',
        text: 'A club cannot start a conversation with you. It can only answer someone who wrote to it first, and that is enforced in the database rather than left to the screen.',
      },
    ],
  },
  {
    version: '1.31.0',
    name: 'One relationship, and clubs that can actually post',
    date: '2026-09-21',
    changes: [
      {
        kind: 'improved',
        text: 'Follows and connections are one thing now. You follow somebody; if they follow you back, that is the connection. There is nothing to accept and no second relationship to learn, and every connection you already had was carried over as a mutual follow.',
      },
      {
        kind: 'new',
        text: 'You can message anyone. If they do not follow you back you get one message — enough to say who you are and why — and after that it waits for them. You can narrow that in Settings to people you follow back, or turn messages off entirely.',
      },
      {
        kind: 'new',
        text: 'Clubs can post. Photos, one or a slideshow, with a caption — and you can like, comment, repost and send them on. Stories too: up for twenty-four hours, with text the club can drag onto the picture.',
      },
      {
        kind: 'new',
        text: 'Repost. The third button under a post or an event puts it on your profile, in a tab of its own, so passing something on does not mean screenshotting it.',
      },
      {
        kind: 'improved',
        text: 'Profiles were a wall you scrolled past. They have tabs now — outlines, reposts and classes for a student; events, posts and reposts for a club — and the counts above them open the list behind each one.',
      },
      {
        kind: 'new',
        text: 'A switch for your major, next to the ones for your classes and your schedule. Three separate things to show, three separate decisions.',
      },
      {
        kind: 'fixed',
        text: 'A first message from somebody you had not met was invisible. Those have existed since message requests shipped and nothing in the app ever showed them — your inbox only listed people you were already connected to.',
      },
    ],
  },
  {
    version: '1.30.0',
    name: 'Google Calendar, faster scans, and a reply from us',
    date: '2026-09-20',
    changes: [
      {
        kind: 'fixed',
        text: 'Add to Google Calendar failed with “Unable to add calendar. Check the URL.” The link itself was always fine — Apple Calendar took it without complaint — but Google wants a subscription link handed to it in a particular form, and we were handing it the other one. It adds in one press now.',
      },
      {
        kind: 'new',
        text: 'A “How?” next to the link, with the actual menu names. Google Calendar, Apple Calendar on a Mac, on an iPhone, and Outlook each bury “subscribe to a calendar” somewhere different, so the panel now spells out where. It also says the one thing worth knowing up front: the Google Calendar phone app cannot add a calendar by link at all — that has to be done once from a computer, and it then appears on the phone.',
      },
      {
        kind: 'improved',
        text: 'Syllabus scanning is quicker, and it tries harder. Difficult PDFs used to time out and take one of your scans with them; a scan that comes back with nothing now has a second go at the file a different way before giving up, and when it does give up it says why.',
      },
      {
        kind: 'new',
        text: 'No monthly limit on scans with the semester pass. There is still a few seconds between scans, and a generous daily ceiling that exists only to stop something running away with itself — but the monthly cap is gone for Pro, and the counter no longer reads “Infinity of Infinity”.',
      },
      {
        kind: 'fixed',
        text: 'Uploading your syllabus during setup quietly ignored the file and loaded a sample class instead. It reads your actual PDF now, the same scanner the rest of the app uses.',
      },
      {
        kind: 'improved',
        text: 'A private profile can still be found. Searching someone’s handle now finds them and the profile opens — showing their name, their picture, and nothing else unless they chose to share it. Being findable and being visible are two different settings, and they should be.',
      },
      {
        kind: 'new',
        text: 'We can write back on your screen. If you report something, a short note from us can appear in the corner of the app — it waits until you have read it, and you can reply straight from it. Only ever in response to you; there are no broadcasts.',
      },
    ],
  },
  {
    version: '1.29.0',
    name: 'Calendar sync, for real this time',
    date: '2026-09-19',
    changes: [
      {
        kind: 'new',
        text: 'Your deadlines, in Google Calendar or Apple Calendar. Settings → Calendar sync gives you one link: press Add to Google Calendar or Add to Apple Calendar, or paste it into Outlook or anything else that keeps a calendar. It stays up to date on its own — move a date here and it moves there. It goes one way only: we never read your calendar and never ask for access to your Google or Apple account.',
      },
      {
        kind: 'fixed',
        text: 'The old Sync button did nothing. It set a flag, said “Sync set up · Two-way sync coming soon”, and that was the whole feature. That was wrong, and worse on a paid plan. It now opens the panel that actually does it.',
      },
      {
        kind: 'new',
        text: 'The panel says whether anything has read your link, and when. “Google last read this 2 hours ago” and “nothing has read this yet” send you to two different fixes, and neither is guessable from your end. It also says plainly that Google refreshes subscribed calendars on its own schedule — hours, sometimes a day — because that is not something any publisher can speed up, and a moved deadline arriving late should not read as the sync being broken.',
      },
      {
        kind: 'new',
        text: 'Choose what rides along, and take it back. Course deadlines and tasks are separate switches. Rotate link mints a new one and breaks every copy of the old one immediately, because anyone holding the link can read those dates without signing in — which is exactly how Google reads it.',
      },
      {
        kind: 'fixed',
        text: 'Support conversations could never load. Opening any ticket showed a spinner forever and no messages, on both sides — a query in the database was refusing every single call, and the screen showed a spinner instead of the reason. Fixed at the source, and a failed load now says what went wrong with a Try again rather than spinning.',
      },
      {
        kind: 'improved',
        text: 'The support inbox counts what each filter is hiding. Four tickets showing as two, with the other two simply absent, reads exactly like tickets going missing. Every filter now carries its own number.',
      },
      {
        kind: 'fixed',
        text: 'Messages were unusable on a phone. Opening a conversation drew it as a small strip near the top of the screen instead of filling it. A decorative fade on the page behind was quietly re-anchoring the full-screen chat to a 44-pixel box. The conversation now fills the screen, clears the home indicator, and keeps the message box above the browser bar.',
      },
      {
        kind: 'fixed',
        text: 'The sample dashboard on the home page showed a real person’s name. It is a sample student now.',
      },
    ],
  },
  {
    version: '1.28.0',
    name: 'Moodle, and no second copy of anything',
    date: '2026-09-15',
    changes: [
      {
        kind: 'new',
        text: 'Connect your Moodle calendar. Settings → Moodle walks you through the four clicks (Calendar → Export → Get calendar URL — not the Export button, which downloads a file), and draws the page so you can see which options to pick. Paste the link once and your Moodle deadlines land in your calendar, re-checked every night. No password: the link is read-only, covers your calendar and nothing else, and is stored where the app itself cannot read it back — only the sync job can. Disconnect removes it and everything it added.',
      },
      {
        kind: 'new',
        text: 'It shows you what it found. The panel lists every synced deadline by name with its course and date, read from your data rather than echoed back from the last sync, and says how many events it left behind as already finished. A count you cannot check is not worth much.',
      },
      {
        kind: 'new',
        text: 'If a professor moves a date, you are told rather than finding out. A synced item shows the old date and the new one side by side. And when the same work is also an assessment on one of your courses — the record that carries the weight and your grade — that course asks whether to use Moodle’s date or keep yours. Your weight, grade and notes are never touched, only the date.',
      },
      {
        kind: 'improved',
        text: 'No duplicates. A Moodle “Assignment 2 is due” and the Assignment 2 on your course are the same piece of work, so only one appears — the assessment, since it is the one with a weight. What shows up on its own is what no syllabus lists, like “Join a Group”. Matching is deliberately cautious: it needs the course and the numbers to agree, so “Quiz 1” can never be mistaken for “Quiz 4”.',
      },
      {
        kind: 'new',
        text: 'Sign in with Apple, beside Google, on the app and both portals. If you use Hide My Email that is treated as an ordinary address everywhere. Apple only sends your name on the very first sign-in, so if it never arrives you start as “Student” and can set it in Edit profile — better than a made-up name built out of a random email address.',
      },
      {
        kind: 'improved',
        text: 'Asking to see someone’s schedule is now a question they answer. Instead of a message telling them which setting to go and find, they get Allow or Deny in the chat, with what it shares written on it: times and rooms, never grades, and it applies to everyone you have accepted rather than just the person asking.',
      },
      {
        kind: 'fixed',
        text: 'Sharing an outline could fail silently. The app showed “thanks for sharing” whether or not it saved, so nothing ever reached the pool and nobody could tell. It now succeeds or says why. The success screen also stops promising a review queue and theme credits that do not exist.',
      },
      {
        kind: 'fixed',
        text: 'Long syllabus uploads no longer time out. We read the text out of the PDF before sending it, which is the difference between a 478 KB document and 33 KB of words. When something does go wrong you get the actual reason instead of “something went wrong”, and a failure that was our fault no longer costs you a cooldown.',
      },
      {
        kind: 'fixed',
        text: 'The upload screen shows your real file name while it reads, and a long list of extracted assessments scrolls instead of pushing the weight total and the Add button off the page.',
      },
      {
        kind: 'fixed',
        text: '“FALL 2026”, “Summer 2026” and “Automne 2026” were each becoming their own term — their own tab, their own GPA row, sorted wrong. Terms are now written one way however they arrive.',
      },
    ],
  },
  {
    version: '1.27.0',
    name: 'Build your week',
    date: '2026-09-08',
    changes: [
      {
        kind: 'new',
        text: 'Generate a timetable. Say how many credits you want and what kind of week — most days off, mornings, mid‑day, evenings, shortest days, most or least time on campus — and cycle through real options built from real sections. Credits still come first: a pretty nine‑credit week is not an answer to “give me fifteen”.',
      },
      {
        kind: 'new',
        text: 'Choose where you are willing to be. Tick Loyola, Sir George Williams, online, or any mix, and only those sections are considered. Sections whose campus Concordia never published stay in — a gap in our reading should not delete an option that exists.',
      },
      {
        kind: 'new',
        text: 'Build on the week you already have instead of starting over. Your current classes are held in place and the rest of the load is filled around them.',
      },
      {
        kind: 'new',
        text: 'Right‑click any class on the week to pin it, hide it, see its room, seat counts and class number, or take it off — no hunting for the matching row in the list.',
      },
      {
        kind: 'new',
        text: 'An eye on every class takes it off the grid without removing it, so you can try the Thursday section in the same hour as the Tuesday one and put either back in a click.',
      },
      {
        kind: 'new',
        text: 'Online classes with no set meeting time now appear in a strip under the week rather than silently vanishing from a grid that has nowhere to draw them.',
      },
      {
        kind: 'new',
        text: 'A Tips button walks through the parts that do not announce themselves: dragging to block time, pinning, hiding, campuses, and what the generator is actually doing.',
      },
      {
        kind: 'improved',
        text: 'The term picker sits beside the schedule name and is always there, starting on the term you are in. It used to appear only after a search happened to return sections, which meant most people never saw it.',
      },
      {
        kind: 'improved',
        text: 'Find, In this schedule and the week now read left to right across the page, and the week is denser — a nine‑to‑six teaching day fits on a laptop without scrolling. Seat counts show on every class you have picked.',
      },
      {
        kind: 'improved',
        text: 'The Extended Credit Programme carries a 15‑credit minimum, so lighter loads are no longer offered while it is ticked. It was set to 12.',
      },
      {
        kind: 'fixed',
        text: 'The app thought it was Summer. Every term is now read from the calendar, which is why Fall outlines were being filed as past semesters when other students imported them.',
      },
      {
        kind: 'fixed',
        text: 'Searching for a course with no sections in the selected term now says so, and names the terms it does run in, instead of showing an empty list.',
      },
      {
        kind: 'fixed',
        text: 'An installed app now actually updates when we ship. It was checking a file that never changed, so installs stayed on whatever version they were first opened with.',
      },
      {
        kind: 'fixed',
        text: 'Assessments can be left with no date. A final exam that the outline says is “TBA” stays TBA and shows against the exam period, instead of being given a date nobody promised.',
      },
      {
        kind: 'fixed',
        text: 'Courses, Community and the admin portals read properly on a phone, the search is an icon rather than a bar, and the planner has a real drawer instead of a dropdown.',
      },
    ],
  },
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
      { kind: 'new', text: 'Every plan starts with a free trial. Cancel before it ends and you’re never charged.' },
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
