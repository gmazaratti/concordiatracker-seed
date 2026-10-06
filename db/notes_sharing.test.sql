-- Rolled back. Run with:
-- (echo begin; cat db/notes_sharing.sql db/notes_sharing_rpc.sql db/notes_sharing.test.sql; echo rollback;) > .t.sql && npx supabase db query --linked -f .t.sql
create temp table r (step text, ok boolean, detail text) on commit drop;
grant all on r to authenticated;

-- A owns a course; B and C are other people with handles.
do $$
declare a uuid; b uuid; c uuid; ca text; bh text;
begin
  select co.user_id, co.id into a, ca from public.courses co
    join public.user_profile p on p.user_id = co.user_id and p.handle is not null
   where coalesce(co.archived, false) = false limit 1;
  select user_id, handle into b, bh from public.user_profile where handle is not null and user_id <> a limit 1;
  select user_id into c from public.user_profile where handle is not null and user_id not in (a, b) limit 1;
  delete from public.profile_blocks where (blocker_id in (a, b) and blocked_id in (a, b));
  perform set_config('ct.a', a::text, true); perform set_config('ct.b', b::text, true);
  perform set_config('ct.c', c::text, true); perform set_config('ct.ca', ca, true); perform set_config('ct.bh', bh, true);
end $$;

set local role authenticated;
create or replace function pg_temp.as_user(k text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', current_setting('ct.' || k), 'role', 'authenticated')::text, true)
$$;

select pg_temp.as_user('a');
do $$
declare made int; cf uuid; f uuid; n uuid; tok text; cnt int;
begin
  made := public.ensure_class_folders();
  select id into cf from public.note_folders where course_id = current_setting('ct.ca') and user_id = current_setting('ct.a')::uuid;
  insert into r values ('class folder exists for the course', cf is not null, made::text);
  insert into public.note_folders (name) values ('Midterm prep') returning id into f;
  update public.note_folders set parent_id = f where id = cf;
  insert into r values ('class folder moves into a folder', true, null);
  begin
    update public.note_folders set parent_id = cf where id = f;
    insert into r values ('cycle refused', false, 'allowed');
  exception when others then insert into r values ('cycle refused', true, sqlerrm); end;
  insert into public.notes (title, course_id, folder_id, body_text) values ('Week 5', current_setting('ct.ca'), cf, 'shared secret') returning id into n;
  update public.notes set content = '{"type":"doc","content":[{"type":"paragraph"}]}' where id = n;
  update public.notes set content = '{"type":"doc","content":[{"type":"paragraph"},{"type":"paragraph"}]}' where id = n;
  perform set_config('ct.n', n::text, true); perform set_config('ct.f', f::text, true);
  perform public.share_note_with('folder', f, current_setting('ct.bh'), 'viewer');
  insert into r values ('owner shares the outer folder', true, null);
  begin
    perform public.share_note_with('folder', f, (select handle from public.user_profile where user_id = current_setting('ct.a')::uuid), 'viewer');
    insert into r values ('sharing with yourself refused', false, 'allowed');
  exception when others then insert into r values ('sharing with yourself refused', true, sqlerrm); end;
  tok := public.share_note_link('note', n, 'viewer');
  perform set_config('ct.tok', tok, true);
  insert into r values ('link created', length(tok) = 40, length(tok)::text);
end $$;

select pg_temp.as_user('b');
do $$
declare cnt int;
begin
  select count(*) into cnt from public.notes where id = current_setting('ct.n')::uuid;
  insert into r values ('viewer of the outer folder reads the nested note', cnt = 1, cnt::text);
  select count(*) into cnt from public.note_versions where note_id = current_setting('ct.n')::uuid;
  insert into r values ('viewer reads its history', cnt >= 1, cnt::text);
  update public.notes set body_text = 'vandalised' where id = current_setting('ct.n')::uuid;
  get diagnostics cnt = row_count;
  insert into r values ('viewer cannot edit', cnt = 0, cnt::text);
  begin
    perform public.share_note_with('folder', current_setting('ct.f')::uuid, 'someone', 'viewer');
    insert into r values ('non-owner cannot share', false, 'allowed');
  exception when others then insert into r values ('non-owner cannot share', true, sqlerrm); end;
  select count(*) into cnt from public.notes_shared_with_me();
  insert into r values ('it appears under shared with me', cnt >= 1, cnt::text);
end $$;

select pg_temp.as_user('c');
do $$
declare cnt int;
begin
  select count(*) into cnt from public.notes where id = current_setting('ct.n')::uuid;
  insert into r values ('a stranger cannot read it', cnt = 0, cnt::text);
  select count(*) into cnt from public.note_people(current_setting('ct.n')::uuid);
  insert into r values ('a stranger cannot list its people', cnt = 0, cnt::text);
  perform public.claim_note_link(current_setting('ct.tok'));
  select count(*) into cnt from public.notes where id = current_setting('ct.n')::uuid;
  insert into r values ('opening the link grants access', cnt = 1, cnt::text);
  insert into r values ('link role is viewer', public.ct_note_role(current_setting('ct.n')::uuid) = 'viewer', public.ct_note_role(current_setting('ct.n')::uuid));
end $$;

select pg_temp.as_user('a');
do $$
declare sid uuid; cnt int;
begin
  select share_id into sid from public.note_share_list('folder', current_setting('ct.f')::uuid) where user_id = current_setting('ct.b')::uuid;
  perform public.share_note_set_role(sid, 'editor');
  perform set_config('ct.sid', sid::text, true);
  select count(*) into cnt from public.note_people(current_setting('ct.n')::uuid);
  insert into r values ('people: owner, folder editor, link viewer', cnt = 3, cnt::text);
end $$;

select pg_temp.as_user('b');
do $$
declare cnt int;
begin
  perform public.note_touch(current_setting('ct.n')::uuid, true);
  update public.notes set body_text = 'edited by b' where id = current_setting('ct.n')::uuid;
  get diagnostics cnt = row_count;
  insert into r values ('editor can edit the text', cnt = 1, cnt::text);
  begin
    update public.notes set folder_id = null where id = current_setting('ct.n')::uuid;
    insert into r values ('editor cannot refile it', false, 'allowed');
  exception when others then insert into r values ('editor cannot refile it', true, sqlerrm); end;
end $$;

select pg_temp.as_user('a');
do $$
declare cnt int; ed timestamptz;
begin
  select last_edited_at into ed from public.note_people(current_setting('ct.n')::uuid) where user_id = current_setting('ct.b')::uuid;
  insert into r values ('last edited is recorded per person', ed is not null, ed::text);
  perform public.share_note_remove(current_setting('ct.sid')::uuid);
  perform public.share_note_link('note', current_setting('ct.n')::uuid, null);
end $$;

select pg_temp.as_user('b');
do $$
declare cnt int;
begin
  select count(*) into cnt from public.notes where id = current_setting('ct.n')::uuid;
  insert into r values ('removed person loses access', cnt = 0, cnt::text);
end $$;

select step, ok, detail from r;
