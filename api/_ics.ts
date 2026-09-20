/**
 * A small iCalendar reader — enough of RFC 5545 to read a Moodle calendar.
 *
 * Deliberately NOT a general iCal library. Moodle emits a narrow, predictable
 * subset, and the risk here is not missing an exotic property: it is reading a
 * date wrong and telling a student their assignment is due on the wrong day.
 * So this handles the shapes Moodle actually produces and ignores the rest
 * rather than guessing at them.
 *
 * Pure string work, no imports, no clock — so it runs on the Edge and is
 * testable in Node without a network.
 */

export interface IcsEvent {
  /** RFC 5545 UID — stable across syncs, which is what makes this idempotent. */
  uid: string
  summary: string
  /** ISO 8601 UTC instant. */
  start: string
  /** Present when the event is a range rather than a single moment. */
  end?: string
  description?: string
  /** Moodle puts the course short name here on course-level events. */
  category?: string
  /** True for a whole-day VALUE=DATE event, which has no meaningful time. */
  allDay: boolean
}

/**
 * Undo RFC 5545 line folding.
 *
 * A folded line continues on the next line beginning with a space or tab, and
 * Moodle folds aggressively — assignment names are long. Joining on newlines
 * alone splits a title mid-word and the student sees half a name.
 */
function unfold(text: string): string[] {
  const out: string[] = []
  for (const raw of text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')) {
    if ((raw.startsWith(' ') || raw.startsWith('\t')) && out.length > 0) {
      out[out.length - 1] += raw.slice(1)
    } else {
      out.push(raw)
    }
  }
  return out
}

/** Split `DTSTART;VALUE=DATE:20261012` into name, params and value. */
function splitLine(
  line: string,
): { name: string; params: Record<string, string>; value: string } | null {
  const colon = line.indexOf(':')
  if (colon < 0) return null
  const head = line.slice(0, colon)
  const value = line.slice(colon + 1)
  const [name, ...rest] = head.split(';')
  const params: Record<string, string> = {}
  for (const p of rest) {
    const eq = p.indexOf('=')
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '')
  }
  return { name: name.toUpperCase(), params, value }
}

/** RFC 5545 TEXT escaping: escaped n, comma, semicolon and backslash. */
function unescapeText(v: string): string {
  return v
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim()
}

/**
 * Minutes that `tzid` is ahead of UTC at that wall-clock moment.
 *
 * Uses Intl rather than a table, so DST is the runtime's problem and not ours.
 * An unknown zone throws, and we return null — refusing the event instead of
 * placing it an hour out.
 */
function zoneOffsetMinutes(tzid: string, localIso: string): number | null {
  try {
    const guess = new Date(`${localIso}Z`)
    if (Number.isNaN(guess.getTime())) return null
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tzid,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    const p: Record<string, string> = {}
    for (const part of fmt.formatToParts(guess)) if (part.type !== 'literal') p[part.type] = part.value
    const asZone = Date.UTC(
      Number(p.year),
      Number(p.month) - 1,
      Number(p.day),
      Number(p.hour === '24' ? '00' : p.hour),
      Number(p.minute),
      Number(p.second),
    )
    return (asZone - guess.getTime()) / 60_000
  } catch {
    return null
  }
}

/**
 * Parse a DATE-TIME to a UTC ISO instant.
 *
 * Three forms appear: a trailing `Z` (UTC), a bare local time with a TZID
 * param, and a `VALUE=DATE` day. **A bare local time WITHOUT a TZID is
 * refused**, because the only way to resolve it is to assume a zone, and
 * assuming is how a midnight deadline lands on the wrong day. Moodle sends
 * UTC, so this costs nothing in practice and protects against the case where
 * it does not.
 */
export function parseIcsDate(
  value: string,
  params: Record<string, string>,
): { iso: string; allDay: boolean } | null {
  const v = value.trim()
  const day = /^(\d{4})(\d{2})(\d{2})$/.exec(v)
  if (day) {
    const [, y, m, d] = day
    // A whole-day event is a DAY, not an instant. Anchored at noon UTC so it
    // cannot slide into the neighbouring date in whatever timezone the reader
    // is in — the bug that collapsed Radar's week buckets, in a new costume.
    return { iso: `${y}-${m}-${d}T12:00:00.000Z`, allDay: true }
  }
  const dt = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(v)
  if (!dt) return null
  const [, y, m, d, hh, mm, ss, z] = dt
  if (z) return { iso: `${y}-${m}-${d}T${hh}:${mm}:${ss}.000Z`, allDay: false }

  // Floating local time. Accept it ONLY when the feed named a zone we can
  // resolve; otherwise refuse rather than guess.
  const tzid = params.TZID
  if (!tzid) return null
  const offset = zoneOffsetMinutes(tzid, `${y}-${m}-${d}T${hh}:${mm}:${ss}`)
  if (offset === null) return null
  const utc = Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss)) - offset * 60_000
  return { iso: new Date(utc).toISOString(), allDay: false }
}

