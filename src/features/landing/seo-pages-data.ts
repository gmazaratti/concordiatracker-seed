/**
 * The words on the keyword landing pages, as plain data with no imports.
 *
 * Two readers: the React pages (SeoLandingPages.tsx) and the build script that
 * writes the same pages as finished HTML for crawlers (docs-src/agent-pages.mjs).
 * One copy means a search engine reads exactly what a student sees; two copies
 * would drift the first time either was edited.
 *
 * Every claim must be true of the live product, the rule the FAQ and docs
 * follow. When a feature changes, the copy changes here.
 */
export interface SeoFaq {
  q: string
  a: string
}

export interface SeoPageData {
  path: string
  title: string
  description: string
  h1: string
  intro: string
  /** Where the main button goes, and what it says. */
  cta: { to: string; label: string }
  /** `scaleTable` puts Concordia's grade scale under this section. */
  sections: { h2: string; body: string; scaleTable?: boolean }[]
  faqs: SeoFaq[]
  related: { to: string; label: string }[]
}

const GPA: SeoPageData = {
  path: '/concordia-gpa-calculator',
  title: 'Concordia GPA Calculator & 4.30 Grade Scale | ConcordiaTracker',
  description:
    "Free Concordia GPA calculator on the official 4.30 scale, with the full letter-grade table (A+ = 4.30). See your GPA and the grade you need on what's left to hit your target.",
  h1: 'Concordia GPA Calculator',
  intro:
    "Calculate your GPA on Concordia's official 4.30 scale, see exactly what you need on what's left to hit your target, and project where you'll land, without maintaining a spreadsheet.",
  cta: { to: '/app', label: 'Calculate my GPA' },
  sections: [
    {
      h2: "Concordia's GPA scale (4.30)",
      body:
        'Concordia grades on a 4.30 scale: an A+ is worth 4.30 grade points and an F is worth 0. Your GPA is the average of those points, weighted by each course’s credits, so a 4-credit course counts more than a 3-credit one. The percentage that earns each letter is set by each course outline, so check yours; the ones below are the common mapping.',
      scaleTable: true,
    },
    {
      h2: 'Know the exact grade you need',
      body:
        'Set a target, a pass, a B+, whatever you’re aiming for, and the grade-needed calculator tells you the average you need on everything that’s left. It’s real arithmetic from your actual course weights, and it’s free.',
    },
    {
      h2: 'Project your GPA before the marks post',
      body:
        'Run what-if scenarios: drop in the grades you expect and watch your GPA move before a single mark is official. GPA projection is part of the semester pass; the grade-needed calculator is always free.',
    },
  ],
  faqs: [
    {
      q: 'What GPA scale does Concordia use?',
      a: 'Concordia uses a 4.30 grade-point scale. An A+ is 4.30, an A is 4.00, an A- is 3.70, a B+ is 3.30, and so on down to 0 for an F. ConcordiaTracker calculates on that exact scale.',
    },
    {
      q: 'How is a Concordia GPA calculated?',
      a: 'Each course’s letter grade becomes grade points on the 4.30 scale. Those points are multiplied by the course’s credits, added up, and divided by your total credits.',
    },
    {
      q: 'Can I see what grade I need to pass or hit a target?',
      a: 'Yes. Set any target and the free grade-needed calculator shows the average you need on your remaining assessments, using your real course weights.',
    },
    {
      q: 'Is the Concordia GPA calculator free?',
      a: 'The grade-needed calculator and your full course dashboard are free. GPA what-if projection is part of the paid semester pass.',
    },
  ],
  related: [
    { to: '/concordia-syllabus-tracker', label: 'Concordia syllabus tracker' },
    { to: '/concordia-schedule-builder', label: 'Concordia schedule builder' },
  ],
}

