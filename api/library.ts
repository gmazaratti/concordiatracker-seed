/**
 * GET /api/library — how busy the libraries are right now.
 *
 * Concordia publishes a live sensor count per library. It goes through a server
 * route for the same reason the section lookup does: the Open Data key never
 * reaches a browser. It also gets to do the one thing the raw feed does not,
 * which is say when a number is not trustworthy.
 *
 * THE CARE THIS NEEDS: Grey Nuns reports `.0000` with a LastRecordTime of
 * 1900-01-01 — a sensor that has never reported, not a library with nobody in
 * it. Printing "0 people" there would be a confident lie about a building you
 * might walk to. Anything without a recent reading is returned as `null` with
 * its age, and the widget says it does not know.
 */
import { fail } from './_respond.js'

const BASE = 'https://opendata.concordia.ca/API/v1'

/** Older than this and it is history, not "right now". */
const STALE_MINUTES = 90

export interface LibraryOccupancy {
  id: string
  name: string
  /** People counted, or null when there is no usable reading. */
  people: number | null
  /** ISO timestamp of the reading, or null when there has never been one. */
  at: string | null
  /** Minutes since the reading. Null alongside a null `at`. */
  ageMinutes: number | null
  stale: boolean
}

const NAMES: Record<string, string> = {
  Webster: 'Webster (SGW)',
  Vanier: 'Vanier (Loyola)',
  GreyNuns: 'Grey Nuns (SGW)',
}

/**
 * "2026-09-08 22:10:00.000" — no zone, and it is Montreal local time.
 *
 * Parsed as local rather than UTC on purpose: `new Date(s)` on that shape is
 * implementation-defined, and reading it as UTC would report every fresh count
 * as four hours old and mark all of them stale.
 */
function parseStamp(raw: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(raw.trim())
  if (!m) return null
  const [, y, mo, d, h, mi, s] = m
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s))
  return Number.isNaN(date.getTime()) ? null : date
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function handler(_req: any, res: any) {
  const user = process.env.CONCORDIA_API_USER
  const key = process.env.CONCORDIA_API_KEY
  if (!user || !key) {
    return fail(res, 503, 'Library occupancy is not configured.', {
      code: 'not_configured',
      hint: 'CONCORDIA_API_USER and CONCORDIA_API_KEY must be set.',
    })
  }

  try {
    const upstream = await fetch(`${BASE}/library/occupancy/`, {
      headers: { Authorization: `Basic ${Buffer.from(`${user}:${key}`).toString('base64')}` },
    })
    if (!upstream.ok) {
      return fail(res, 502, 'Concordia did not answer.', {
        code: 'upstream_error',
        hint: `Open Data returned ${upstream.status}.`,
      })
    }

    const raw = (await upstream.json()) as Record<
      string,
      { Occupancy?: string; LastRecordTime?: string }
    >
    const now = Date.now()

    const libraries: LibraryOccupancy[] = Object.entries(raw).map(([id, v]) => {
      const at = parseStamp(String(v?.LastRecordTime ?? ''))
      const ageMinutes = at ? Math.round((now - at.getTime()) / 60000) : null
      // A reading with no usable timestamp is not a reading. `.0000` from a
      // sensor last heard from in 1900 must never render as "0 people here".
      const stale = ageMinutes === null || ageMinutes > STALE_MINUTES || ageMinutes < -5
      const count = Number(v?.Occupancy)
      return {
        id,
        name: NAMES[id] ?? id,
        people: stale || !Number.isFinite(count) ? null : Math.round(count),
        at: at ? at.toISOString() : null,
        ageMinutes,
        stale,
      }
    })

    // A minute of caching keeps a class-change rush from becoming a burst of
    // identical calls against a quota we share with the seat watcher.
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60')
    res.status(200).json({ libraries, fetchedAt: new Date(now).toISOString() })
  } catch {
    return fail(res, 502, 'Could not reach Concordia Open Data.', {
      code: 'upstream_error',
      hint: 'Try again in a minute.',
    })
  }
}
