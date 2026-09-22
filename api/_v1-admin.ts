/**
 * /api/v1/admin/… — the admin console's data, over HTTP.
 *
 * WHY AN ALLOWLIST AND NOT A PASSTHROUGH. There are roughly fifty-five
 * admin_* functions and more will be written. Exposing "any function whose
 * name starts with admin_" would mean the next one somebody adds is public to
 * a token the moment it is created, which is not a decision anybody made. The
 * map below is the decision, and it is reviewable in one screen.
 *
 * WHAT IS DELIBERATELY ABSENT. Every destructive call — deleting an
 * organisation, a comment, a feature request, removing a teammate or a
 * teacher. Those stay in the console behind a human until they are asked for
 * explicitly. Creating and editing is here; undoing somebody's existence is
 * not.
 *
 * These run as the admin account, so each function's own is_admin() check is
 * what actually authorises the call. This file chooses what may be reached,
 * never whether the caller is allowed to reach it.
 */
import { rpcAsUser } from './_v1-jwt.js'
import type { Out } from './_v1-orgs.js'

type ArgType = 'text' | 'int' | 'bool' | 'uuid'

interface Entry {
  rpc: string
  /** Arg name as the function declares it, mapped from a query param or a
   *  body field of the same name minus the p_ prefix. */
  args?: Record<string, ArgType>
  write?: boolean
  note?: string
}

export const ADMIN_MAP: Record<string, Entry> = {
  // ── The numbers ──────────────────────────────────────────────────────
  overview: { rpc: 'admin_overview_counts' },
  dashboard: { rpc: 'admin_dashboard_stats' },
  revenue: { rpc: 'admin_revenue' },
  billing: { rpc: 'admin_billing_overview' },
  'pro-breakdown': { rpc: 'admin_pro_breakdown' },
  timeseries: { rpc: 'admin_daily_series', args: { p_days: 'int' } },
  traffic: { rpc: 'admin_traffic_stats', args: { p_days: 'int' } },

  // ── People ───────────────────────────────────────────────────────────
  users: { rpc: 'admin_list_users' },
  user: { rpc: 'admin_user_summary', args: { p_user: 'uuid' } },
  'user-courses': { rpc: 'admin_user_courses', args: { p_user: 'uuid' } },
  'user-visits': { rpc: 'admin_user_visits', args: { p_user: 'uuid', p_limit: 'int' } },
  online: { rpc: 'admin_online_now', args: { p_minutes: 'int' } },
  'social-graph': { rpc: 'admin_social_graph', args: { p_limit: 'int' } },

  // ── The queues ───────────────────────────────────────────────────────
  tickets: { rpc: 'admin_tickets', args: { p_status: 'text', p_q: 'text' } },
  'open-tickets': { rpc: 'admin_open_ticket_count' },
  'bug-reports': { rpc: 'admin_list_bug_reports' },
  'data-reports': { rpc: 'admin_list_data_reports' },
  applications: { rpc: 'admin_list_applications' },
  'org-applications': { rpc: 'admin_org_applications' },
  'parse-failures': { rpc: 'admin_parse_failures' },

  // ── Portals ──────────────────────────────────────────────────────────
  orgs: { rpc: 'admin_list_portal_orgs' },
  'org-members': { rpc: 'admin_list_org_members', args: { p_org_id: 'uuid' } },
  teachers: { rpc: 'admin_list_portal_teachers' },

  // ── The record of what happened ──────────────────────────────────────
  audit: { rpc: 'admin_audit_recent', args: { p_limit: 'int' } },
  'audit-user': { rpc: 'admin_audit_for_user', args: { p_target: 'uuid', p_limit: 'int' } },
  activity: { rpc: 'admin_recent_activity', args: { p_limit: 'int' } },
  'activity-feed': { rpc: 'admin_activity_feed' },
  digests: { rpc: 'admin_activity_digests' },
  'ai-replies': { rpc: 'admin_ai_replies', args: { p_days: 'int', p_limit: 'int' } },
  'ai-reply-count': { rpc: 'admin_ai_reply_count', args: { p_days: 'int' } },
  'message-replies': { rpc: 'admin_message_replies', args: { p_limit: 'int' } },
  messages: { rpc: 'admin_messages_for', args: { p_user: 'uuid' } },

  // ── Survey ───────────────────────────────────────────────────────────
  survey: { rpc: 'admin_public_survey' },
  'survey-outlines': { rpc: 'admin_list_survey_outlines' },
  'survey-responses': { rpc: 'admin_list_survey_responses' },

  // ── Writes. Non-destructive only. ────────────────────────────────────
  'set-plan': {
    rpc: 'admin_set_plan',
    args: { p_target: 'uuid', p_pro: 'bool', p_reason: 'text', p_until: 'text' },
    write: true,
  },
  'set-flags': {
    rpc: 'admin_set_flags',
    args: { p_target: 'uuid', p_internal: 'bool', p_comped: 'bool', p_reason: 'text' },
    write: true,
  },
  'set-user-notes': { rpc: 'admin_set_user_notes', args: { p_uid: 'uuid', p_notes: 'text' }, write: true },
  'set-vanity': { rpc: 'admin_set_vanity', args: { p_uid: 'uuid', p_code: 'text' }, write: true },
  'set-blueprint-permission': {
    rpc: 'admin_set_blueprint_permission',
    args: { p_uid: 'uuid', p_allowed: 'bool' },
    write: true,
  },
  'set-org-status': { rpc: 'admin_set_org_status', args: { p_org_id: 'uuid', p_status: 'text' }, write: true },
  'resolve-application': {
    rpc: 'admin_resolve_application',
    args: { p_kind: 'text', p_ref_id: 'text', p_accept: 'bool' },
    write: true,
  },
  'extend-org-invite': {
    rpc: 'admin_extend_org_invite',
    args: { p_id: 'uuid', p_days: 'int', p_reset_uses: 'bool' },
    write: true,
  },
  'moderate-request': {
    rpc: 'admin_moderate_request',
    args: { p_id: 'uuid', p_pinned: 'bool', p_hidden: 'bool', p_status: 'text' },
    write: true,
  },
  'moderate-comment': { rpc: 'admin_moderate_comment', args: { p_id: 'uuid', p_hidden: 'bool' }, write: true },
  'update-bug-report': {
    rpc: 'admin_update_bug_report',
    args: { p_id: 'uuid', p_status: 'text', p_notes: 'text', p_public: 'bool' },
    write: true,
  },
  'update-data-report': {
    rpc: 'admin_update_data_report',
    args: { p_id: 'uuid', p_status: 'text', p_notes: 'text' },
    write: true,
  },
  'mark-activity-seen': { rpc: 'admin_mark_activity_seen', write: true },
}

