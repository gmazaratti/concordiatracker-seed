// Node-run checks for lib/offline-rules.ts (`npm run test:offline`).
import {
  classify,
  idsFromFilter,
  injectInsertDefaults,
  readKey,
  replayOutcome,
  syntheticReply,
  uidFromAuth,
} from './offline-rules.ts'

let failed = 0
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok   ${name}`)
  else {
    failed++
    console.log(`  FAIL ${name} ${detail}`)
  }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// ── classify ───────────────────────────────────────────────────────────────
check('table select is a read', eq(classify('GET', '/rest/v1/courses'), { type: 'read' }))
check('count (HEAD) is a read', eq(classify('HEAD', '/rest/v1/assignments'), { type: 'read' }))
check('who-am-I is a read', eq(classify('GET', '/auth/v1/user'), { type: 'read' }))
check('token refresh passes', eq(classify('POST', '/auth/v1/token'), { type: 'pass' }))
check('storage passes', eq(classify('POST', '/storage/v1/object/org-media/x.jpg'), { type: 'pass' }))
check('read-only RPC is a read', eq(classify('POST', '/rest/v1/rpc/my_threads'), { type: 'read' }))
check('feed RPC is a read', eq(classify('POST', '/rest/v1/rpc/post_feed'), { type: 'read' }))
check('insert is a queueable write', eq(classify('POST', '/rest/v1/messages'), { type: 'write', table: 'messages', op: 'insert' }))
check('update is a queueable write', eq(classify('PATCH', '/rest/v1/assignments'), { type: 'write', table: 'assignments', op: 'update' }))
check('delete is a queueable write', eq(classify('DELETE', '/rest/v1/todos'), { type: 'write', table: 'todos', op: 'delete' }))
check('mark-read RPC queues', eq(classify('POST', '/rest/v1/rpc/mark_thread_read'), { type: 'write', table: 'mark_thread_read', op: 'rpc' }))
// The dangerous ones: a toggle replayed after it landed would undo itself, and
// a write answered from a cache would be a save that never happened.
check('a toggle RPC is never queued', eq(classify('POST', '/rest/v1/rpc/toggle_save'), { type: 'pass' }))
check('a toggle RPC is never cached', eq(classify('POST', '/rest/v1/rpc/toggle_repost'), { type: 'pass' }))
check('follow RPC is never cached', eq(classify('POST', '/rest/v1/rpc/follow_user'), { type: 'pass' }))
check('unknown RPC passes', eq(classify('POST', '/rest/v1/rpc/send_message_request'), { type: 'pass' }))

// ── uidFromAuth ────────────────────────────────────────────────────────────
const tok = (payload) =>
  'Bearer x.' + Buffer.from(JSON.stringify(payload)).toString('base64url') + '.y'
check('reads sub from the bearer token', uidFromAuth(tok({ sub: 'abc-123' })) === 'abc-123')
check('anon key (no sub) is nobody', uidFromAuth(tok({ role: 'anon' })) === null)
check('no header is nobody', uidFromAuth(null) === null)
check('garbage is nobody', uidFromAuth('Bearer not-a-jwt') === null)

// ── readKey ────────────────────────────────────────────────────────────────
check('keys differ by account', readKey('a', 'GET', 'u', null) !== readKey('b', 'GET', 'u', null))
check('keys differ by body (RPC args)', readKey('a', 'POST', 'u', '{"p":1}') !== readKey('a', 'POST', 'u', '{"p":2}'))

// ── injectInsertDefaults ───────────────────────────────────────────────────
const made = injectInsertDefaults(
  'messages',
  'https://x.supabase.co/rest/v1/messages',
  JSON.stringify({ sender: 's', recipient: 'r', body: 'hi' }),
  () => 'fixed-id',
  '2026-09-28T12:00:00.000Z',
)
check('a message gets its own id', made.rows[0].id === 'fixed-id')
check('a message gets its timestamp', made.rows[0].created_at === '2026-09-28T12:00:00.000Z')
check('the body sent later carries the same id', JSON.parse(made.body).id === 'fixed-id')
const kept = injectInsertDefaults('messages', 'https://x/rest/v1/messages', JSON.stringify({ id: 'mine', body: 'x' }), () => 'new', 'now')
check('an id the caller chose is kept', kept.rows[0].id === 'mine')
const arr = injectInsertDefaults(
  'assignments',
  'https://x/rest/v1/assignments?columns=%22title%22%2C%22weight%22',
  JSON.stringify([{ title: 'A', weight: 5 }]),
  () => 'id-1',
  'now',
)
check('an assignment gets an id, no timestamp', arr.rows[0].id === 'id-1' && arr.rows[0].created_at === undefined)
check('the columns= list names the injected id', new URL(arr.url).searchParams.get('columns').includes('"id"'))
check('an array body stays an array', Array.isArray(JSON.parse(arr.body)))
const other = injectInsertDefaults('post_likes', 'https://x/rest/v1/post_likes', JSON.stringify({ post_id: 'p' }), () => 'z', 'now')
check('other tables are left alone', other.rows[0].id === undefined)

// ── syntheticReply ─────────────────────────────────────────────────────────
check('minimal insert → 201, no body', eq(syntheticReply('insert', 'return=minimal', null, []), { status: 201, body: null }))
check('minimal update → 204', syntheticReply('update', null, null, []).status === 204)
check(
  'insert().select() echoes the rows',
  eq(syntheticReply('insert', 'return=representation', 'application/json', [{ id: 1 }]), { status: 201, body: '[{"id":1}]' }),
)
check(
  '.single() gets one object',
  syntheticReply('insert', 'return=representation', 'application/vnd.pgrst.object+json', [{ id: 1 }]).body === '{"id":1}',
)
check('a delete echoes nothing', syntheticReply('delete', 'return=representation', null, [{ id: 1 }]).body === '[]')
check('a queued RPC answers null', syntheticReply('rpc', null, null, []).body === 'null')

// ── idsFromFilter ──────────────────────────────────────────────────────────
check('id=eq.X', eq(idsFromFilter('https://x/rest/v1/assignments?id=eq.abc'), ['abc']))
check('id=in.(a,b)', eq(idsFromFilter('https://x/rest/v1/todos?id=in.(a,b)'), ['a', 'b']))
check('other filters → none', eq(idsFromFilter('https://x/rest/v1/messages?recipient=eq.me'), []))

// ── replayOutcome ──────────────────────────────────────────────────────────
check('2xx is done', replayOutcome(204, 'update') === 'done')
check('a duplicate insert already landed', replayOutcome(409, 'insert') === 'done')
check('a conflicting update is refused', replayOutcome(409, 'update') === 'refused')
check('401 refreshes the token', replayOutcome(401, 'insert') === 'refresh-token')
check('5xx retries later', replayOutcome(503, 'update') === 'retry-later')
check('rate limit retries later', replayOutcome(429, 'rpc') === 'retry-later')
check('RLS refusal is reported', replayOutcome(403, 'insert') === 'refused')
check('bad request is reported', replayOutcome(400, 'update') === 'refused')

if (failed) {
  console.log(`\n${failed} failed`)
  process.exit(1)
}
console.log('\noffline-rules: all passed')
