import { daysFromNow } from '@/lib/date'

/**
 * Community mock data — a pure events aggregator ("what's happening around me
 * that isn't my own coursework"). Loadable so real campus data can slot in later.
 * NOT a social feed: no posts/reactions/RSVP/attendee counts.
 *
 * In production, event images are SUPPLIED BY THE HOSTING ORG as part of the
 * submitted event (consistent with the aggregator model) — we don't source or
 * generate them. `image` points at that supplied asset; when there is none, every
 * event falls back to the SAME branded banner (the host org's brand colour +
 * its initials), so the grid stays visually consistent.
 */
export type EventCategory = 'clubs' | 'career' | 'academic' | 'official'

/** Optional outbound links shown on the org profile (only the ones that are set
 * render). `website` is a generic custom link (homepage, Linktree, etc.). */
export interface OrgLinks {
  website?: string
  instagram?: string
  x?: string
  linkedin?: string
}

export interface EventOrg {
  name: string
  /** Public handle, e.g. "@jmsb". */
  handle: string
  /** Verified = a credible, confirmed source (like teacher-verified blueprints). */
  verified: boolean
  /** Short initials for the logo block. */
  glyph: string
  /** Brand color (hex) for the logo + branded media fallback. */
  color: string
  /** Optional real logo (URL) for the host avatar tile. Falls back to the
   * coloured-initials block if absent/broken. */
  logo?: string
  /** Optional banner image (URL) for the profile header. Falls back to the
   * brand-colour cover band if absent/broken. */
  banner?: string
  /** Short description shown on the org profile page. */
  bio: string
  /** Optional social + custom links — only the set ones render on the profile. */
  links?: OrgLinks
}

export interface CampusEvent {
  id: string
  title: string
  /** ISO start timestamp (runtime-relative, like the rest of the seed). */
  start: string
  /** In person vs online. */
  mode: 'in-person' | 'online'
  /** Room/building, or the platform for online events. */
  location: string
  org: EventOrg
  category: EventCategory
  /** Full description shown in the expanded view. */
  description: string
  /** URL/path to a real org-supplied image (e.g. `/events/foo.jpg` in `public/`).
   * Undefined → the uniform org-branded banner. A broken image gracefully falls
   * back to that same banner, so it's never an empty box. */
  image?: string
  /** Programs/faculties this is especially for — drives the opt-in "for your
   * program" emphasis, matched against the student's OWN Settings data. */
  relevantTo?: string[]
  /** How many days ago the host posted this event (for "Posted Xd ago" on the
   * org profile). Mock — in production this is the submission timestamp. */
  postedDaysAgo: number
}

