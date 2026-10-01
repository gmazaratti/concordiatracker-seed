/**
 * GET /api/shuttle — Concordia's published shuttle timetable, parsed.
 *
 * Reads https://www.concordia.ca/maps/shuttle-bus.html and returns its periods
 * (lib/shuttle-parse.ts). Served through `sections.ts` (`?feed=shuttle`, via a
 * rewrite) because the platform allows twelve functions and every one is taken.
 *
 * CACHED AT THE EDGE FOR SIX HOURS (a day stale-while-revalidate), so the
 * whole user base costs about four page fetches a day per region. The page
 * changes a few times a term; six hours is fresher than it needs to be.
 *
 * A page that parses to NOTHING answers 502, never `[]`: the client keeps its
 * bundled timetable on any non-200, and an empty 200 would read as "no shuttle".
 * The live-GPS backend behind Concordia's tracker is deliberately not used.
 */
import { parseShuttlePage } from '../src/lib/shuttle-parse.js'
import { fail } from './_respond.js'

const PAGE = 'https://www.concordia.ca/maps/shuttle-bus.html'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function shuttleHandler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    fail(res, 405, 'Use GET.', { code: 'method_not_allowed' })
    return
  }
  try {
    const r = await fetch(PAGE, {
      headers: { 'user-agent': 'ConcordiaTrackerBot/1.0 (+https://concordiatracker.com/about; shuttle timetable)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!r.ok) {
      fail(res, 502, 'The shuttle page did not answer.', { code: 'upstream_error' })
      return
    }
    const periods = parseShuttlePage(await r.text())
    if (periods.length === 0) {
      fail(res, 502, 'The shuttle page had no timetable we could read.', { code: 'upstream_error' })
      return
    }
    res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400')
    res.status(200).json({ source: PAGE, fetchedAt: new Date().toISOString(), periods })
  } catch {
    fail(res, 502, 'The shuttle page did not answer.', { code: 'upstream_error' })
  }
}
