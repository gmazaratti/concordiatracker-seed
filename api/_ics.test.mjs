/**
 * node api/_ics.test.mjs
 *
 * The parser's whole job is dates, and a date read wrong here tells a student
 * their assignment is due on a day it is not. So the cases below are mostly
 * about the ways a calendar can lie to you: folded lines, floating times with
 * no zone, whole-day events that slide across midnight, and a malformed entry
 * that must cost itself and not the sync.
 */
import {
  parseIcs,
  parseIcsDate,
  validateMoodleIcsUrl,
  eventsToTodos,
  markMoves,
  buildIcs,
  icsStamp,
} from './_ics.ts'

let failures = 0
function check(label, ok, detail) {
  if (!ok) failures++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok || detail === undefined ? '' : `\n         ${detail}`}`)
}
const eq = (label, actual, expected) =>
  check(label, JSON.stringify(actual) === JSON.stringify(expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)

console.log('parseIcsDate')
eq('a UTC stamp is taken as written', parseIcsDate('20261012T235900Z', {}), {
  iso: '2026-10-12T23:59:00.000Z',
  allDay: false,
})
eq('a whole day is anchored at noon UTC, so it cannot slide a date', parseIcsDate('20261012', {}), {
  iso: '2026-10-12T12:00:00.000Z',
  allDay: true,
})
check(
  'a floating time with NO zone is refused rather than guessed',
  parseIcsDate('20261012T235900', {}) === null,
)
eq(
  'a floating time WITH a zone resolves through Intl (Oct = EDT, UTC-4)',
  parseIcsDate('20261012T235900', { TZID: 'America/Toronto' }),
  { iso: '2026-10-13T03:59:00.000Z', allDay: false },
)
eq(
  'and the same wall clock in December is EST, UTC-5',
  parseIcsDate('20261212T235900', { TZID: 'America/Toronto' }),
  { iso: '2026-12-13T04:59:00.000Z', allDay: false },
)
check('an unknown zone is refused', parseIcsDate('20261012T120000', { TZID: 'Mars/Olympus' }) === null)
check('nonsense is refused', parseIcsDate('next tuesday', {}) === null)

console.log('\nparseIcs')
// A realistic Moodle payload: CRLF, a folded SUMMARY, an escaped comma, one
// event with no UID, and one with an unreadable date.
const FEED = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Moodle Pty Ltd//NONSGML Moodle Version 2024042200//EN',
  'BEGIN:VEVENT',
  'UID:1234567@moodle.concordia.ca',
  'SUMMARY:COMM 305 Assignment 2 is due\\, chapters 1-6',
  'DTSTART:20261012T235900Z',
  'DTEND:20261012T235900Z',
  'CATEGORIES:COMM 305 EC',
  'DESCRIPTION:Submit through the <b>assignment</b> link.',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:folded@moodle.concordia.ca',
  'SUMMARY:COMP 248 Lab 4 is due and this title is long enough that Moodle ',
  ' folds it across two lines',
  'DTSTART;VALUE=DATE:20261101',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'SUMMARY:No UID so this must be skipped',
  'DTSTART:20261012T235900Z',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:baddate@moodle.concordia.ca',
  'SUMMARY:Unreadable date, must be skipped',
  'DTSTART:whenever',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n')

const parsed = parseIcs(FEED)
eq('two good events out of four entries', parsed.length, 2)
eq('an escaped comma comes back as a comma', parsed[0].summary, 'COMM 305 Assignment 2 is due, chapters 1-6')
eq('the UTC deadline survives', parsed[0].start, '2026-10-12T23:59:00.000Z')
eq('the course short name is kept', parsed[0].category, 'COMM 305 EC')
eq(
  'a folded title is rejoined without losing the space',
  parsed[1].summary,
  'COMP 248 Lab 4 is due and this title is long enough that Moodle folds it across two lines',
)
check('the whole-day event is flagged as one', parsed[1].allDay === true)
check('no event without a UID got through', !parsed.some((e) => /No UID/.test(e.summary)))
check('no event with an unreadable date got through', !parsed.some((e) => /Unreadable/.test(e.summary)))
eq('an empty document is empty, not an error', parseIcs('').length, 0)
eq('a truncated document does not throw', parseIcs('BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:x').length, 0)

console.log('\neventsToTodos')
const NOW = new Date('2026-10-01T12:00:00Z')
const rows = eventsToTodos(parsed, 'u1', NOW)
eq('both upcoming events become rows', rows.length, 2)
eq('the UID is carried, which is what makes a re-sync idempotent', rows[0].external_id, '1234567@moodle.concordia.ca')
eq('tagged as moodle so a hand-typed todo is never touched', rows[0].source, 'moodle')
eq('the course name leads the note', rows[0].note, 'COMM 305 EC · Submit through the assignment link.')
check('HTML is stripped out of the note', !rows[0].note.includes('<b>'))

const old = eventsToTodos(parsed, 'u1', new Date('2027-06-01T00:00:00Z'))
eq('a calendar full of finished work imports nothing', old.length, 0)
const justPast = eventsToTodos(
  [{ uid: 'p', summary: 'Due yesterday', start: '2026-09-30T23:59:00.000Z', allDay: false }],
  'u1',
  NOW,
)
eq('but yesterday is still in the window', justPast.length, 1)
const dupes = eventsToTodos(
  [
    { uid: 'same', summary: 'A', start: '2026-10-05T12:00:00.000Z', allDay: false },
    { uid: 'same', summary: 'A again', start: '2026-10-06T12:00:00.000Z', allDay: false },
  ],
  'u1',
  NOW,
)
eq('a repeated UID yields one row, not a conflict on insert', dupes.length, 1)

console.log('\nmarkMoves')
const base = eventsToTodos(parsed, 'u1', NOW)
const unchanged = markMoves(base, new Map([[base[0].external_id, base[0].due]]))
check('an unchanged deadline is not flagged', unchanged[0].moved_from === undefined)
const moved = markMoves(base, new Map([[base[0].external_id, '2026-10-05T23:59:00.000Z']]))
eq('a changed deadline records where it moved FROM', moved[0].moved_from, '2026-10-05T23:59:00.000Z')
eq('and keeps the new date as the due', moved[0].due, '2026-10-12T23:59:00.000Z')
check(
  'an item we have never seen is an arrival, not a move',
  markMoves(base, new Map())[0].moved_from === undefined,
)
check(
  'the same instant written differently is not a move',
  markMoves(base, new Map([[base[0].external_id, '2026-10-12T19:59:00.000-04:00']]))[0].moved_from ===
    undefined,
)
check(
  'an unreadable stored date is ignored rather than reported as a move',
  markMoves(base, new Map([[base[0].external_id, 'whenever']]))[0].moved_from === undefined,
)

console.log('\nvalidateMoodleIcsUrl')
const GOOD =
  'https://moodle.concordia.ca/moodle/calendar/export_execute.php?userid=123&authtoken=abc123&preset_what=all&preset_time=recentupcoming'
check('the real shape is accepted', validateMoodleIcsUrl(GOOD).ok === true)
check('and whitespace around it is forgiven', validateMoodleIcsUrl(`  ${GOOD}  `).ok === true)
check('http is refused — the link carries a token', validateMoodleIcsUrl(GOOD.replace('https', 'http')).ok === false)
check(
  'another host is refused, so we cannot be aimed at an internal address',
  validateMoodleIcsUrl(GOOD.replace('moodle.concordia.ca', 'evil.example.com')).ok === false,
)
check(
  'a lookalike domain is refused',
  validateMoodleIcsUrl(GOOD.replace('moodle.concordia.ca', 'concordia.ca.evil.com')).ok === false,
)
check(
  'a Moodle page that is not the export endpoint is refused',
  validateMoodleIcsUrl('https://moodle.concordia.ca/moodle/calendar/view.php').ok === false,
)
check(
  'the export endpoint without a token is refused',
  validateMoodleIcsUrl('https://moodle.concordia.ca/moodle/calendar/export_execute.php?userid=1').ok === false,
)
check('gibberish is refused', validateMoodleIcsUrl('my calendar').ok === false)
check(
  'every refusal says what to do about it',
  [
    validateMoodleIcsUrl('nope'),
    validateMoodleIcsUrl('https://evil.com/x'),
    validateMoodleIcsUrl('https://moodle.concordia.ca/moodle/calendar/view.php'),
  ].every((r) => !r.ok && r.reason.length > 25),
)

/* ── Writing ──────────────────────────────────────────────────────────────
 *
 * A feed Google or Apple rejects fails SILENTLY — the student just never sees
 * an event and has nothing to look at. So these cover the parts that make a
 * strict parser refuse a whole file: line length measured in OCTETS, text
 * escaping, and CRLF.
 */
console.log('\nbuildIcs')
const WNOW = Date.UTC(2026, 8, 19, 15, 0, 0)
const ics = buildIcs({
  name: 'ConcordiaTracker',
  now: WNOW,
  events: [
    {
      uid: 'a-1@concordiatracker.com',
      start: '2026-10-12T23:59:00.000Z',
      durationMinutes: 30,
      summary: 'COMM 305 · Assignment 2, part one; final',
      description: 'quiz · 15%\nTracked in ConcordiaTracker',
      url: 'https://concordiatracker.com/app/courses/x',
    },
  ],
})

eq('stamps are basic-format UTC', icsStamp('2026-10-12T23:59:00.000Z'), '20261012T235900Z')
check(
  'it opens and closes a VCALENDAR',
  ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.trimEnd().endsWith('END:VCALENDAR'),
)
check('every line ends CRLF, per the spec', !/[^\r]\n/.test(ics))
check('the event carries its stable UID', ics.includes('UID:a-1@concordiatracker.com'))
check('DTSTART is the due instant', ics.includes('DTSTART:20261012T235900Z'))
check('DTEND is 30 minutes later', ics.includes('DTEND:20261013T002900Z'))
check('a semicolon in a title is escaped', ics.includes('part one\\; final'))
check('a comma in a title is escaped', ics.includes('Assignment 2\\, part one'))
check('a newline in the description becomes a literal \\n', ics.includes('15%\\nTracked'))
check('it declares a refresh hint', ics.includes('REFRESH-INTERVAL;VALUE=DURATION:PT4H'))

/**
 * Folding is measured in BYTES, not characters.
 *
 * Seventy accented characters is 140 octets on one line. A parser that
 * enforces the limit drops the file, and the student sees an empty calendar
 * with nothing anywhere explaining it.
 */
const wide = buildIcs({
  name: 'x',
  now: WNOW,
  events: [{ uid: 'w@concordiatracker.com', start: '2026-10-12T12:00:00.000Z', summary: 'é'.repeat(70) }],
})
const enc = new TextEncoder()
check(
  'no line exceeds 75 octets',
  wide.split('\r\n').every((l) => enc.encode(l).length <= 75),
  wide.split('\r\n').map((l) => enc.encode(l).length).join(','),
)
check('a folded continuation starts with one space', wide.includes('\r\n '))
check(
  'folding is reversible — the title survives intact',
  parseIcs(wide)[0]?.summary === 'é'.repeat(70),
  JSON.stringify(parseIcs(wide)[0]?.summary?.slice(0, 24)),
)

// The reader and the writer share this file precisely so this holds.
const round = parseIcs(ics)
eq('one event round-trips', round.length, 1)
eq('with its summary unescaped again', round[0].summary, 'COMM 305 · Assignment 2, part one; final')

check(
  'an unparseable date is dropped, never guessed at',
  !buildIcs({ name: 'x', now: WNOW, events: [{ uid: 'bad@x', start: 'not a date', summary: 'x' }] }).includes(
    'BEGIN:VEVENT',
  ),
)
check('an empty calendar is still a valid calendar', buildIcs({ name: 'x', now: WNOW, events: [] }).includes('BEGIN:VCALENDAR'))

console.log(failures === 0 ? '\nics: all checks passed' : `\nics: ${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