/** Deliberately unreachable, and named so the refusal can say why. */
export const WITHHELD: Record<string, string> = {
  'delete-org': 'admin_delete_org',
  'delete-comment': 'admin_delete_comment',
  'delete-request': 'admin_delete_request',
  'remove-org-member': 'admin_remove_org_member',
  'remove-teacher': 'admin_remove_teacher',
}

function coerce(v: unknown, t: ArgType): unknown {
  if (v === undefined || v === null || v === '') return null
  if (t === 'int') {
    const n = Number(v)
    return Number.isFinite(n) ? Math.trunc(n) : null
  }
  if (t === 'bool') {
    if (typeof v === 'boolean') return v
    const s = String(v).toLowerCase()
    return s === 'true' || s === '1' ? true : s === 'false' || s === '0' ? false : null
  }
  return String(v)
}

export function adminIndex(): Out {
  return {
    status: 200,
    json: {
      reads: Object.entries(ADMIN_MAP)
        .filter(([, e]) => !e.write)
        .map(([k, e]) => ({ name: k, path: `/api/v1/admin/${k}`, args: Object.keys(e.args ?? {}) })),
      writes: Object.entries(ADMIN_MAP)
        .filter(([, e]) => e.write)
        .map(([k, e]) => ({ name: k, path: `/api/v1/admin/${k}`, method: 'POST', args: Object.keys(e.args ?? {}) })),
      withheld: Object.keys(WITHHELD),
      notes: [
        'Reads are GET and take their arguments as query parameters; the p_ prefix is optional.',
        'Writes are POST and take a JSON body with the same names.',
        'Destructive calls are not reachable through the API on purpose. Use the admin console.',
      ],
    },
  }
}

export async function adminCall(
  jwt: string,
  name: string,
  method: string,
  query: Record<string, unknown>,
  body: Record<string, unknown>,
): Promise<Out> {
  if (WITHHELD[name]) {
    return {
      status: 403,
      json: {
        error: `"${name}" is deliberately not reachable through the API.`,
        reason: 'withheld',
        hint: 'Deleting an organisation, a teammate or somebody\'s post is held back behind the admin console until it is asked for explicitly.',
      },
    }
  }
  const entry = ADMIN_MAP[name]
  if (!entry) {
    return { status: 404, json: { error: `No admin endpoint called "${name}". GET /api/v1/admin for the list.` } }
  }
  const isWrite = entry.write === true
  if (isWrite && method !== 'POST') {
    return { status: 405, json: { error: `"${name}" changes something, so it is a POST.` } }
  }
  if (!isWrite && method !== 'GET') {
    return { status: 405, json: { error: `"${name}" is read-only.` } }
  }

  const source = isWrite ? body : query
  const args: Record<string, unknown> = {}
  for (const [arg, type] of Object.entries(entry.args ?? {})) {
    const short = arg.replace(/^p_/, '')
    const raw = source[arg] ?? source[short]
    args[arg] = coerce(raw, type)
  }

  const r = await rpcAsUser<unknown>(jwt, entry.rpc, args)
  if (!r.ok) {
    // A definer function that refuses says so in its own words; passing that
    // through beats replacing it with a generic sentence that hides which
    // rule fired.
    const msg = r.error?.message ?? 'That call failed.'
    const status = /not authorized|permission|denied/i.test(msg) ? 403 : r.status >= 400 ? r.status : 400
    return { status, json: { error: msg, rpc: entry.rpc } }
  }
  if (isWrite) {
    await rpcAsUser(jwt, 'ct_agent_audit', { p_action: `agent.admin.${name}`, p_target: null, p_value: args })
  }
  return { status: 200, json: { name, data: r.data ?? null } }
}
