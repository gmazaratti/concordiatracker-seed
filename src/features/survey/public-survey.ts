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
    id: 'concordia_support',
    label:
      'Would you support ConcordiaTracker seeking official recognition or funding from Concordia?',
    options: ['Yes', 'No', 'Not sure'],
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
  /** Course outlines the respondent chose to share. Optional, always. */
  files: File[]
}

export const EMPTY: PublicSurveyAnswers = { ratings: {}, answers: {}, email: '', files: [] }

/** What a respondent can hand over. PDFs and Word files, because that is what a
 *  syllabus actually is; nothing else is worth the attack surface. */
export const OUTLINE_TYPES = '.pdf,.doc,.docx'
export const MAX_OUTLINE_MB = 12
export const MAX_OUTLINES = 6

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

/**
 * A single-use token that rides in the "create your account" link.
 *
 * Not a short readable code, deliberately. A code on screen is a code that gets
 * screenshotted and passed round a group chat, and then the free week is a
 * coupon rather than a thank-you to the person who actually answered. This is
 * long, never displayed, and consumed by the first account that follows the
 * link — so it belongs to the respondent and to nobody they forward it to.
 */
function makeToken(): string {
  const bytes = new Uint8Array(18)
  crypto.getRandomValues(bytes)
  return [...bytes].map((b) => b.toString(36).padStart(2, '0')).join('')
}

/**
 * Upload the outlines, if any.
 *
 * Returns what landed. NEVER THROWS: a failed upload must not cost us the
 * answers, which are the thing we actually came for. A survey that refuses to
 * submit because a PDF was too big is a survey that gets abandoned in a queue
 * for donuts.
 */
async function uploadOutlines(files: File[]): Promise<{ path: string; name: string }[]> {
  const out: { path: string; name: string }[] = []
  for (const file of files.slice(0, MAX_OUTLINES)) {
    if (file.size > MAX_OUTLINE_MB * 1024 * 1024) continue
    // Random path, original name kept as metadata: two people uploading
    // "outline.pdf" must not collide, and a filename is not a good key.
    const ext = file.name.split('.').pop()?.toLowerCase().slice(0, 5) ?? 'pdf'
    const path = `${crypto.randomUUID()}.${ext}`
    try {
      const { error } = await supabase.storage.from('survey-outlines').upload(path, file)
      if (!error) out.push({ path, name: file.name.slice(0, 200) })
    } catch {
      /* bucket missing or offline — the answers still matter */
    }
  }
  return out
}

/** Returns the trial code, or null if the column is not there yet. */
export async function submitPublicSurvey(a: PublicSurveyAnswers): Promise<string | null> {
  const answers: Record<string, string> = {}
  for (const [k, v] of Object.entries(a.answers)) {
    const t = v.trim()
    if (t) answers[k] = t.slice(0, 2000)
  }

  const outlineFiles = a.files.length ? await uploadOutlines(a.files) : []
  const code = makeToken()

  const row = {
    ratings: a.ratings,
    answers,
    email: a.email.trim() ? a.email.trim().slice(0, 200) : null,
    source: sourceFromUrl(),
  }

  // Tries the full row first. If the migration has not been run the extra
  // columns do not exist, so it retries with just the original shape rather
  // than losing the response — the link may well be handed out before the SQL
  // is.
  const full = await supabase
    .from('public_survey')
    .insert({ ...row, reward_code: code, outline_files: outlineFiles })
  if (!full.error) return code

  const { error } = await supabase.from('public_survey').insert(row)
  if (error) throw error
  return null
}

/** Where the survey's "create your account" button goes. */
export function claimUrl(token: string): string {
  return `/app?claim=${encodeURIComponent(token)}`
}

const CLAIM_KEY = 'ct_survey_claim'

/**
 * Remember the token across the sign-up round trip.
 *
 * Signing up leaves the page — an email link, a Google redirect — and the
 * query string does not survive that. Stashing it means the free week still
 * lands when they come back, which is the whole point of tying it to the link
 * rather than to a code they were asked to keep.
 */
export function stashClaim(token: string): void {
  try {
    localStorage.setItem(CLAIM_KEY, token)
  } catch {
    /* private mode — the claim just has to happen in this session */
  }
}

export function takeClaim(): string | null {
  try {
    const v = localStorage.getItem(CLAIM_KEY)
    if (v) localStorage.removeItem(CLAIM_KEY)
    return v
  } catch {
    return null
  }
}

/** Trade the survey token for seven days of Pro. Signed-in only. */
export async function redeemSurveyCode(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('redeem_survey_code', { p_code: code })
  if (error) throw new Error(error.message)
  return data as string
}
