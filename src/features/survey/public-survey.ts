import { supabase } from '@/lib/supabase'

/**
 * The /survey questionnaire — aimed at students who have NOT used the app.
 * It's market research: how they cope today, how much it hurts, and what
 * they'd pay. Deliberately short (about two minutes) because most will open it
 * from a phone via a shared link.
 *
 * Questions are data so the admin view can label answers without duplicating
 * the copy.
 */

export interface RatingQ {
  id: string
  label: string
  low: string
  high: string
}

/** 1–5 scales. Worded so a HIGH number is always "more of the thing named". */
export const RATING_QUESTIONS: RatingQ[] = [
  {
    id: 'satisfaction',
    label: 'How happy are you with the way you currently keep track of assignments and deadlines?',
    low: 'Not at all',
    high: 'Very happy',
  },
  {
    id: 'uncertainty',
    label: 'How often are you unsure exactly what’s due, or when?',
    low: 'Never',
    high: 'Constantly',
  },
  {
    id: 'grade_clarity',
    label: 'Right now, how confident are you that you know your current grade in each class?',
    low: 'No idea',
    high: 'Know exactly',
  },
  {
    id: 'stress',
    label: 'How stressful is staying on top of deadlines across all your classes?',
    low: 'Not stressful',
    high: 'Very stressful',
  },
  {
    id: 'scattered',
    label: 'How scattered is your course info across Moodle, eConcordia, email, and PDFs?',
    low: 'All in one place',
    high: 'Everywhere',
  },
  {
    id: 'appeal',
    label: 'How useful would it be if your syllabus automatically became a deadline calendar with grade tracking?',
    low: 'Not useful',
    high: 'Very useful',
  },
]

export interface ChoiceQ {
  id: string
  label: string
  options: string[]
  /** Let people pick several (stored comma-joined). */
  multi?: boolean
}

export const CHOICE_QUESTIONS: ChoiceQ[] = [
  {
    id: 'tools',
    label: 'What do you use right now to stay organized? (pick any)',
    options: [
      'Nothing: I just remember',
      'Phone calendar',
      'Notes app',
      'Notion',
      'Paper planner',
      'Moodle’s calendar',
      'Google Calendar',
      'Something else',
    ],
    multi: true,
  },
  {
    id: 'missed',
    label: 'Have you ever missed: or nearly missed: something because you didn’t know it was due?',
    options: ['Yes, missed it', 'Nearly missed it', 'No, never'],
  },
  {
    id: 'price',
    label: 'For a tool that did all of this well, what feels fair for a whole semester?',
    options: ['I’d only use it free', '$5', '$10', '$15', '$20+'],
  },
  {
    id: 'year',
    label: 'What year are you in?',
    options: ['1st', '2nd', '3rd', '4th+', 'Graduate', 'Not a student'],
  },
  {
    id: 'faculty',
    label: 'Which faculty?',
    options: ['Gina Cody (Engineering / CS)', 'John Molson (Business)', 'Arts & Science', 'Fine Arts', 'Other'],
  },
]

export interface TextQ {
  id: string
  label: string
  placeholder: string
}

export const TEXT_QUESTIONS: TextQ[] = [
  {
    id: 'frustration',
    label: 'What’s the single most annoying thing about staying organized at Concordia?',
    placeholder: 'Be blunt: this is the most useful answer on the page.',
  },
  {
    id: 'wish',
    label: 'If you could magically fix one thing about how your courses are run, what would it be?',
    placeholder: 'Optional',
  },
]

export interface PublicSurveyAnswers {
  ratings: Record<string, number>
  answers: Record<string, string>
  email: string
}

export const EMPTY: PublicSurveyAnswers = { ratings: {}, answers: {}, email: '' }

/** Enough to be worth storing: every scale answered. */
export function isComplete(a: PublicSurveyAnswers): boolean {
  return RATING_QUESTIONS.every((q) => typeof a.ratings[q.id] === 'number')
}

/** Which channel the link came from (?src=instagram), for comparing reach. */
export function sourceFromUrl(): string | null {
  try {
    const v = new URLSearchParams(window.location.search).get('src')
    return v ? v.slice(0, 40) : null
  } catch {
    return null
  }
}

// ── Personalised result ──────────────────────────────────────────────────────

