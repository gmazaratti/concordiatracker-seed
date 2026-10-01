/**
 * Concordia's published shuttle timetable page → timetable periods.
 *
 * https://www.concordia.ca/maps/shuttle-bus.html is the source of truth. It is
 * an ordinary CMS page: each period is a heading ("Fall departure times"), a
 * line "Schedule in effect: Sep. 8 – Oct. 9, 2026", then one table per group
 * of weekdays ("Monday — Thursday", "Friday") with a LOY column and an SGW
 * column. The two stops do NOT share times (Loyola leaves at 9:15, SGW at
 * 9:30), which is why a period stores both.
 *
 * PURE and import-free: the API reads the page and calls this (api/_shuttle.ts),
 * and Node tests it directly (shuttle-parse.test.mjs).
 *
 * IT FAILS CLOSED. A period it cannot date, or a table whose weekdays it cannot
 * read, is dropped rather than guessed, and the caller keeps the bundled
 * timetable when nothing usable comes back. A wrong bus time is worse than "no
 * schedule", so a half-parsed page must never replace a whole one.
 */

/** 0 = Sunday … 6 = Saturday, matching Date#getDay. */
export type ParsedWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface ParsedPeriod {
  label: string
  /** Inclusive, local YYYY-MM-DD. */
  validFrom: string
  validTo: string
  services: { days: ParsedWeekday[]; departures: { sgw: string[]; loy: string[] } }[]
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
}

const DAYS: Record<string, ParsedWeekday> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
}

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()

const pad = (n: number) => String(n).padStart(2, '0')

/** "Sep. 8 – Oct. 9, 2026" or "Oct. 13 – 16, 2026" → inclusive dates. */
export function parseRange(s: string): { from: string; to: string } | null {
  const m = s.match(
    /([A-Za-z]{3,9})\.?\s+(\d{1,2})\s*[–—-]\s*(?:([A-Za-z]{3,9})\.?\s+)?(\d{1,2}),?\s+(\d{4})/,
  )
  if (!m) return null
  const m1 = MONTHS[m[1].slice(0, 4).toLowerCase()] ?? MONTHS[m[1].slice(0, 3).toLowerCase()]
  const m2raw = m[3] ?? m[1]
  const m2 = MONTHS[m2raw.slice(0, 4).toLowerCase()] ?? MONTHS[m2raw.slice(0, 3).toLowerCase()]
  if (!m1 || !m2) return null
  const year = Number(m[5])
  // A range that wraps the new year ("Dec. 15 – Jan. 9, 2027") starts the year before.
  const fromYear = m2 < m1 ? year - 1 : year
  return {
    from: `${fromYear}-${pad(m1)}-${pad(Number(m[2]))}`,
    to: `${year}-${pad(m2)}-${pad(Number(m[4]))}`,
  }
}

/** "Monday — Thursday" / "Friday" / "Tuesday — Friday" → weekday numbers. */
export function parseDays(s: string): ParsedWeekday[] | null {
  const names = [...s.toLowerCase().matchAll(/(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/g)].map(
    (m) => DAYS[m[1]],
  )
  if (names.length === 0) return null
  if (names.length === 1) return [names[0]]
  const [a, b] = [names[0], names[names.length - 1]]
  if (/[–—-]|to\b/.test(s) && b >= a) {
    const out: ParsedWeekday[] = []
    for (let d = a; d <= b; d++) out.push(d as ParsedWeekday)
    return out
  }
  return [...new Set(names)]
}

/** "18:30*", "18:45 p.m.", "9:15" → "18:30" / "18:45" / "09:15"; anything else → null. */
export function parseTime(s: string): string | null {
  const m = s.match(/^\s*(\d{1,2})[:h](\d{2})/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return `${pad(h)}:${pad(min)}`
}

function parseTable(table: string): { days: ParsedWeekday[]; sgw: string[]; loy: string[] } | null {
  const rows = table.match(/<tr[\s\S]*?<\/tr>/g) ?? []
  const cellsOf = (r: string) => (r.match(/<t[hd][^>]*>[\s\S]*?<\/t[hd]>/g) ?? []).map(text)
  let days: ParsedWeekday[] | null = null
  let loyCol = -1
  let sgwCol = -1
  const loy: string[] = []
  const sgw: string[] = []
  for (const r of rows) {
    const cells = cellsOf(r)
    if (!days && cells.length === 1) {
      days = parseDays(cells[0])
      continue
    }
    if (loyCol < 0 && cells.some((c) => /loy/i.test(c)) && cells.some((c) => /s\.?g\.?w/i.test(c))) {
      loyCol = cells.findIndex((c) => /loy/i.test(c))
      sgwCol = cells.findIndex((c) => /s\.?g\.?w/i.test(c))
      continue
    }
    if (loyCol < 0) continue
    const l = parseTime(cells[loyCol] ?? '')
    const g = parseTime(cells[sgwCol] ?? '')
    if (l) loy.push(l)
    if (g) sgw.push(g)
  }
  if (!days || loyCol < 0 || (loy.length === 0 && sgw.length === 0)) return null
  const sort = (a: string[]) => [...new Set(a)].sort()
  return { days, loy: sort(loy), sgw: sort(sgw) }
}

/** Every dated period on the page, in page order. */
export function parseShuttlePage(html: string): ParsedPeriod[] {
  const clean = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '')
  // Split on the period headings; everything up to the next heading belongs to it.
  const parts = clean.split(/<h2[^>]*>/).slice(1)
  const out: ParsedPeriod[] = []
  for (const part of parts) {
    const heading = text(part.slice(0, part.indexOf('</h2>')))
    if (!/departure/i.test(heading)) continue
    const effective = text(part).match(/Schedule in effect:?\s*([^]*?\d{4})/i)
    const range = effective ? parseRange(effective[1]) : null
    if (!range) continue
    const services = (part.match(/<table[\s\S]*?<\/table>/g) ?? [])
      .map(parseTable)
      .filter((t): t is NonNullable<typeof t> => t !== null)
      .map((t) => ({ days: t.days, departures: { sgw: t.sgw, loy: t.loy } }))
    if (services.length === 0) continue
    out.push({
      label: heading.replace(/\s*(schedule\s*)?departure times\s*/i, '').trim() || heading,
      validFrom: range.from,
      validTo: range.to,
      services,
    })
  }
  return out
}
