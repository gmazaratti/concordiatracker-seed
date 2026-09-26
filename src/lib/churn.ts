import { supabase } from './supabase'

/**
 * Why somebody left (db/product_analytics.sql → churn_feedback).
 *
 * OPTIONAL, always. The reason list is fixed so answers can be counted; the
 * note is free text, capped at 500 characters, and only ever read by admins.
 * Someone who opted out of analytics can still answer: their answer is stored
 * without their account id.
 */
export type ChurnKind = 'pro_cancel' | 'account_delete'

export const CHURN_REASONS = [
  { value: 'too_expensive', label: 'Too expensive' },
  { value: 'not_using', label: 'I wasn’t using it enough' },
  { value: 'missing_feature', label: 'Missing something I need' },
  { value: 'found_alternative', label: 'Found something else' },
  { value: 'graduating', label: 'Graduating or leaving Concordia' },
  { value: 'technical_issues', label: 'It didn’t work well' },
  { value: 'privacy', label: 'Privacy concerns' },
  { value: 'other', label: 'Something else' },
] as const

export type ChurnReason = (typeof CHURN_REASONS)[number]['value']

/** True when stored, false when refused (e.g. already answered today). Throws on a network or server error. */
export async function submitChurn(kind: ChurnKind, reason: ChurnReason | null, detail: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('submit_churn_feedback', {
    p_kind: kind,
    p_reason: reason,
    p_detail: detail.trim().slice(0, 500) || null,
  })
  if (error) throw new Error(error.message)
  return data === true
}
