/**
 * Today's opening hours for Concordia's libraries, from the library's own
 * LibCal calendar (librarycalendar.concordia.ca, institution 4163).
 *
 * The endpoint is keyless and CORS-open, so the widget reads it from the
 * browser and keeps the answer for the rest of the day; it costs our server
 * nothing. PURE and import-free: tested in library-hours.test.mjs.
 *
 * Only the two library BUILDINGS lead (Webster at SGW, Vanier at Loyola),
 * each with the one service desk students actually walk up to, because the
 * feed also lists a dozen bookable rooms and studios that would bury the
 * answer to "is the library open".
 */

export const LIBRARY_HOURS_URL =
  'https://librarycalendar.concordia.ca/api_hours_today.php?iid=4163&lid=0&format=json&systemTime=0'

interface RawLocation {
  lid: number
  name: string
  category?: string
  parent_lid?: number
  rendered?: string
  times?: { status?: string; currently_open?: boolean; hours?: { from: string; to: string }[] }
}

export interface LibraryToday {
  id: number
  /** "Webster Library", without the "(Building)" the feed appends. */
  name: string
  campus: 'SGW' | 'Loyola' | null
  /** "24 Hours", "9am - 9pm", "Closed", or null when the library has not set today. */
  hours: string | null
  openNow: boolean | null
  desk: { name: string; hours: string | null } | null
}

const CAMPUS: Record<string, 'SGW' | 'Loyola'> = { webster: 'SGW', vanier: 'Loyola' }
const DESKS = /loans|circulation/i

function hoursOf(l: RawLocation): string | null {
  const status = l.times?.status
  if (status === '24hours') return '24 hours'
  if (status === 'closed') return 'Closed'
  if (status === 'not-set' || !l.rendered) return null
  return l.rendered.replace(/\s*-\s*/g, ' – ')
}

export function parseLibraryHours(json: unknown): LibraryToday[] {
  const locs = (json as { locations?: RawLocation[] })?.locations
  if (!Array.isArray(locs)) return []
  const buildings = locs.filter((l) => l.category === 'library' && /\(building\)/i.test(l.name))
  return buildings.map((b) => {
    const base = b.name.replace(/\s*\(building\)\s*/i, '').trim()
    const key = Object.keys(CAMPUS).find((k) => base.toLowerCase().includes(k))
    const desk = locs.find((l) => l.parent_lid === b.lid && DESKS.test(l.name))
    return {
      id: b.lid,
      name: base,
      campus: key ? CAMPUS[key] : null,
      hours: hoursOf(b),
      openNow: typeof b.times?.currently_open === 'boolean' ? b.times.currently_open : null,
      desk: desk ? { name: desk.name, hours: hoursOf(desk) } : null,
    }
  })
}

/** Montreal's calendar date, the key the daily cache is stored under. */
export function montrealDay(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