const ORG = {
  gamedev: { name: 'Game Development Association', handle: '@gamedev.conu', verified: false, glyph: 'GD', color: '#a78bfa', bio: 'A student club for aspiring game developers — workshops, game jams, and showcases across engines and disciplines.' },
  ginacody: { name: 'Gina Cody School', handle: '@ginacody', verified: true, glyph: 'GC', color: '#4fb89a', bio: 'The Faculty of Engineering and Computer Science — info sessions, career events, and student programming for Gina Cody.' },
  birks: { name: 'Birks Student Service Centre', handle: '@concordia.hub', verified: true, glyph: 'BK', color: '#5b9cf6', bio: 'Your first stop for registration, records, and enrolment help at Concordia.' },
  caps: { name: 'Counselling & Advocacy', handle: '@conu.caps', verified: true, glyph: 'CA', color: '#e0a13c', bio: 'Counselling, wellness, and student advocacy — workshops, drop-ins, and support across campus.' },
  president: { name: 'Office of the President', handle: '@concordia.president', verified: true, glyph: 'OP', color: '#c2566e', bio: 'Official communications and community events from the Office of the President.' },
  hack: { name: 'HackConcordia', handle: '@hackconcordia', verified: false, glyph: 'HC', color: '#22b8a6', bio: "Quebec's largest student-run hackathon community — building, learning, and shipping together." },
  outdoors: { name: 'Concordia Outdoors Club', handle: '@conu.outdoors', verified: false, glyph: 'OC', color: '#6bbf59', bio: 'Day hikes, ski trips, and outdoor adventures for Concordia students of every level.' },
  library: { name: 'Concordia Library', handle: '@concordia.library', verified: true, glyph: 'LB', color: '#7c83f0', bio: 'Research help, workshops, and study resources from the Concordia Library.' },
  university: { name: 'Concordia University', handle: '@concordia', verified: true, glyph: 'CU', color: '#c2566e', bio: 'Official news, open houses, and university-wide events from Concordia University.' },
  jmsb: { name: 'John Molson School of Business', handle: '@jmsb', verified: true, glyph: 'JM', color: '#912338', logo: 'https://i.ibb.co/HLVRHtf9/JMSB-Profile-Picture.png', bio: 'The John Molson School of Business — networking nights, case competitions, and career events for business students.' },
  casajmsb: { name: 'CASA JMSB', handle: '@casa.jmsb', verified: true, glyph: 'CJ', color: '#9b2335', logo: 'https://i.ibb.co/jkRyPXL8/CASA-JMSB-Profile-Picture.png', banner: 'https://i.ibb.co/mC78DnR1/CASA-JMSB-Banner.webp', bio: "The Commerce and Administration Students' Association — the official undergraduate association of JMSB." },
  jmis: { name: 'John Molson Investment Society', handle: '@jmis', verified: true, glyph: 'JI', color: '#1f4e8c', logo: 'https://i.ibb.co/4qqLLxq/JMIS-Profile-Picture.png', bio: 'A student-run investment society at John Molson — speaker series, stock pitches, and portfolio workshops.', links: { linkedin: 'https://www.linkedin.com/company/jmis-ca/', instagram: 'https://www.instagram.com/jmis.ca/', website: 'https://linktr.ee/jmis.ca' } },
  mathhelp: { name: 'Math & Stats Help Centre', handle: '@conu.mathhelp', verified: false, glyph: 'MS', color: '#e0853c', bio: 'Free peer tutoring and exam-prep sessions in mathematics and statistics.' },
} satisfies Record<string, EventOrg>

