/**
 * Concordia Open Data client. Server-only — the key must never reach a browser,
 * which is why there is no VITE_ prefix on either variable.
 *
 * Endpoint used:
 *   GET /API/v1/course/schedule/filter/*​/{subject}/{catalog}
 * returns one record per section per meeting pattern, including the four fields
 * this feature exists for: enrollmentCapacity, currentEnrollment,
 * waitlistCapacity, currentWaitlistTotal.
 */

export interface ScheduleRow {
  classNumber: string
  termCode: string
  subject: string
  catalog: string
  section: string
  courseTitle: string
  enrollmentCapacity: string
  currentEnrollment: string
  waitlistCapacity: string
  currentWaitlistTotal: string
  hasSeatReserved: string
  classStatus: string
}

const BASE = 'https://opendata.concordia.ca/API/v1'

function auth(): string {
  const user = process.env.CONCORDIA_API_USER
  const key = process.env.CONCORDIA_API_KEY
  if (!user || !key) throw new Error('Concordia Open Data is not configured.')
  return `Basic ${Buffer.from(`${user}:${key}`).toString('base64')}`
}

/** Every scheduled section for a course, across terms. */
export async function fetchSchedule(subject: string, catalog: string): Promise<ScheduleRow[]> {
  const url = `${BASE}/course/schedule/filter/*/${encodeURIComponent(subject)}/${encodeURIComponent(catalog)}`
  const res = await fetch(url, { headers: { Authorization: auth() } })
  if (!res.ok) throw new Error(`Concordia API ${res.status}`)
  const rows = (await res.json()) as ScheduleRow[]
  return Array.isArray(rows) ? rows : []
}

/** The API returns numbers as strings; anything unparseable becomes null so a
 * malformed record can't read as "0 of 0 seats" and fire a false alert. */
export function num(v: string | undefined): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Collapse the per-meeting-pattern rows to one record per section. A class that
 * meets Monday and Wednesday appears twice with identical enrollment numbers;
 * counting it twice would be harmless here but confusing downstream.
 */
export function bySection(rows: ScheduleRow[]): Map<string, ScheduleRow> {
  const out = new Map<string, ScheduleRow>()
  for (const r of rows) {
    if (r.classStatus && r.classStatus !== 'Active') continue
    const key = `${r.termCode}:${r.classNumber}`
    if (!out.has(key)) out.set(key, r)
  }
  return out
}
