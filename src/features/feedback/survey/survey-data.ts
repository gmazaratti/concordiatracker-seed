import { supabase } from '@/lib/supabase'

/**
 * The in-app feedback survey. Gated on having used the app for ≥3 distinct days
 * (ui_state.visitDays) so responses come from people who actually tried it.
 * Stored one-row-per-user in `survey_response`; the user manages their own row,
 * an admin can read all (RLS). Recommending unlocks the referral reward.
 */

export interface RatingQ {
  id: string
  label: string
  low: string
  high: string
}

/** 1–5 scales — the quantitative core (easy to aggregate over time). */
export const RATING_QUESTIONS: RatingQ[] = [
  { id: 'onboarding', label: 'How was getting set up?', low: 'Confusing', high: 'Effortless' },
  { id: 'ease', label: 'How easy is it to use day to day?', low: 'Fiddly', high: 'Very easy' },
  { id: 'convenience', label: 'How convenient is it for your semester?', low: 'Not really', high: 'Very' },
  { id: 'uniqueness', label: 'How different does it feel from what you used before?', low: 'Same old', high: 'Nothing like it' },
  { id: 'price', label: 'How fair do the prices feel? ($5/mo · $15/semester)', low: 'Too pricey', high: 'Great value' },
  { id: 'keep_using', label: 'How likely are you to keep using it?', low: 'Unlikely', high: 'For sure' },
]

export interface TextQ {
  id: string
  label: string
  placeholder: string
  /** Required to submit (marked with *). */
  required?: boolean
  /** Minimum trimmed length, so answers are actually useful. */
  minLength?: number
}

/** Minimum useful length for a required free-text answer. */
export const MIN_TEXT = 12

/** Open-ended prompts — the qualitative "why" + growth signal. The two required
 * ones carry a min length so the reward can't be farmed with "idk". */
export const TEXT_QUESTIONS: TextQ[] = [
  { id: 'next_feature', label: 'If we built ONE thing next, what should it be?', placeholder: 'e.g. Sync with Moodle, group projects, dark widgets…', required: true, minLength: MIN_TEXT },
  { id: 'upgrade_reason', label: 'What would make the semester pass a no-brainer for you?', placeholder: 'What would justify $15 for the term?', required: true, minLength: MIN_TEXT },
  { id: 'comments', label: 'Anything else on your mind?', placeholder: 'Optional' },
]

export interface SurveyResponse {
  ratings: Record<string, number>
  recommend: boolean | null
  answers: Record<string, string>
}

export const EMPTY_SURVEY: SurveyResponse = { ratings: {}, recommend: null, answers: {} }

/** The "almost stopped" answer is a yes/no (answers.stopped) + a required
 * explanation (answers.stopped_detail) when the answer is yes. */
export function stoppedAnswered(r: SurveyResponse): boolean {
  const s = r.answers.stopped
  if (s !== 'yes' && s !== 'no') return false
  if (s === 'yes' && (r.answers.stopped_detail ?? '').trim().length < MIN_TEXT) return false
  return true
}

/** Everything required must be answered (with min length) before submit — this is
 * what gates the 3-day Pro reward, so the feedback is always substantive. */
export function isComplete(r: SurveyResponse): boolean {
  if (!RATING_QUESTIONS.every((q) => typeof r.ratings[q.id] === 'number')) return false
  if (r.recommend === null) return false
  for (const q of TEXT_QUESTIONS) {
    if (q.required && (r.answers[q.id] ?? '').trim().length < (q.minLength ?? 1)) return false
  }
  return stoppedAnswered(r)
}

// ── Persistence ───────────────────────────────────────────────────────────────
export async function loadMySurvey(userId: string): Promise<SurveyResponse | null> {
  const { data, error } = await supabase
    .from('survey_response')
    .select('ratings, recommend, answers')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return null
  return {
    ratings: (data.ratings as Record<string, number>) ?? {},
    recommend: data.recommend as boolean | null,
    answers: (data.answers as Record<string, string>) ?? {},
  }
}

export async function submitSurvey(userId: string, r: SurveyResponse): Promise<void> {
  // Trim + drop empty text answers so the stored blob stays clean.
  const answers: Record<string, string> = {}
  for (const [k, v] of Object.entries(r.answers)) {
    const t = v.trim()
    if (t) answers[k] = t.slice(0, 2000)
  }
  const { error } = await supabase.from('survey_response').upsert(
    {
      user_id: userId,
      ratings: r.ratings,
      recommend: r.recommend,
      answers,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (error) throw error
}

/** Days of Pro granted for completing the survey (when eligible). */
export const REWARD_DAYS = 3

/** Claim the 3-day Pro reward server-side (idempotent; verifies a submission
 * exists + ≥3 visit-days or admin, and never double-grants). Returns the new
 * pro_until ISO string, or null if not granted. */
export async function claimSurveyReward(): Promise<string | null> {
  const { data, error } = await supabase.rpc('claim_survey_reward')
  if (error) return null
  return (data as string | null) ?? null
}

// ── Referral reward ─────────────────────────────────────────────────────────────
/** Per-signup and per-paying-user credit toward the semester pass (in dollars). */
export const REFERRAL_SIGNUP_CREDIT = 0.5
export const REFERRAL_PAYING_CREDIT = 1

/** A shareable personal code — the handle if set, else a short slug of the id. */
export function referralCode(handle?: string | null, userId?: string | null): string {
  if (handle) return handle
  return (userId ?? '').replace(/-/g, '').slice(0, 8) || 'friend'
}

export function referralLink(code: string): string {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://concordiatracker.com'
  return `${origin}/?ref=${encodeURIComponent(code)}`
}
