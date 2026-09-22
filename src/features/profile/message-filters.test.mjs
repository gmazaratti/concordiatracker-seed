/**
 * node src/features/profile/message-filters.test.mjs
 *
 * The filters hide rows, so the failure that matters is one that hides a
 * conversation somebody is waiting on. Two cases carry most of that risk and
 * both are asserted here: a row with no conversation yet must not count as
 * "unanswered" (absent is not false), and stacking two filters must mean AND
 * — an OR would quietly widen every selection instead of narrowing it.
 */
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(here, '.message-filters.test.tmp.mjs')
execSync(
  `npx esbuild --bundle "${path.join(here, 'message-filters.ts')}" --format=esm "--alias:@=./src" --outfile="${out}"`,
  { stdio: 'pipe', cwd: path.join(here, '..', '..', '..') },
)
const { matchesFilters, isStoryReply, describeFilters, MESSAGE_FILTERS, STORY_REPLY_PREFIX } =
  await import(pathToFileURL(out).href)

let failures = 0
const check = (label, ok, detail) => {
  if (!ok) failures++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok || detail === undefined ? '' : `\n         ${detail}`}`)
}

const row = (over = {}) => ({ kind: 'user', unread: 0, verified: false, ...over })

console.log('\nmessage filters')

check('no filters keeps everything', matchesFilters(row(), []))
check('unread keeps an unread row', matchesFilters(row({ unread: 3 }), ['unread']))
check('unread drops a read row', !matchesFilters(row({ unread: 0 }), ['unread']))

// The one that would hide a real conversation if it were wrong.
check(
  'unanswered means THEY spoke last',
  matchesFilters(row({ lastFromMe: false }), ['unanswered']),
)
check('unanswered drops one you replied to', !matchesFilters(row({ lastFromMe: true }), ['unanswered']))
check(
  'never-messaged is not unanswered',
  !matchesFilters(row({ lastFromMe: undefined }), ['unanswered']),
  'absent must not read as false',
)

check('verified keeps a sealed account', matchesFilters(row({ verified: true }), ['verified']))
check('verified drops a plain account', !matchesFilters(row(), ['verified']))
check('orgs keeps a club', matchesFilters(row({ kind: 'org' }), ['orgs']))
check('orgs drops a person', !matchesFilters(row({ kind: 'user' }), ['orgs']))

// Story replies are detected by the prefix StoryViewer really sends.
check(
  'story reply detected by its real prefix',
  isStoryReply(`${STORY_REPLY_PREFIX} nice one`),
)
check('an ordinary line is not a story reply', !isStoryReply('Replying later'))
check('leading whitespace still matches', isStoryReply(`  ${STORY_REPLY_PREFIX} hi`))
check('a null body is not a story reply', !isStoryReply(null))
check(
  'story filter reads the last body',
  matchesFilters(row({ lastBody: `${STORY_REPLY_PREFIX} hey` }), ['story']),
)

// AND, not OR.
check(
  'two filters both have to hold',
  matchesFilters(row({ kind: 'org', unread: 2 }), ['orgs', 'unread']),
)
check(
  'two filters: failing one is enough to drop',
  !matchesFilters(row({ kind: 'org', unread: 0 }), ['orgs', 'unread']),
  'an OR here would widen every selection',
)
check(
  'a Set works as the active collection',
  matchesFilters(row({ unread: 1, verified: true }), new Set(['unread', 'verified'])),
)

check('five filters are offered', MESSAGE_FILTERS.length === 5, String(MESSAGE_FILTERS.length))
check(
  'every filter has a label and a hint',
  MESSAGE_FILTERS.every((f) => f.label && f.hint),
)
check('describe reads as a sentence', describeFilters(['unread', 'orgs']) === 'Unread and Organizations',
  describeFilters(['unread', 'orgs']))
check('describe with one', describeFilters(['unread']) === 'Unread')
check('describe with none is empty', describeFilters([]) === '')

console.log(failures === 0 ? '\nall good\n' : `\n${failures} failed\n`)
process.exit(failures === 0 ? 0 : 1)
