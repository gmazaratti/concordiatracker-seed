// node src/lib/mentions.test.mjs
import { splitMentions, mentionAt, insertMention, matchChannels } from './mentions.ts'
let fail = 0
const check = (n, ok) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}`); if (!ok) fail++ }
const s = splitMentions('hey @alex check @Planner and email a@b.com @feed')
check('person linked', s.some((x) => x.mention === '@alex' && x.href === '/@alex'))
check('channel linked', s.some((x) => x.mention === '@Planner' && x.href === '/app/planner'))
check('channel case-insensitive', s.some((x) => x.mention === '@Feed' && x.href === '/app/community'))
check('email not a mention', !s.some((x) => x.mention === '@b'))
check('text kept', s.map((x) => x.text ?? x.mention).join('') === 'hey @alex check @Planner and email a@b.com @Feed')
check('capitalised non-channel is not a person', !splitMentions('@Bob').some((x) => x.mention))
check('mentionAt finds the word', JSON.stringify(mentionAt('hi @pla', 7)) === JSON.stringify({ start: 3, query: 'pla' }))
check('mentionAt ignores emails', mentionAt('a@b', 3) === null)
const r = insertMention('hi @pla', 7, '@Planner')
check('insert replaces the word', r.text === 'hi @Planner ' && r.caret === 12)
check('channel match by prefix', matchChannels('ca').map((c) => c.name).join() === 'Calendar')
if (fail) process.exit(1)