/**
 * Read every VEVENT out of an iCalendar document.
 *
 * An event missing a UID or an unreadable DTSTART is SKIPPED, not guessed at
 * and not fatal: one malformed entry should cost that entry, never the sync.
 */
export function parseIcs(text: string): IcsEvent[] {
  const events: IcsEvent[] = []
  let cur: Partial<IcsEvent> | null = null

  for (const line of unfold(text)) {
    if (line === 'BEGIN:VEVENT') {
      cur = { allDay: false }
      continue
    }
    if (line === 'END:VEVENT') {
      if (cur && cur.uid && cur.start && cur.summary) events.push(cur as IcsEvent)
      cur = null
      continue
    }
    if (!cur) continue

    const parsed = splitLine(line)
    if (!parsed) continue
    const { name, params, value } = parsed

    if (name === 'UID') cur.uid = value.trim()
    else if (name === 'SUMMARY') cur.summary = unescapeText(value)
    else if (name === 'DESCRIPTION') cur.description = unescapeText(value)
    else if (name === 'CATEGORIES') cur.category = unescapeText(value)
    else if (name === 'DTSTART') {
      const d = parseIcsDate(value, params)
      if (d) {
        cur.start = d.iso
        cur.allDay = d.allDay
      }
    } else if (name === 'DTEND') {
      const d = parseIcsDate(value, params)
      if (d) cur.end = d.iso
    }
  }
  return events
}

/**
 * Does this URL look like a Moodle calendar export?
 *
 * Checked before anything is stored, so a mistyped paste is refused with a
 * useful sentence instead of being saved and then failing silently every
 * night. HTTPS is required: the URL carries a token, and sending it in clear
 * text would hand someone's calendar to anyone on the same network.
 */
export function validateMoodleIcsUrl(
  raw: string,
): { ok: true; url: string } | { ok: false; reason: string } {
  let u: URL
  try {
    u = new URL(raw.trim())
  } catch {
    return {
      ok: false,
      reason: 'That does not look like a web address. Paste the whole link, starting with https://',
    }
  }
  if (u.protocol !== 'https:') {
    return { ok: false, reason: 'The link must start with https:// — it carries a private token.' }
  }
  if (!/(^|\.)concordia\.ca$/i.test(u.hostname)) {
    return {
      ok: false,
      reason: `That link points at ${u.hostname}. Paste the calendar link from Concordia's Moodle.`,
    }
  }
  if (!/export_execute\.php$/i.test(u.pathname)) {
    return {
      ok: false,
      reason: 'That is a Moodle page, not the calendar link. Use Calendar → Export → Get calendar URL.',
    }
  }
  if (!u.searchParams.get('authtoken') || !u.searchParams.get('userid')) {
    return {
      ok: false,
      reason: 'That link is missing its token. Copy the whole URL from the "Get calendar URL" box.',
    }
  }
  return { ok: true, url: u.toString() }
}

/** A `todos` row, as the sync writes it. */
export interface MoodleTodoRow {
  user_id: string
  title: string
  due: string
  note: string | null
  source: string
  external_id: string
  /**
   * The date this moved FROM, when a sync finds Moodle has changed it.
   * Undefined on a first import and on an unchanged item; null clears a note
   * the student has already seen.
   */
  moved_from?: string | null
}

/**
 * Mark the rows whose deadline Moodle has changed since we last looked.
 *
 * Without this the upsert quietly rewrites the date and the student sees a
 * different day than they remember, with no way to tell whether the professor
 * moved it or they misread it. With it, the item can say what it moved from.
 *
 * `previous` is what we already hold, keyed by iCalendar UID. An item we have
 * not seen before is NOT a move — it is an arrival — so it gets nothing.
 * Comparison is on the INSTANT, not the string, because the two can differ in
 * formatting while meaning the same moment.
 */
export function markMoves(
  rows: MoodleTodoRow[],
  previous: Map<string, string>,
): MoodleTodoRow[] {
  return rows.map((r) => {
    const before = previous.get(r.external_id)
    if (!before) return r
    const a = new Date(before).getTime()
    const b = new Date(r.due).getTime()
    if (Number.isNaN(a) || Number.isNaN(b) || a === b) return r
    return { ...r, moved_from: new Date(a).toISOString() }
  })
}

/**
 * Turn calendar events into rows.
 *
 * PAST EVENTS ARE DROPPED. A Moodle calendar carries the whole year, and
 * importing September's submitted quizzes in November would bury the list the
 * student actually uses under things they have already done. `horizonDays`
 * keeps a short tail so something due yesterday is still visible.
 *
 * The clock is a PARAMETER, not a read — same rule as the rest of the app, and
 * it is what makes this testable.
 */