export const CAMPUS_EVENTS: CampusEvent[] = [
  {
    id: 'ev-gamedev', title: 'Game Dev Club — Unity intro workshop',
    start: daysFromNow(1, 17, 30), mode: 'in-person', location: 'H 920', org: ORG.gamedev,
    category: 'clubs', relevantTo: ['Computer Science', 'Gina Cody', 'Engineering'], postedDaysAgo: 6,
    description:
      'A hands-on intro to Unity for total beginners — build your first 2D scene and learn the editor. Laptops provided; no experience needed. Snacks afterward.',
  },
  {
    id: 'ev-techfair', title: 'Tech & Engineering Career Fair',
    start: daysFromNow(2, 10, 0), mode: 'in-person', location: 'EV Building Atrium', org: ORG.ginacody,
    category: 'career', relevantTo: ['Computer Science', 'Gina Cody', 'Engineering'], postedDaysAgo: 12,
    description:
      '40+ employers hiring for internships and new-grad roles across software, hardware, and data. Bring printed résumés; dress business-casual. Drop in any time.',
  },
  {
    id: 'ev-addrop', title: 'Add / drop & tuition refund deadline',
    start: daysFromNow(3, 23, 59), mode: 'online', location: 'Online — Student Hub', org: ORG.birks,
    category: 'academic', postedDaysAgo: 21,
    description:
      'Last day to drop a course with a full tuition refund and no transcript notation. Changes are made yourself in the Student Hub before 11:59 PM.',
  },
  {
    id: 'ev-resume', title: 'Drop-in résumé clinic',
    start: daysFromNow(3, 13, 0), mode: 'in-person', location: 'GM 350', org: ORG.caps,
    category: 'career', postedDaysAgo: 4,
    description:
      'Get a 15-minute one-on-one résumé review from a career advisor. First come, first served — bring a printed copy or a laptop.',
  },
  {
    id: 'ev-townhall', title: "President's town hall",
    start: daysFromNow(4, 15, 0), mode: 'in-person', location: 'D.B. Clarke Theatre', org: ORG.president,
    category: 'official', postedDaysAgo: 9,
    description:
      'An open conversation with the President on this year’s priorities, followed by a community Q&A. All students, staff, and faculty welcome.',
  },
  {
    id: 'ev-hackathon', title: 'ConUHacks kickoff & team-building',
    start: daysFromNow(6, 18, 0), mode: 'in-person', location: 'JMSB Atrium', org: ORG.hack,
    category: 'clubs', relevantTo: ['Computer Science', 'Gina Cody', 'Engineering'], postedDaysAgo: 14,
    description:
      'Kickoff for Quebec’s largest student hackathon. Meet teammates, hear from sponsors, and lock in your idea before the 24-hour build weekend.',
  },
  {
    id: 'ev-outdoors', title: 'Fall hike — Mont Saint-Hilaire',
    start: daysFromNow(9, 8, 30), mode: 'in-person', location: 'Meet at Hall Building', org: ORG.outdoors,
    category: 'clubs', postedDaysAgo: 8,
    description:
      'A guided day hike with transport included. Moderate difficulty (~6 km). Bring water, sturdy shoes, and a packed lunch. Sign-up closes when full.',
  },
  {
    id: 'ev-library', title: 'Research & citation workshop',
    start: daysFromNow(10, 14, 0), mode: 'online', location: 'Online — Zoom', org: ORG.library,
    category: 'academic', postedDaysAgo: 5,
    description:
      'A librarian walks through finding peer-reviewed sources, managing references with Zotero, and avoiding accidental plagiarism. A recording is shared after.',
  },
  {
    id: 'ev-openhouse', title: 'Fall Open House',
    start: daysFromNow(12, 11, 0), mode: 'in-person', location: 'SGW Campus, Hall Building', org: ORG.university,
    category: 'official', postedDaysAgo: 25,
    description:
      'Campus tours, program info sessions, and a chance to meet faculty and current students across both campuses. Free admission; bring a friend.',
  },
  {
    id: 'ev-jmsbfair', title: 'JMSB Networking Night',
    start: daysFromNow(15, 17, 0), mode: 'in-person', location: 'MB 1.210', org: ORG.jmsb,
    category: 'career', relevantTo: ['John Molson', 'Business', 'Commerce'], postedDaysAgo: 10,
    description:
      'Connect with alumni and recruiters across finance, marketing, and consulting in a relaxed setting. Business attire recommended; light refreshments served.',
  },
  {
    id: 'ev-mathhelp', title: 'Calculus II exam-prep session',
    start: daysFromNow(16, 16, 0), mode: 'in-person', location: 'LB 921', org: ORG.mathhelp,
    category: 'academic', relevantTo: ['Computer Science', 'Engineering', 'Mathematics'], postedDaysAgo: 3,
    description:
      'A peer-led review of integration techniques, sequences, and series ahead of midterms. Bring your toughest practice problems to work through together.',
  },
  {
    id: 'ev-jmsb-case', title: 'Case Competition info session',
    start: daysFromNow(8, 12, 0), mode: 'in-person', location: 'MB 2.255', org: ORG.jmsb,
    category: 'career', relevantTo: ['John Molson', 'Business', 'Commerce'], postedDaysAgo: 7,
    description:
      'Learn how case competitions work, how teams are picked, and how to prep. A great first step if you want to represent JMSB this year.',
  },
  {
    id: 'ev-casa-stockpitch', title: 'CASA Stock Pitch Competition',
    start: daysFromNow(7, 9, 0), mode: 'in-person', location: 'MB 1.210', org: ORG.casajmsb,
    category: 'career', relevantTo: ['John Molson', 'Business', 'Commerce', 'Finance'], postedDaysAgo: 11,
    image: 'https://i.ibb.co/mC78DnR1/CASA-JMSB-Banner.webp',
    description:
      'Pitch a stock to a panel of industry judges and compete for cash prizes. Open to all JMSB students — solo or in teams of two. Coaching sessions run the week before; sign up early as spots are limited.',
  },
  {
    id: 'ev-jmis-speaker', title: 'JMIS Speaker Series — markets & macro outlook',
    start: daysFromNow(5, 18, 0), mode: 'in-person', location: 'MB S2.330', org: ORG.jmis,
    category: 'career', relevantTo: ['John Molson', 'Business', 'Commerce', 'Finance'], postedDaysAgo: 6,
    description:
      'An evening with a portfolio manager on reading the macro picture and positioning a student portfolio, followed by Q&A and networking. Open to members and curious newcomers alike.',
  },
  {
    id: 'ev-casa-cares', title: 'CASA Cares — charity week kickoff',
    start: daysFromNow(13, 12, 0), mode: 'in-person', location: 'JMSB Atrium', org: ORG.casajmsb,
    category: 'clubs', relevantTo: ['John Molson', 'Business', 'Commerce'], postedDaysAgo: 9,
    image: 'https://i.ibb.co/xtqFkQ1F/CASA-JMSB-Basic-Banner.png',
    description:
      'Kick off CASA Cares week — a week of fundraising events, raffles, and a charity gala supporting a local cause. Drop by the atrium to grab a schedule and a wristband.',
  },
  {
    id: 'ev-hack-apis', title: 'Workshop: building with public APIs',
    start: daysFromNow(20, 18, 0), mode: 'online', location: 'Online — Discord', org: ORG.hack,
    category: 'clubs', relevantTo: ['Computer Science', 'Gina Cody', 'Engineering'], postedDaysAgo: 2,
    description:
      'A hands-on session on calling REST APIs, handling auth, and shipping a tiny project — perfect warmup before the hackathon. Beginners welcome.',
  },

  // Past events — surfaced only on org profiles (the feed filters to upcoming),
  // so each profile has a real "Past" section.
  {
    id: 'ev-hack-past-conuhacks', title: 'ConUHacks IX — 24-hour hackathon',
    start: daysFromNow(-16, 9, 0), mode: 'in-person', location: 'JMSB Atrium', org: ORG.hack,
    category: 'clubs', relevantTo: ['Computer Science', 'Gina Cody', 'Engineering'], postedDaysAgo: 48,
    description:
      'Our flagship 24-hour hackathon — hundreds of students, mentors, and sponsors building projects overnight. Thanks to everyone who came out.',
  },
  {
    id: 'ev-hack-past-git', title: 'Intro to Git & GitHub workshop',
    start: daysFromNow(-31, 18, 0), mode: 'online', location: 'Online — Discord', org: ORG.hack,
    category: 'clubs', relevantTo: ['Computer Science', 'Gina Cody', 'Engineering'], postedDaysAgo: 40,
    description:
      'A beginner-friendly walkthrough of version control: commits, branches, and pull requests, with a hands-on repo to practice on.',
  },
  {
    id: 'ev-ginacody-past-capstone', title: 'Capstone project showcase',
    start: daysFromNow(-22, 13, 0), mode: 'in-person', location: 'EV Building Atrium', org: ORG.ginacody,
    category: 'academic', relevantTo: ['Computer Science', 'Gina Cody', 'Engineering'], postedDaysAgo: 38,
    description:
      'Graduating students demoed their capstone projects to faculty and industry guests. Congratulations to this year’s cohort.',
  },
  {
    id: 'ev-jmsb-past-welcome', title: 'JMSB Welcome Week mixer',
    start: daysFromNow(-27, 17, 0), mode: 'in-person', location: 'MB Atrium', org: ORG.jmsb,
    category: 'career', relevantTo: ['John Molson', 'Business', 'Commerce'], postedDaysAgo: 35,
    description:
      'New and returning JMSB students met clubs, faculty, and each other over food and music to kick off the term.',
  },
  {
    id: 'ev-casa-past-frosh', title: 'CASA Frosh kickoff',
    start: daysFromNow(-34, 12, 0), mode: 'in-person', location: 'Loyola Quad', org: ORG.casajmsb,
    category: 'clubs', relevantTo: ['John Molson', 'Business', 'Commerce'], postedDaysAgo: 44,
    description:
      'A week of orientation events welcoming first-year commerce students to JMSB and the CASA community.',
  },
]

