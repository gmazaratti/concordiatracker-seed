/**
 * Cross-course teacher announcements — the student's OWN coursework, so this
 * lives on TODAY (a quiet academic-glance digest), not Community (which is
 * outward-facing, beyond your own courses). The course detail is the source of
 * truth; the digest just aggregates a recent glance and links back.
 */
export interface Announcement {
  id: string
  /** The course this came from — the digest links back here. */
  courseId: string
  title: string
  /** Short snippet shown in the digest. */
  body: string
  postedDaysAgo: number
}

export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'an-comp248-a2', courseId: 'comp248', postedDaysAgo: 0,
    title: 'Assignment 2 deadline extended',
    body: 'You now have until Friday 11:59 PM to submit the inheritance assignment.',
  },
  {
    id: 'an-math205-oh', courseId: 'math205', postedDaysAgo: 1,
    title: 'Office hours moved to Thursday',
    body: 'This week only — Thursday 2–4 PM in LB 619 instead of Wednesday.',
  },
  {
    id: 'an-comm217-mid', courseId: 'comm217', postedDaysAgo: 2,
    title: 'Midterm coverage posted',
    body: 'The midterm covers chapters 1–5; a formula sheet will be provided.',
  },
  {
    id: 'an-poli202-guest', courseId: 'poli202', postedDaysAgo: 3,
    title: 'Guest lecture on Quebec federalism',
    body: 'Wednesday’s class features a guest speaker — attendance counts toward participation.',
  },
  {
    id: 'an-engl233-read', courseId: 'engl233', postedDaysAgo: 5,
    title: 'Next week’s reading swapped',
    body: 'We’ll read Hemingway before Chopin — see the updated schedule on Moodle.',
  },
]
