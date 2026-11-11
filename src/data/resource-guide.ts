import { RESOURCE_GROUPS, type Resource } from './resources'

/**
 * What to look at, by where you are in your degree and the time of year. Every
 * step points at an office already in resources.ts or an official page that was
 * checked on 2026-11-11; nothing here invents a date.
 */
export type Stage = 'first' | 'middle' | 'final'

export const STAGES: { id: Stage; label: string; blurb: string }[] = [
  { id: 'first', label: 'First year', blurb: 'The five things nobody tells you until you needed them.' },
  { id: 'middle', label: 'Middle years', blurb: 'Past the basics: work experience, money, and staying on track.' },
  { id: 'final', label: 'Final year', blurb: 'Make sure the degree actually closes, then what comes after it.' },
]

export interface GuideStep {
  title: string
  why: string
  /** A resource name from resources.ts ('advising' = your faculty's office). */
  resource?: string
  /** Or a direct official page. */
  url?: string
  /** Or a place inside the app. */
  to?: string
  cta: string
}

export const GUIDE: Record<Stage, GuideStep[]> = {
  first: [
    {
      title: 'Meet your advisor before you register',
      why: 'They confirm you are taking the right courses in the right order. One wrong prerequisite can cost a term.',
      resource: 'advising',
      cta: 'Your advising office',
    },
    {
      title: 'Learn the two drop dates',
      why: 'Before the DNE date a dropped course is refunded and leaves no trace. After it you still pay, and a DISC shows on your record.',
      resource: 'Term dates and deadlines',
      cta: 'This term’s dates',
    },
    {
      title: 'Book the Writing Centre once',
      why: 'Free, 50 minutes, any assignment, English or French.',
      resource: 'Writing Centre',
      cta: 'Book a session',
    },
    {
      title: 'Know where Birks is',
      why: 'Fee question, account block, a form you do not understand: it is the one desk that tells you which office handles it.',
      resource: 'Birks Student Service Centre',
      cta: 'Birks details',
    },
    {
      title: 'Ask the Welcome Crew',
      why: 'Upper-year students whose job is answering new-student questions. Faster than guessing.',
      resource: 'Welcome Crew and orientation',
      cta: 'Welcome Crew',
    },
  ],
  middle: [
    {
      title: 'Look at co-op before it is too late to join',
      why: 'Paid work terms built into the degree. Each program has its own way in, so ask early.',
      resource: 'Co-op and Experiential Learning',
      cta: 'Co-op office',
    },
    {
      title: 'Check your degree, not just your term',
      why: 'See which requirements are done and what is left, then confirm it with your advisor.',
      to: '/app/planner?tab=program',
      cta: 'Open My programme',
    },
    {
      title: 'Apply for money you qualify for',
      why: 'In-course bursaries and scholarships only go to people who apply, and the list is longer than most students expect.',
      resource: 'Financial Aid and Awards',
      cta: 'Financial aid',
    },
    {
      title: 'Get a résumé looked at',
      why: 'Career Planning reviews résumés, runs mock interviews and posts jobs. Use it before the internship rush.',
      resource: 'Career Planning',
      cta: 'Career Planning',
    },
    {
      title: 'A hard course is what tutoring is for',
      why: 'Free help in math, economics and science, plus learning specialists.',
      resource: 'Student Success Centre',
      cta: 'Student Success Centre',
    },
  ],
  final: [
    {
      title: 'Apply to graduate',
      why: 'It does not happen by itself. You have to apply, inside a fixed window for each convocation.',
      url: 'https://www.concordia.ca/students/graduation.html',
      cta: 'Graduation and deadlines',
    },
    {
      title: 'Have your advisor confirm what is left',
      why: 'One missing credit is found either now or after the application is refused.',
      resource: 'advising',
      cta: 'Your advising office',
    },
    {
      title: 'Use Career Planning while it is free',
      why: 'Counselling, the job bank and career fairs are included while you are a student.',
      resource: 'Career Planning',
      cta: 'Career Planning',
    },
    {
      title: 'Check your record for surprises',
      why: 'See your credits and GPA in one place before anyone official does.',
      to: '/app/planner?tab=record',
      cta: 'Open My record',
    },
  ],
}

/** One extra card for the time of year (month is 0-based). */
export function seasonStep(month: number): GuideStep {
  if (month === 11 || month === 3)
    return {
      title: 'Exams are here',
      why: 'Check the dates and rooms, and what to do about a conflict or a missed exam, before the day.',
      resource: 'Exam dates',
      cta: 'Exam information',
    }
  if (month === 10 || month === 2)
    return {
      title: 'Finals are a few weeks out',
      why: 'The withdrawal (DISC) deadline and the exam schedule both land around now. Look once so neither surprises you.',
      resource: 'Term dates and deadlines',
      cta: 'Dates and deadlines',
    }
  if (month === 8 || month === 0)
    return {
      title: 'The refund deadline is early',
      why: 'The DNE date comes early in the term. After it, dropping a course no longer returns the money.',
      resource: 'Term dates and deadlines',
      cta: 'This term’s dates',
    }
  if (month === 9 || month === 1)
    return {
      title: 'Midterm season',
      why: 'If a course is going badly, tutoring and a learning specialist help most before the second midterm, not after.',
      resource: 'Student Success Centre',
      cta: 'Student Success Centre',
    }
  return {
    title: 'A quiet stretch',
    why: 'The best time to see an advisor is when nobody else is trying to.',
    resource: 'advising',
    cta: 'Your advising office',
  }
}

/** "I need..." shortcuts: each opens one office, with the group behind it. */
export interface Need {
  id: string
  label: string
  resource: string
  group: string
}

export const NEEDS: Need[] = [
  { id: 'advisor', label: 'Talk to an advisor', resource: 'advising', group: 'advising' },
  { id: 'fees', label: 'Fix a fee or a block', resource: 'Birks Student Service Centre', group: 'records' },
  { id: 'writing', label: 'Help with a paper', resource: 'Writing Centre', group: 'learning' },
  { id: 'tutoring', label: 'Tutoring in a course', resource: 'Student Success Centre', group: 'learning' },
  { id: 'mind', label: 'Someone to talk to', resource: 'Mental health and counselling', group: 'health' },
  { id: 'access', label: 'Exam accommodations', resource: 'Access Centre for Students with Disabilities', group: 'health' },
  { id: 'money', label: 'Bursaries and aid', resource: 'Financial Aid and Awards', group: 'money' },
  { id: 'dispute', label: 'A dispute or a charge', resource: 'CSU Advocacy Centre', group: 'help' },
]

const ALL = RESOURCE_GROUPS.flatMap((g) => g.items)

/** Resolve a guide/need reference; 'advising' picks the student's faculty. */
export function findResource(ref: string | undefined, faculty: Resource['faculty'] | null): Resource | undefined {
  if (!ref) return undefined
  if (ref === 'advising')
    return ALL.find((r) => (faculty ? r.faculty === faculty : r.name === 'Which advising office is mine?'))
  return ALL.find((r) => r.name === ref)
}

/** A guess at the stage from finished credits; the student can change it. */
export function stageFromCredits(earned: number): Stage {
  if (earned >= 60) return 'final'
  if (earned >= 24) return 'middle'
  return 'first'
}
