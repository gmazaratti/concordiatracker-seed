/**
 * Feed ordering. Pure, so the rule can be checked without a scroll position:
 * unseen first, newest first within each half, and nothing ever dropped.
 */
import { orderFeed } from './seen-feed.ts'

let failed = 0
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok    ${name}`)
  else {
    failed++
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const items = [
  { id: 'a', at: '2026-09-20T10:00:00Z' },
  { id: 'b', at: '2026-09-22T10:00:00Z' },
  { id: 'c', at: '2026-09-21T10:00:00Z' },
  { id: 'd', at: '2026-09-19T10:00:00Z' },
]
const ids = (list) => list.map((i) => i.id).join('')

console.log('\nNothing seen')
{
  const o = orderFeed(items, new Set())
  check('everything is unseen', o.unseen.length === 4 && o.seen.length === 0)
  check('newest first', ids(o.unseen) === 'bcad', ids(o.unseen))
}

console.log('\nSome seen')
{
  const o = orderFeed(items, new Set(['b', 'd']))
  check('unseen keeps its own order', ids(o.unseen) === 'ca', ids(o.unseen))
  check('seen keeps its own order', ids(o.seen) === 'bd', ids(o.seen))
  check(
    'NOTHING IS DROPPED — the whole point',
    o.unseen.length + o.seen.length === items.length,
  )
}

console.log('\nEverything seen')
{
  const o = orderFeed(items, new Set(['a', 'b', 'c', 'd']))
  check('nothing is unseen', o.unseen.length === 0)
  check('and the feed is still the whole feed', ids(o.seen) === 'bcad', ids(o.seen))
}

console.log('\nAwkward input')
{
  check('an empty feed is two empty lists', orderFeed([], new Set()).unseen.length === 0)
  const o = orderFeed(items, new Set(['zzz']))
  check('an id for something no longer here changes nothing', o.unseen.length === 4)
  const same = orderFeed(
    [
      { id: 'x', at: '2026-09-20T10:00:00Z' },
      { id: 'y', at: '2026-09-20T10:00:00Z' },
    ],
    new Set(),
  )
  check('two at the same instant both survive', same.unseen.length === 2)
}

console.log(failed === 0 ? '\nseen-feed: all checks passed' : `\nseen-feed: ${failed} FAILED`)
process.exit(failed === 0 ? 0 : 1)