export interface Pitch {
  id: string
  /** Quiet echo of what they told us, so the card is clearly about them. */
  problem: string
  /** The benefit, as a short headline — this is what gets read. */
  title: string
  /** One tight sentence of substance. Long paragraphs don't get read. */
  answer: string
  /** How strongly this applies; used to order and trim the list. */
  score: number
}

const has = (a: PublicSurveyAnswers, id: string, option: string) =>
  (a.answers[id] ?? '').includes(option)

/**
 * Turn their answers into a short, honest "here's what would change for you".
 *
 * Every claim below points at something the product genuinely does today — no
 * roadmap promises. Rules are scored so the sharpest pain leads, and only the
 * top few are shown; a wall of cards reads like a brochure.
 */
export function buildPitch(a: PublicSurveyAnswers): Pitch[] {
  const r = a.ratings
  const out: Pitch[] = []
  const push = (id: string, score: number, problem: string, title: string, answer: string) => {
    if (score > 0) out.push({ id, problem, title, answer, score })
  }

  if ((r.stress ?? 0) >= 4) {
    push(
      'stress',
      (r.stress ?? 0) * 2,
      `You rated deadline stress ${r.stress}/5`,
      'See the bad weeks coming',
      'Your term is charted by how much each week is actually worth, so the crunch shows up a month out instead of the night before.',
    )
  }
  if ((r.uncertainty ?? 0) >= 4) {
    push(
      'uncertainty',
      (r.uncertainty ?? 0) * 2,
      'You’re often unsure what’s due',
      'Upload the syllabus once',
      'Every date and weight comes out structured: and each one is tagged with whether it came from your professor or a classmate.',
    )
  }
  if ((r.grade_clarity ?? 3) <= 2) {
    push(
      'grade_clarity',
      (3 - (r.grade_clarity ?? 3)) * 3,
      'You don’t know where you stand',
      'Know your grade at any moment',
      'Enter one mark and your standing updates, including exactly what you need on everything left. Free, and it shows its arithmetic.',
    )
  }
  if ((r.scattered ?? 0) >= 4) {
    push(
      'scattered',
      (r.scattered ?? 0) * 1.5,
      'Your course info is scattered',
      'One screen instead of five',
      'Moodle, eConcordia, PDFs and email end up in one place: next to Concordia’s real add/drop and exam dates.',
    )
  }
  if (has(a, 'missed', 'missed')) {
    push(
      'missed',
      has(a, 'missed', 'Yes, missed it') ? 7 : 4,
      'You’ve missed something before',
      'Reminders that actually reach you',
      'Get a nudge on your phone before something is due, instead of depending on remembering at the right moment.',
    )
  }
  if (has(a, 'tools', 'Nothing')) {
    push(
      'no_system',
      5,
      'You’re running on memory',
      'Setup is one upload per class',
      'Memory holds up until three things land in the same week. Getting set up takes about a minute per course.',
    )
  }
  if (has(a, 'tools', 'Notion')) {
    push(
      'notion',
      4,
      'You built your own system in Notion',
      'Nothing to build or maintain',
      'This already knows what a weighted grade is, when Concordia’s deadlines are, and what your syllabus said.',
    )
  }
  if (has(a, 'price', 'free')) {
    push(
      'free',
      3,
      'You’d rather not pay for another app',
      'The core is free, with no time limit',
      'Deadline tracking, grade tracking and the grade-needed calculator cost nothing. Paid is only the extras on top.',
    )
  }

  return out.sort((x, y) => y.score - x.score).slice(0, 3)
}

/** One-line summary above the cards, matched to their sharpest pain. */
export function pitchHeadline(pitches: Pitch[]): string {
  if (pitches.length === 0) {
    return 'Sounds like you’ve got a system that works: genuinely, that’s rarer than you’d think.'
  }
  return 'What would change for you'
}

export async function submitPublicSurvey(a: PublicSurveyAnswers): Promise<void> {
  const answers: Record<string, string> = {}
  for (const [k, v] of Object.entries(a.answers)) {
    const t = v.trim()
    if (t) answers[k] = t.slice(0, 2000)
  }
  const { error } = await supabase.from('public_survey').insert({
    ratings: a.ratings,
    answers,
    email: a.email.trim() ? a.email.trim().slice(0, 200) : null,
    source: sourceFromUrl(),
  })
  if (error) throw error
}
