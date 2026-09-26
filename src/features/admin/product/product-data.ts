import { supabase } from '@/lib/supabase'

/**
 * The product-analytics reports (db/product_analytics.sql). Every function is
 * admin-gated in the database and excludes internal and opted-out accounts,
 * so this module only fetches and gives each answer a type.
 */

export interface ProductReport {
  days: number
  tracking_since: string | null
  activation: {
    signups: number
    signup_completed: number
    first_course_added: number
    first_assignment_completed: number
    aha_course_within_7d: number
    median_hours_to_first_course: number | null
  }
  channels: { channel: string; signups: number; aha: number }[]
  adoption: { monthly_active: number; features: { feature: string; users: number }[] }
}

export interface InviteFunnel {
  definition: string
  modes: { mode: string; sent: number; opened: number; claimed: number; org_active: number }[]
}

export interface EmailReport {
  note: string
  templates: {
    template: string
    sent: number
    delivered: number
    opened: number
    clicked: number
    bounced: number
    complained: number
  }[]
}

export interface ParseReport {
  note: string
  total: number
  succeeded: number
  by_file_type: { file_type: string; total: number; succeeded: number }[]
  by_read_path: { read_path: string; total: number; succeeded: number }[]
  failure_reasons: { reason: string; count: number }[]
}

export interface CohortReport {
  note: string
  cohorts: { week: string; size: number; active: number[] }[]
}

export interface ChurnReport {
  pro_cancel_scheduled: number
  pro_cancelled: number
  account_delete_requested: number
  accounts_deleted: number
  reasons: { kind: string; reason: string; count: number }[]
  recent: { kind: string; reason: string | null; detail: string; plan: string | null; at: string }[]
}

export interface ProductBundle {
  product: ProductReport
  invites: InviteFunnel
  email: EmailReport
  parse: ParseReport
  cohorts: CohortReport
  churn: ChurnReport
}

async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(`${fn}: ${error.message}`)
  if (data == null) throw new Error(`${fn}: no data (are you signed in as an admin?)`)
  return data as T
}

export async function loadProduct(days: number): Promise<ProductBundle> {
  const [product, invites, email, parse, cohorts, churn] = await Promise.all([
    call<ProductReport>('admin_product_analytics', { p_days: days }),
    call<InviteFunnel>('admin_invite_funnel', { p_days: days }),
    call<EmailReport>('admin_email_engagement', { p_days: days }),
    call<ParseReport>('admin_parse_analytics', { p_days: days }),
    call<CohortReport>('admin_cohort_retention', { p_weeks: 8 }),
    call<ChurnReport>('admin_churn', { p_days: days }),
  ])
  return { product, invites, email, parse, cohorts, churn }
}

export const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : '·')
