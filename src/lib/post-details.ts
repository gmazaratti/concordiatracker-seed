import { supabase } from './supabase'

/**
 * The extra facts a post carries, and the two writes behind them.
 *
 * Kept out of the component because two of these are decisions rather than
 * markup: what counts as a map link, and what it means to make an event out of
 * a post.
 */

export type Audience = 'everyone' | 'followers'

export interface PostDetailsValue {
  place: string
  placeUrl: string
  eventId: string | null
  audience: Audience
  /** ISO, or null for "out now". */
  publishAt: string | null
  hideLikes: boolean
  hideShares: boolean
}

export const EMPTY_DETAILS: PostDetailsValue = {
  place: '',
  placeUrl: '',
  eventId: null,
  audience: 'everyone',
  publishAt: null,
  hideLikes: false,
  hideShares: false,
}

/* ── Map links ────────────────────────────────────────────────────────────── */

const MAP_HOSTS = [
  'google.com',
  'google.ca',
  'maps.google.com',
  'goo.gl',
  'maps.app.goo.gl',
  'apple.com',
  'maps.apple.com',
  'openstreetmap.org',
]

export interface MapLink {
  ok: boolean
  /** The host, so the chip can say where it goes rather than just "link". */
  host: string
  /** True when it is recognisably a maps URL rather than any old link. */
  isMap: boolean
}

/**
 * ONLY http(s), and the host is reported rather than trusted.
 *
 * A pasted link is the one field on this screen somebody else's text can reach
 * — a club can put anything in it and every student who taps the post follows
 * it. So `javascript:` and friends are refused outright, and the UI shows the
 * host so what is about to open is legible before it opens.
 *
 * NON-MAP LINKS ARE ALLOWED but labelled honestly. Refusing them would mean
 * deciding which map provider a club is permitted to use, and the list would
 * be wrong the first time somebody used a campus wayfinder.
 */
export function readMapLink(raw: string): MapLink {
  const v = raw.trim()
  if (!v) return { ok: false, host: '', isMap: false }
  let url: URL
  try {
    url = new URL(v)
  } catch {
    return { ok: false, host: '', isMap: false }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, host: '', isMap: false }
  }
  const host = url.hostname.replace(/^www\./, '')
  return { ok: true, host, isMap: MAP_HOSTS.some((h) => host === h || host.endsWith('.' + h)) }
}

/* ── Events ───────────────────────────────────────────────────────────────── */

export interface OrgEventOption {
  id: string
  title: string
  start: string
}

/** This org's events, soonest first, for the "which one is this about" list. */
export async function listOrgEvents(orgId: string): Promise<OrgEventOption[]> {
  const { data, error } = await supabase
    .from('events')
    .select('id, title, start')
    .eq('org_id', orgId)
    .not('title', 'is', null)
    .neq('title', '')
    .order('start', { ascending: false })
    .limit(40)
  if (error || !data) return []
  return (data as OrgEventOption[]).filter((e) => e.title?.trim())
}

/**
 * Make an event out of a post.
 *
 * A POST IS NOT AN EVENT, and this is the whole reason it is a deliberate
 * action rather than something that happens on publish. Most posts are not
 * about a thing with a date; turning every one of them into a calendar entry
 * would fill the events tab with photographs. When a club says this one IS an
 * event, it has to supply the one fact a post does not carry — when.
 *
 * The caption seeds the title because it is usually the announcement, but it
 * is editable: a title is read in a list and a caption is read under a photo.
 */
export async function createEventFromPost(input: {
  orgId: string
  title: string
  start: string
  location: string
  description: string
}): Promise<{ id: string } | { error: string }> {
  const title = input.title.trim()
  if (!title) return { error: 'Give the event a name.' }
  if (!input.start) return { error: 'Pick a date and time.' }
  const { data, error } = await supabase
    .from('events')
    .insert({
      org_id: input.orgId,
      title,
      start: input.start,
      location: input.location.trim(),
      description: input.description.trim().slice(0, 2000),
      mode: input.location.trim() ? 'in-person' : 'online',
    })
    .select('id')
    .single()
  if (error || !data) {
    return {
      error:
        error?.code === '42501'
          ? 'Your organisation has to be approved before it can post events.'
          : 'Could not create that event.',
    }
  }
  return { id: data.id as string }
}