/** Other upcoming events hosted by the same org — for "more from this host". */
export function moreFromHost(event: CampusEvent, now: Date): CampusEvent[] {
  return CAMPUS_EVENTS.filter(
    (e) => e.id !== event.id && e.org.handle === event.org.handle && new Date(e.start) >= now,
  )
}

const CONTEXT_FIELDS = (program: string, school: string) => `${program} ${school}`.toLowerCase()

/** Honest, opt-in relevance: an event is "for your program" only if one of its
 * tags appears in the student's OWN program/faculty (set in Settings). */
export function isRelevantTo(event: CampusEvent, program: string, school: string): boolean {
  if (!event.relevantTo?.length) return false
  const hay = CONTEXT_FIELDS(program, school)
  return event.relevantTo.some((tag) => hay.includes(tag.toLowerCase()))
}

/** Every known org (hosts), for search + profile lookup + the follow system. */
export const ORGS: EventOrg[] = Object.values(ORG)

/** URL-safe profile slug from the handle (handles are unique). */
export function orgSlug(org: EventOrg): string {
  return org.handle.replace(/^@/, '')
}

export function orgBySlug(slug: string): EventOrg | undefined {
  return ORGS.find((o) => orgSlug(o) === slug)
}

export function orgByHandle(handle: string): EventOrg | undefined {
  return ORGS.find((o) => o.handle === handle)
}