export function eventsToTodos(
  events: IcsEvent[],
  userId: string,
  now: Date,
  horizonDays = 3,
): MoodleTodoRow[] {
  const floor = now.getTime() - horizonDays * 86_400_000
  const rows: MoodleTodoRow[] = []
  const seen = new Set<string>()

  for (const e of events) {
    const t = new Date(e.start).getTime()
    if (Number.isNaN(t) || t < floor) continue
    if (seen.has(e.uid)) continue // a repeating event can emit its UID twice
    seen.add(e.uid)

    // Moodle titles read "Assignment 2 is due" / "Quiz 1 opens". Kept VERBATIM:
    // trimming "is due" would be tidier and would also turn an event about a
    // quiz OPENING into one that looks like a deadline.
    const title = e.summary.slice(0, 200)

    // The course short name is the single most useful thing in the payload —
    // it is what tells you which class the deadline belongs to.
    const note = [e.category, e.description?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()]
      .filter(Boolean)
      .join(' · ')
      .slice(0, 500)

    rows.push({
      user_id: userId,
      title,
      due: new Date(t).toISOString(),
      note: note || null,
      source: 'moodle',
      external_id: e.uid,
    })
  }
  return rows
}

/* ── Writing ────────────────────────────────────────────────────────────────
 *
 * The other direction: OUR deadlines, as a calendar somebody else subscribes
 * to. Same file as the reader on purpose — one place that knows how this
 * format escapes a comma and folds a long line, so the two halves cannot
 * disagree about it.
 *
 * Pure, like the rest of this module: it takes rows and a clock and returns a
 * string, so the whole feed is testable in Node with no network.
 */

export interface IcsOutEvent {
  /** Stable per item — this is what stops a re-fetch duplicating everything. */
  uid: string
  /** ISO instant. */
  start: string
  /** Minutes. A deadline is a moment, but a zero-length event is invisible in
   *  most month views, so it gets a short block ending AT the due time. */
  durationMinutes?: number
  summary: string
  description?: string
  url?: string
}

/** Escape a text value: RFC 5545 §3.3.11. Backslash first, or it doubles the
 *  escapes it just wrote. */
function escText(v: string): string {
  return v
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** `20260112T235900Z`. Always UTC, so the feed needs no VTIMEZONE and no
 *  client has to agree with us about what "America/Toronto" means. */
export function icsStamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/**
 * Fold to 75 OCTETS, not 75 characters.
 *
 * The limit in the spec is on bytes, and course titles carry accented
 * characters — a line of 75 characters can be 80 bytes and a strict parser
 * rejects it. Counting UTF-8 length and never splitting a surrogate pair is
 * the difference between a feed Apple accepts and one it silently drops.
 */
function fold(line: string): string {
  const bytes = (s: string) => new TextEncoder().encode(s).length
  if (bytes(line) <= 75) return line
  const out: string[] = []
  let cur = ''
  let limit = 75
  for (const ch of line) {
    if (bytes(cur + ch) > limit) {
      out.push(cur)
      cur = ch
      limit = 74 // continuation lines start with a space, which costs one
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out.join('\r\n ')
}

/**
 * A complete VCALENDAR.
 *
 * `REFRESH-INTERVAL` and `X-PUBLISHED-TTL` are the only levers we have over
 * how often a client re-reads this, and they are HINTS. Apple honours them.
 * Google ignores them entirely and refreshes subscribed calendars on its own
 * schedule, which is measured in hours. The UI says so rather than letting
 * someone conclude the sync is broken when it is Google being Google.
 */
export function buildIcs(opts: {
  name: string
  events: IcsOutEvent[]
  now: number
  /** Shown by some clients under the calendar's name. */
  description?: string
}): string {
  const stamp = icsStamp(new Date(opts.now).toISOString())
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ConcordiaTracker//Deadlines//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escText(opts.name)}`,
    'X-WR-TIMEZONE:America/Toronto',
    'REFRESH-INTERVAL;VALUE=DURATION:PT4H',
    'X-PUBLISHED-TTL:PT4H',
  ]
  if (opts.description) lines.push(`X-WR-CALDESC:${escText(opts.description)}`)

  for (const e of opts.events) {
    const startMs = new Date(e.start).getTime()
    if (!Number.isFinite(startMs)) continue // a bad date is dropped, never guessed
    const mins = e.durationMinutes ?? 30
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsStamp(new Date(startMs).toISOString())}`,
      `DTEND:${icsStamp(new Date(startMs + mins * 60_000).toISOString())}`,
      `SUMMARY:${escText(e.summary)}`,
    )
    if (e.description) lines.push(`DESCRIPTION:${escText(e.description)}`)
    if (e.url) lines.push(`URL:${e.url}`)
    lines.push('CATEGORIES:ConcordiaTracker', 'TRANSP:TRANSPARENT', 'END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  // CRLF, because RFC 5545 says CRLF and at least one real client cares.
  return lines.map(fold).join('\r\n') + '\r\n'
}
