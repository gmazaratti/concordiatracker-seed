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
      'Nothing — I just remember',
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
    label: 'Have you ever missed — or nearly missed — something because you didn’t know it was due?',
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
    placeholder: 'Be blunt — this is the most useful answer on the page.',
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
  /** Their problem, said back to them in their words. */
  problem: string
  /** What actually changes — must map to a feature that really exists. */
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
  const push = (id: string, score: number, problem: string, answer: string) => {
    if (score > 0) out.push({ id, problem, answer, score })
  }

  if ((r.stress ?? 0) >= 4) {
    push(
      'stress',
      (r.stress ?? 0) * 2,
      'Deadlines are stressing you out.',
      'Most of that stress is not knowing what’s coming. Your term gets charted week by week — weighted by how much each thing is actually worth — so you can see the brutal week a month before it lands instead of the night before.',
    )
  }
  if ((r.uncertainty ?? 0) >= 4) {
    push(
      'uncertainty',
      (r.uncertainty ?? 0) * 2,
      'You’re often not sure what’s due.',
      'You upload the syllabus once and every date, weight, and deadline comes out structured — no copying into a calendar. Dates carry a badge showing whether they came from the professor or from classmates, so you know what to trust.',
    )
  }
  if ((r.grade_clarity ?? 3) <= 2) {
    push(
      'grade_clarity',
      (3 - (r.grade_clarity ?? 3)) * 3,
      'You don’t really know where you stand in your classes.',
      'Enter a grade and your standing updates instantly — including exactly what you need on everything left to hit the grade you want. That calculator is free, and it shows its arithmetic so you can check it.',
    )
  }
  if ((r.scattered ?? 0) >= 4) {
    push(
      'scattered',
      (r.scattered ?? 0) * 1.5,
      'Your course info is spread across too many places.',
      'Moodle, eConcordia, a PDF, an email — it all ends up in one screen, alongside Concordia’s official academic dates so add/drop and exam periods aren’t a separate thing to remember.',
    )
  }
  if (has(a, 'missed', 'missed')) {
    push(
      'missed',
      has(a, 'missed', 'Yes, missed it') ? 7 : 4,
      'You’ve missed — or nearly missed — something.',
      'You can set reminders that reach your phone before things are due, so it doesn’t come down to remembering at the right moment.',
    )
  }
  if (has(a, 'tools', 'Nothing')) {
    push(
      'no_system',
      5,
      'You’re running on memory right now.',
      'That works until the week three things land at once. Setting this up is one syllabus upload per class — not an afternoon of building a system.',
    )
  }
  if (has(a, 'tools', 'Notion')) {
    push(
      'notion',
      4,
      'You’re keeping it together in Notion.',
      'Notion is great, but you built that yourself and you maintain it yourself. This arrives already knowing what a weighted grade is, when Concordia’s deadlines are, and what your syllabus said.',
    )
  }
  if (has(a, 'price', 'free')) {
    push(
      'free',
      3,
      'You’d rather not pay for another thing.',
      'Then don’t. Deadline tracking, grade tracking, and the grade-needed calculator are free with no time limit — the paid tier is only the extras on top.',
    )
  }

  return out.sort((x, y) => y.score - x.score).slice(0, 3)
}

/** One-line summary above the cards, matched to their sharpest pain. */
export function pitchHeadline(pitches: Pitch[]): string {
  if (pitches.length === 0) {
    return 'Sounds like you’ve got a system that works — genuinely, that’s rarer than you’d think.'
  }
  return 'Based on what you said, here’s what would actually change:'
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
