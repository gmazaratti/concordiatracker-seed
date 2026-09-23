-- ============================================================================
-- Replies, reactions, receipts, and the edit guard. Real database, one
-- transaction, rolled back. The API-shaped writes run as `authenticated`.
-- ============================================================================
begin;

create temporary table t_out (n int generated always as identity, label text, got text, want text);
grant all on t_out to authenticated;
grant usage on sequence t_out_n_seq to authenticated;
create or replace function pg_temp.want(p_label text, p_got text, p_want text) returns void
language sql as $$ insert into t_out (label, got, want) values (p_label, p_got, p_want); $$;
create or replace function pg_temp.be(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.refused(p_sql text) returns text
language plpgsql as $$
begin execute p_sql; return 'ALLOWED';
exception when others then return 'refused'; end $$;

do $$
declare a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
        m1 uuid := gen_random_uuid(); m2 uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, instance_id, aud, role) values
    (a, 'zz-mx-a@t.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    (b, 'zz-mx-b@t.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    (c, 'zz-mx-c@t.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
  -- Written as the backend so the insert policy's follow rules are not the
  -- thing under test here.
  insert into public.messages (id, sender, recipient, body) values (m1, a, b, 'original words');
  insert into public.messages (id, sender, recipient, body) values (m2, c, b, 'a different chat');
  perform set_config('t.a', a::text, true);
  perform set_config('t.b', b::text, true);
  perform set_config('t.c', c::text, true);
  perform set_config('t.m1', m1::text, true);
  perform set_config('t.m2', m2::text, true);
end $$;

-- The hole: the recipient rewriting what they were sent.
select pg_temp.be(current_setting('t.b')::uuid);
set local role authenticated;
select pg_temp.want('the recipient cannot rewrite a message',
  pg_temp.refused(format('update public.messages set body = %L where id = %L', 'forged', current_setting('t.m1'))),
  'refused');
select pg_temp.want('the recipient can still mark it read',
  pg_temp.refused(format('update public.messages set read_at = now() where id = %L', current_setting('t.m1'))),
  'ALLOWED');
reset role;
select pg_temp.want('and the words are the sender''s',
  (select body from public.messages where id = current_setting('t.m1')::uuid), 'original words');

-- Reactions.
select pg_temp.be(current_setting('t.b')::uuid);
select pg_temp.want('the recipient can react',
  coalesce(public.react_message(current_setting('t.m1')::uuid, '❤️'), 'null'), '❤️');
select pg_temp.want('a reaction outside the set is refused',
  pg_temp.refused(format('select public.react_message(%L, %L)', current_setting('t.m1'), 'lol')), 'refused');
select pg_temp.want('the same one again takes it off',
  coalesce(public.react_message(current_setting('t.m1')::uuid, '❤️'), 'null'), 'null');
select pg_temp.be(current_setting('t.c')::uuid);
select pg_temp.want('somebody outside the chat cannot react',
  pg_temp.refused(format('select public.react_message(%L, %L)', current_setting('t.m1'), '🔥')), 'refused');

-- Replies cannot reach across conversations.
select pg_temp.be(current_setting('t.a')::uuid);
select pg_temp.want('a reply cannot quote another conversation',
  pg_temp.refused(format(
    'insert into public.messages (sender, recipient, body, reply_to) values (%L, %L, %L, %L)',
    current_setting('t.a'), current_setting('t.b'), 'quoting', current_setting('t.m2'))), 'refused');
select pg_temp.want('a reply inside the conversation is fine',
  pg_temp.refused(format(
    'insert into public.messages (sender, recipient, body, reply_to) values (%L, %L, %L, %L)',
    current_setting('t.a'), current_setting('t.b'), 'quoting', current_setting('t.m1'))), 'ALLOWED');

-- Receipts: on by default, reciprocal, and one switch turns them off for both.
select pg_temp.be(current_setting('t.a')::uuid);
select pg_temp.want('receipts are on by default',
  (select shared::text from public.dm_receipts_state(current_setting('t.b')::uuid)), 'true');
select pg_temp.want('the sender sees the read time while both are on',
  (select count(*)::text from public.thread_receipts(current_setting('t.b')::uuid)), '1');
select pg_temp.be(current_setting('t.b')::uuid);
select public.set_dm_receipts(current_setting('t.a')::uuid, false);
select pg_temp.be(current_setting('t.a')::uuid);
select pg_temp.want('when one side turns them off, neither sees them',
  (select shared::text from public.dm_receipts_state(current_setting('t.b')::uuid)), 'false');
select pg_temp.want('and the read time is no longer handed out',
  (select count(*)::text from public.thread_receipts(current_setting('t.b')::uuid)), '0');
select pg_temp.want('your own switch is still on',
  (select mine::text from public.dm_receipts_state(current_setting('t.b')::uuid)), 'true');

select case when got = want then 'ok  ' else 'FAIL' end as r, label, got, want from t_out order by n;
rollback;
