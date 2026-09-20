import { supabase } from '@/lib/supabase'

/**
 * Calendar sync — the client half of `api/calendar.ts` + `db/calendar_feed.sql`.
 *
 * The product is ONE URL. Google, Apple Calendar, Outlook and everything else
 * already know how to subscribe to an iCalendar feed, so there is no per
 * provider integration here and no OAuth anywhere — just a link, and the
 * three ways of handing it to the three places people keep a calendar.
 */

export interface CalendarFeed {
  token: string
  include_assessments: boolean
  include_tasks: boolean
  created_at: string
  last_fetched_at: string | null
  last_fetch_agent: string | null
  fetch_count: number
}

/** Null when there is no feed yet — a different screen from "set up". */
export async function myCalendarFeed(): Promise<CalendarFeed | null> {
  const { data, error } = await supabase.rpc('my_calendar_feed')
  if (error) throw error
  const rows = (data ?? []) as CalendarFeed[]
  return rows[0] ?? null
}

async function post<T>(body: object): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Sign in again to change this.')
  const res = await fetch('/api/calendar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => ({}))) as { error?: string } & T
  if (!res.ok) throw new Error(json.error || `That didn’t work (${res.status}).`)
  return json
}

export const enableFeed = () => post<{ token: string; url: string }>({ action: 'enable' })
export const rotateFeed = () => post<{ token: string; url: string }>({ action: 'rotate' })
export const disableFeed = () => post<{ ok: true }>({ action: 'disable' })
export const setFeedLayers = (layers: { assessments?: boolean; tasks?: boolean }) =>
  post<{ ok: true }>({ action: 'layers', ...layers })

/**
 * The feed URL, built in the browser from the current origin.
 *
 * Deliberately not whatever the API returned: on a preview deployment or in
 * the Capacitor shell the server's idea of the site URL and the one the
 * student is looking at can differ, and a link they cannot open is worse than
 * no button. The origin they are on is the origin that works.
 */
export function feedUrls(token: string, origin = window.location.origin) {
  const https = `${origin}/api/calendar/${token}.ics`
  // webcal:// is the scheme Apple registers, and the reason one tap on an
  // iPhone opens Calendar with a subscribe sheet instead of downloading a file.
  const webcal = https.replace(/^https?:/, 'webcal:')
  return {
    https,
    webcal,
    /**
     * `cid` takes the WEBCAL url, not the https one.
     *
     * Google answered "Unable to add calendar. Check the URL." for the https
     * form while the very same link subscribed first time in Apple Calendar
     * -- which rules the feed itself out, because Apple fetched it happily.
     * Google's add-by-URL wants the webcal scheme for an external calendar;
     * https is reserved for its own hosted ids.
     *
     * If it still refuses, the manual route in the panel always works, which
     * is why that route is written out rather than left implied.
     */
    google: `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(webcal)}`,
    outlook: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(
      https,
    )}&name=${encodeURIComponent('ConcordiaTracker')}`,
  }
}
