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
  /** LEC / TUT / LAB — each is its own classNumber with its own capacity, so a
   * student watching "COMP 248" has to say WHICH component they need. */
  componentCode: string
  componentDescription: string
  /** SGW or LOY — the campus. Paired with meeting times this is what reveals a
   * back-to-back pair that needs the shuttle. */
  locationCode: string
  instructionModeDescription: string
  buildingCode: string
  room: string
  classStartTime: string
  classEndTime: string
  modays: string
  tuesdays: string
  wednesdays: string
  thursdays: string
  fridays: string
  saturdays: string
  sundays: string
}

/** Concordia spells Monday "modays" in the payload. Not a typo here. */
const DAY_FIELDS = [
  ['sundays', 'Sun'],
  ['modays', 'Mon'],
  ['tuesdays', 'Tue'],
  ['wednesdays', 'Wed'],
  ['thursdays', 'Thu'],
  ['fridays', 'Fri'],
  ['saturdays', 'Sat'],
] as const

/**
 * "Mon · Wed 10:15–11:30" from a schedule row — the exact shape
 * `course.meetingTimes` already uses, so the Next class widget's parser needs
 * no changes.
 *
 * Times arrive as "10.15.00". Returns null rather than a partial string when
 * anything is missing: a half-parsed meeting time is worse than none, because
 * the widget treats unparseable input as "no class" and stays quiet.
 */
export function meetingTimeString(r: ScheduleRow): string | null {
  const days = DAY_FIELDS.filter(([f]) => r[f] === 'Y').map(([, label]) => label)
  if (!days.length) return null
  const clock = (t: string | undefined) => {
    if (!t) return null
    const [h, m] = t.split('.')
    if (h === undefined || m === undefined) return null
    return `${h.padStart(2, '0')}:${m}`
  }
  const start = clock(r.classStartTime)
  const end = clock(r.classEndTime)
  if (!start || !end) return null
  return `${days.join(' · ')} ${start}–${end}`
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

export interface CatalogRow {
  ID: string
  title: string
  subject: string
  catalog: string
  career: string
  classUnit: string
  prerequisites: string | null
  crosslisted: string | null
}

/**
 * The entire course catalogue in one request, around 7,900 courses and 1.4MB.
 *
 * Only the sync job calls this. Anything user-facing reads the Supabase mirror
 * instead, so a search never costs Concordia a request.
 */
export async function fetchCatalog(): Promise<CatalogRow[]> {
  const res = await fetch(`${BASE}/course/catalog/filter/*/*/*`, {
    headers: { Authorization: auth() },
  })
  if (!res.ok) throw new Error(`Concordia catalogue ${res.status}`)
  const rows = (await res.json()) as CatalogRow[]
  return Array.isArray(rows) ? rows : []
}

/** One course description, keyed by the same ID the catalogue uses. */
export interface DescriptionRow {
  ID: string
  description: string
}

/**
 * Every course description in one call.
 *
 * A separate endpoint from the catalogue, joined on ID. Same wildcard shape, so
 * the same "fetch it all once and mirror it" approach applies: descriptions
 * change about as often as the catalogue does.
 */
export async function fetchDescriptions(): Promise<DescriptionRow[]> {
  const res = await fetch(`${BASE}/course/description/filter/*`, {
    headers: { Authorization: auth() },
  })
  if (!res.ok) throw new Error(`Concordia descriptions ${res.status}`)
  const rows = (await res.json()) as DescriptionRow[]
  return Array.isArray(rows) ? rows : []
}
