-- Rolled back. Run with:
-- (echo "begin;"; cat db/notes_collab.sql db/notes_collab.test.sql; echo "rollback;") > .t.sql && supabase db query --linked -f .t.sql
create temp table r (step text, ok boolean, detail text) on commit drop;
grant all on r to authenticated;

do $$
declare a uuid; b uuid; c uuid; bh text;
begin
  select user_id into a from public.user_profile where handle is not null limit 1;
  select user_id, handle into b, bh from public.user_profile where handle is not null and user_id <> a limit 1;
  select user_id into c from public.user_profile where handle is not null and user_id not in (a, b) limit 1;
  delete from public.profile_blocks where blocker_id in (a, b) and blocked_id in (a, b);
  perform set_config('ct.a', a::text, true); perform set_config('ct.b', b::text, true);
  perform set_config('ct.c', c::text, true); perform set_config('ct.bh', bh, true);
end $$;

set local role authenticated;
create or replace function pg_temp.as_user(k text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', current_setting('ct.' || k), 'role', 'authenticated')::text, true)
$$;

select pg_temp.as_user('a');
do $$
declare n uuid; ok boolean; cnt int;
begin
  insert into public.notes (title) values ('collab') returning id into n;
  perform set_config('ct.n', n::text, true);
  ok := public.note_seed_ydoc(n, 'AAAA');
  insert into r values ('first seed wins', ok, ok::text);
  ok := public.note_seed_ydoc(n, 'BBBB');
  insert into r values ('second seed is refused, not duplicated', not ok, ok::text);
  select count(*) into cnt from public.note_doc_updates where note_id = n;
  insert into r values ('exactly one seed row', cnt = 1, cnt::text);
  perform public.share_note_with('note', n, current_setting('ct.bh'), 'viewer');
  insert into public.note_comments (note_id, thread_id, body, quote) values (n, gen_random_uuid(), 'owner comment', 'some text');
end $$;

select pg_temp.as_user('b');
do $$
declare cnt int; maxid bigint;
begin
  select count(*) into cnt from public.note_doc_updates where note_id = current_setting('ct.n')::uuid;
  insert into r values ('viewer reads the log', cnt = 1, cnt::text);
  begin
    insert into public.note_doc_updates (note_id, data) values (current_setting('ct.n')::uuid, 'CCCC');
    insert into r values ('viewer cannot write updates', false, 'allowed');
  exception when others then insert into r values ('viewer cannot write updates', true, sqlerrm); end;
  begin
    perform public.note_seed_ydoc(current_setting('ct.n')::uuid, 'DDDD');
    insert into r values ('viewer cannot seed', false, 'allowed');
  exception when others then insert into r values ('viewer cannot seed', true, sqlerrm); end;
  insert into public.note_comments (note_id, thread_id, body) values (current_setting('ct.n')::uuid, gen_random_uuid(), 'viewer comment');
  insert into r values ('viewer can comment', true, null);
  update public.note_comments set body = 'rewritten' where body = 'owner comment';
  get diagnostics cnt = row_count;
  insert into r values ('viewer cannot edit another''s comment', cnt = 0, cnt::text);
end $$;

select pg_temp.as_user('c');
do $$
declare cnt int;
begin
  select count(*) into cnt from public.note_doc_updates where note_id = current_setting('ct.n')::uuid;
  insert into r values ('stranger cannot read the log', cnt = 0, cnt::text);
  select count(*) into cnt from public.note_comments where note_id = current_setting('ct.n')::uuid;
  insert into r values ('stranger cannot read comments', cnt = 0, cnt::text);
  insert into r values ('stranger has no channel role', public.ct_note_role_text(current_setting('ct.n')) is null, null);
  insert into r values ('a non-uuid topic does not raise', public.ct_note_role_text('not-a-uuid') is null, null);
end $$;

-- The live channels. Realtime authorises a join by trying exactly these rows
-- with NO event name, so the checks below leave event null on purpose: a
-- policy that tested the event refused everyone and dropped every broadcast.
create or replace function pg_temp.can_send(topic text) returns boolean language plpgsql as $$
begin
  insert into realtime.messages (topic, extension, payload, event, private)
  values (topic, 'broadcast', '{}'::jsonb, null, true);
  return true;
exception when others then
  return false;
end $$;

select pg_temp.as_user('b');
do $$
declare n text := current_setting('ct.n');
begin
  insert into r values ('viewer joins the room (cursors, comments)', pg_temp.can_send('note:' || n), null);
  insert into r values ('viewer cannot send document updates', not pg_temp.can_send('noted:' || n), null);
end $$;

select pg_temp.as_user('c');
do $$
declare n text := current_setting('ct.n');
begin
  insert into r values ('stranger cannot join the room', not pg_temp.can_send('note:' || n), null);
  insert into r values ('stranger cannot send document updates', not pg_temp.can_send('noted:' || n), null);
end $$;

select pg_temp.as_user('a');
do $$
declare n text := current_setting('ct.n'); cnt int;
begin
  insert into r values ('owner joins the room', pg_temp.can_send('note:' || n), null);
  insert into r values ('owner sends document updates', pg_temp.can_send('noted:' || n), null);
  insert into r values ('noted: cannot be reached through the note: rule', not pg_temp.can_send('noted:not-a-uuid'), null);
end $$;

select pg_temp.as_user('b');
do $$
declare cnt int;
begin
  select count(*) into cnt from realtime.messages where topic = 'noted:' || current_setting('ct.n');
  insert into r values ('viewer receives document updates', cnt >= 1, cnt::text);
end $$;

select pg_temp.as_user('a');
do $$
declare maxid bigint; cnt int;
begin
  insert into public.note_doc_updates (note_id, data) values (current_setting('ct.n')::uuid, 'EEEE');
  select max(id) into maxid from public.note_doc_updates where note_id = current_setting('ct.n')::uuid;
  perform public.note_compact(current_setting('ct.n')::uuid, 'SNAP', maxid);
  select count(*) into cnt from public.note_doc_updates where note_id = current_setting('ct.n')::uuid;
  insert into r values ('compaction folds the log', cnt = 0, cnt::text);
  insert into r values ('snapshot stored', (select ydoc from public.notes where id = current_setting('ct.n')::uuid) = 'SNAP', null);
  perform public.note_compact(current_setting('ct.n')::uuid, 'OLD', maxid - 1);
  insert into r values ('an older compaction cannot overwrite a newer one', (select ydoc from public.notes where id = current_setting('ct.n')::uuid) = 'SNAP', null);
end $$;

select step, ok, detail from r;