const SYLLABUS: SeoPageData = {
  path: '/concordia-syllabus-tracker',
  title: 'Concordia Syllabus Tracker | ConcordiaTracker',
  description:
    'Upload any Concordia course syllabus and ConcordiaTracker fills in every deadline, weight, and exam. The syllabus, assignment, and deadline tracker built for Concordia students.',
  h1: 'Concordia Syllabus Tracker',
  intro:
    'Turn every course syllabus into a live plan, with deadlines, weights, and exams filled in automatically, so your whole Concordia semester stays in one organized view.',
  cta: { to: '/app', label: 'Upload a syllabus' },
  sections: [
    {
      h2: 'Upload a syllabus, skip the typing',
      body:
        'Drop in a course syllabus and ConcordiaTracker reads it, pulling out every quiz, assignment, midterm, and final with its date and weight. No more copying a messy PDF into your calendar by hand in the first week of class.',
    },
    {
      h2: 'Every assignment and deadline in one place',
      body:
        'Across all your courses, every due date lands on one Today view, sorted by what’s next. Connect Moodle and its deadlines join them, so nothing buried in a syllabus catches you off guard.',
    },
    {
      h2: 'Trust every date',
      body:
        'Each date carries a badge saying where it came from: the official outline, confirmed by classmates, or unverified. You always know what to rely on.',
    },
  ],
  faqs: [
    {
      q: 'How do I keep track of my Concordia syllabus?',
      a: 'Upload the syllabus and ConcordiaTracker extracts every deadline, weight, and exam, then keeps them on one dashboard alongside your other courses.',
    },
    {
      q: 'Can it track assignments and deadlines across all my courses?',
      a: 'Yes. Every course’s deadlines land on a single Today view, sorted by what’s due next.',
    },
    {
      q: "What if my course or syllabus isn't listed?",
      a: 'Upload your own syllabus to read it, import a classmate’s outline, or add the course and its assessments by hand. Any Concordia course works.',
    },
    {
      q: 'Is the syllabus tracker free?',
      a: 'Yes. Importing syllabi, tracking deadlines, and your course dashboard are free.',
    },
  ],
  related: [
    { to: '/concordia-gpa-calculator', label: 'Concordia GPA calculator' },
    { to: '/concordia-schedule-builder', label: 'Concordia schedule builder' },
  ],
}

const SCHEDULE: SeoPageData = {
  path: '/concordia-schedule-builder',
  title: 'Concordia Schedule Builder: Visual Class Planner | ConcordiaTracker',
  description:
    'A free visual schedule builder for Concordia. Search any course, compare real sections on a weekly grid, spot time conflicts, block off your free time, and share the result.',
  h1: 'Concordia Schedule Builder',
  intro:
    'Plan next term on a real week: search any Concordia course, try its sections side by side, and see conflicts before registration instead of after.',
  cta: { to: '/app/planner?tab=schedule', label: 'Build my schedule' },
  sections: [
    {
      h2: 'Real sections, on a weekly grid',
      body:
        'Search the course calendar by code or name, then pick lectures, tutorials and labs from the sections Concordia has published. Each one lands on a Monday-to-Friday grid with its times and room, so you see the shape of your week at a glance.',
    },
    {
      h2: 'Conflicts and free time, before you register',
      body:
        'Overlapping classes are flagged the moment they happen. Block off work shifts or commute hours and filter sections around them, or let the builder suggest combinations that fit. It is all a draft: nothing is sent to Concordia, and you register in the Student Centre as usual.',
    },
    {
      h2: 'Share it, print it, keep it',
      body:
        'Send your schedule to a classmate as a link, save it as a picture, or print it with the class list and rooms underneath. When a section you want is full, a seat watch can tell you when a spot opens.',
    },
  ],
  faqs: [
    {
      q: 'Where do the section times come from?',
      a: 'From Concordia’s Open Data. A term only appears once Concordia has published it there; until then you can add a section by hand from the class search.',
    },
    {
      q: 'Does it register me for classes?',
      a: 'No. The schedule builder is for planning. Once you have a schedule you like, you register in Concordia’s Student Centre with the class numbers it shows.',
    },
    {
      q: 'Is the Concordia schedule builder free?',
      a: 'Yes. Searching courses, building schedules and sharing them are free.',
    },
  ],
  related: [
    { to: '/concordia-gpa-calculator', label: 'Concordia GPA calculator' },
    { to: '/concordia-syllabus-tracker', label: 'Concordia syllabus tracker' },
  ],
}

export const SEO_PAGES = { gpa: GPA, syllabus: SYLLABUS, schedule: SCHEDULE } as const
