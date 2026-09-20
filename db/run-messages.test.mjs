/**
 * node db/run-messages.test.mjs
 *
 * Executes db/admin_messages.sql in a real Postgres and exercises the whole
 * loop: send, receive, acknowledge, reply, read the reply back.
 *
 * The interesting assertions are the refusals. This table can interrupt any
 * student's screen, so what matters is that a non-admin cannot send, that an
 * id alone is not enough to acknowledge somebody else's message, and that an
 * acknowledged message never comes back.
 */
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'

const ME = '11111111-1111-1111-1111-111111111111' // the admin
const THEM = '22222222-2222-2222-2222-222222222222' // a student
const OTHER = '33333333-3333-3333-3333-333333333333'

const db = new PGlite()
let who = ME
let admin = true

await db.exec(`
  create schema if not exists auth;
  create table public._ctx (uid uuid, is_admin boolean);
  insert into public._ctx values ('${ME}', true);
  create or replace function auth.uid() returns uuid language sql stable as $$
    select uid from public._ctx limit 1 $$;
  create or replace function public.is_admin() returns boolean language sql stable as $$
    select is_admin from public._ctx limit 1 $$;
  create table public.user_profile (user_id uuid primary key, name text, email text, is_internal boolean default false);
  insert into public.user_profile values
    ('${ME}', 'Alex', 'alex@example.com', true),
    ('${THEM}', 'Mani', 'mani@example.com', false),
    ('${OTHER}', 'Flo', 'flo@example.com', false);
  create table public.site_events (id bigserial, user_id uuid, session_id text, path text,
    device text, created_at timestamptz default now());
  create table public.admin_audit_log (id bigserial, actor_id uuid, actor_email text, action text,
    target_id uuid, target_email text, old_value jsonb, new_value jsonb, reason text,
    created_at timestamptz default now());
  create or replace function public.log_admin_action(p_action text, p_target uuid, p_reason text,
    p_old jsonb default null, p_new jsonb default null)
  returns bigint language sql as $$
    insert into public.admin_audit_log (action, target_id, reason, old_value, new_value)
    values (p_action, p_target, p_reason, p_old, p_new) returning id $$;
`)

const as = async (uid, isAdmin) => {
  who = uid
  admin = isAdmin
  await db.query('update public._ctx set uid = $1, is_admin = $2', [uid, isAdmin])
}
void who
void admin

const sql = fs
  .readFileSync('db/admin_messages.sql', 'utf8')
  .split('\n')
  .filter((l) => !/^\s*(grant|revoke)\b/i.test(l))
  .join('\n')
  .replace(/references auth\.users \(id\) on delete cascade/g, '')
await db.exec(sql)

let bad = 0
function need(label, ok, detail) {
  if (!ok) bad++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok || detail === undefined ? '' : `\n         ${detail}`}`)
}
const q = async (s, p) => (await db.query(s, p)).rows

console.log('admin_messages.sql')

// ── Send ──────────────────────────────────────────────────────────────────
const id = (await q('select public.send_admin_message($1, $2) id', [THEM, '  Fixed the sync, try it  ']))[0].id
need('an admin can send', typeof id === 'number' || typeof id === 'bigint')
need(
  'the body is trimmed, not stored with the whitespace',
  (await q('select body from public.admin_messages where id = $1', [id]))[0].body === 'Fixed the sync, try it',
)
need(
  'the send is audited WITH the message text, so the channel leaves a trail',
  (await q("select reason from public.admin_audit_log where action = 'message.send'"))[0].reason ===
    'Fixed the sync, try it',
)
let refused = false
try { await q('select public.send_admin_message($1, $2)', [THEM, '   ']) } catch { refused = true }
need('an empty message is refused', refused)

await as(THEM, false)
refused = false
try { await q('select public.send_admin_message($1, $2)', [OTHER, 'hi']) } catch { refused = true }
need('a student cannot send one', refused)

// ── Receive ───────────────────────────────────────────────────────────────
const mine = await q('select * from public.my_admin_messages()')
need('the recipient gets it', mine.length === 1 && mine[0].body === 'Fixed the sync, try it')
need(
  'and reading it stamps seen_at, so ignored is distinguishable from never opened',
  (await q('select seen_at from public.admin_messages where id = $1', [id]))[0].seen_at !== null,
)

await as(OTHER, false)
need('somebody else sees nothing', (await q('select * from public.my_admin_messages()')).length === 0)
refused = false
try { await q('select public.ack_admin_message($1, $2)', [id, 'not mine']) } catch { refused = true }
need('and an id alone does not let them acknowledge it', refused)

// ── Acknowledge + reply ───────────────────────────────────────────────────
await as(THEM, false)
await q('select public.ack_admin_message($1, $2)', [id, 'Works now, thanks'])
need('acknowledging clears it for good', (await q('select * from public.my_admin_messages()')).length === 0)
const row = (await q('select acknowledged_at, reply, replied_at from public.admin_messages where id = $1', [id]))[0]
need('the reply is stored', row.reply === 'Works now, thanks')
need('with a timestamp', row.replied_at !== null && row.acknowledged_at !== null)

// Acknowledging with no reply must not wipe one already given.
await as(ME, true)
const id2 = (await q('select public.send_admin_message($1, $2) id', [THEM, 'Second']))[0].id
await as(THEM, false)
await q('select public.ack_admin_message($1)', [id2])
need(
  'acknowledging without a reply leaves reply null rather than empty string',
  (await q('select reply from public.admin_messages where id = $1', [id2]))[0].reply === null,
)

// ── The admin reads the answer ────────────────────────────────────────────
await as(ME, true)
const replies = await q('select * from public.admin_message_replies(10)')
need('the admin sees the reply', replies.length === 1 && replies[0].reply === 'Works now, thanks')
need('attributed to the right person', replies[0].who === 'Mani')
need('the thread for one user is readable', (await q('select * from public.admin_messages_for($1)', [THEM])).length === 2)

// ── Online now ────────────────────────────────────────────────────────────
await db.exec(`
  insert into public.site_events (user_id, session_id, path, device, created_at) values
    ('${THEM}', 's1', '/app/today',    'desktop', now() - interval '4 minutes'),
    ('${THEM}', 's1', '/app/calendar', 'desktop', now() - interval '30 seconds'),
    ('${OTHER}', 's2', '/app/courses', 'mobile',  now() - interval '2 hours');
`)
const online = await q('select * from public.admin_online_now(5)')
need('only people active in the window are online', online.length === 1 && online[0].name === 'Mani')
need('on the page they are actually on', online[0].path === '/app/calendar')
need(
  'with the length of the whole session, not just the window',
  online[0].seconds >= 200,
  `got ${online[0].seconds}s`,
)

await db.close()
console.log(bad === 0 ? '\nadmin_messages.sql: runs clean' : `\nadmin_messages.sql: ${bad} FAILED`)
process.exit(bad === 0 ? 0 : 1)
