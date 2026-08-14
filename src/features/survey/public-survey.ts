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