/** All events this org hosts, split into upcoming (soonest first) and past
 * (most recent first). Powers the org profile's two sections. */
export function eventsByOrg(handle: string, now: Date): { upcoming: CampusEvent[]; past: CampusEvent[] } {
  const mine = CAMPUS_EVENTS.filter((e) => e.org.handle === handle)
  const t = now.getTime()
  const upcoming = mine
    .filter((e) => new Date(e.start).getTime() >= t)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
  const past = mine
    .filter((e) => new Date(e.start).getTime() < t)
    .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime())
  return { upcoming, past }
}

/** Search orgs by name or handle (case-insensitive). Empty query → no results. */
export function searchOrgs(query: string): EventOrg[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return ORGS.filter(
    (o) => o.name.toLowerCase().includes(q) || o.handle.toLowerCase().includes(q),
  ).sort((a, b) => a.name.localeCompare(b.name))
}

/** Upcoming events posted by the given orgs, most-recently-posted first — the
 * source for the (stubbed) notifications panel. CONNECTION-PHASE: real
 * notification generation needs a multi-user backend; this just reshapes the
 * single-user mock so the UX is demonstrable. */
export function recentEventsFromOrgs(handles: string[], now: Date): CampusEvent[] {
  const set = new Set(handles)
  const t = now.getTime()
  return CAMPUS_EVENTS.filter(
    (e) => set.has(e.org.handle) && new Date(e.start).getTime() >= t,
  ).sort((a, b) => a.postedDaysAgo - b.postedDaysAgo)
}

/** "Posted 3d ago" style label from a day count. */
export function postedAgoLabel(daysAgo: number): string {
  if (daysAgo <= 0) return 'just now'
  if (daysAgo === 1) return '1d ago'
  if (daysAgo < 7) return `${daysAgo}d ago`
  if (daysAgo < 30) return `${Math.floor(daysAgo / 7)}w ago`
  return `${Math.floor(daysAgo / 30)}mo ago`
}
