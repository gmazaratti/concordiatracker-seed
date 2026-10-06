-- Rolled back. Run with: (echo begin; cat db/notes.sql db/notes.test.sql; echo rollback;) > .t.sql && npx supabase db query --linked -f .t.sql

create temp table r (step text, ok boolean, detail text) on commit drop;
grant all on r to authenticated;

do $$
declare
  a uuid; b uuid; ca text; cb text; n uuid; cnt int; s text;
begin
  select user_id, id into a, ca from public.courses where user_id is not null limit 1;
  select user_id, id into b, cb from public.courses where user_id <> a limit 1;
  perform set_config('ct.a', a::text, true); perform set_config('ct.b', b::text, true);
  perform set_config('ct.ca', ca, true); perform set_config('ct.cb', cb, true);
end $$;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('ct.a'), 'role', 'authenticated')::text, true);

do $$
declare n uuid; cnt int; ok boolean;
begin
  insert into public.notes (title, course_id) values ('Week 5 test', current_setting('ct.ca')) returning id into n;
  insert into r values ('own course link allowed', true, null);
  perform set_config('ct.n', n::text, true);

  begin
    insert into public.notes (title, course_id) values ('sneaky', current_setting('ct.cb'));
    insert into r values ('someone else''s course refused', false, 'insert succeeded');
  exception when others then insert into r values ('someone else''s course refused', true, sqlerrm); end;

  update public.notes set content = '{"type":"doc","content":[{"type":"paragraph"}]}', body_text = 'debt service coverage ratio DSCR' where id = n;
  select count(*) into cnt from public.note_versions where note_id = n;
  insert into r values ('no version of an empty note', cnt = 0, cnt::text);
  update public.notes set content = '{"type":"doc","content":[{"type":"paragraph"},{"type":"paragraph"}]}' where id = n;
  select count(*) into cnt from public.note_versions where note_id = n;
  insert into r values ('edit keeps the previous state', cnt = 1, cnt::text);
  update public.notes set title = 'changed again' where id = n;
  select count(*) into cnt from public.note_versions where note_id = n;
  insert into r values ('one version per ten minutes', cnt = 1, cnt::text);

  begin
    insert into public.note_versions (note_id, user_id, content) values (n, current_setting('ct.a')::uuid, '{}');
    insert into r values ('client cannot forge a version', false, 'insert succeeded');
  exception when others then insert into r values ('client cannot forge a version', true, sqlerrm); end;

  select count(*) into cnt from public.search_notes('dsc');
  insert into r values ('prefix search finds it', cnt = 1, cnt::text);
  select count(*) into cnt from public.search_notes('coverage rat');
  insert into r values ('multi-word search', cnt = 1, cnt::text);
  select count(*) into cnt from public.search_notes('');
  insert into r values ('empty search returns nothing', cnt = 0, cnt::text);
end $$;

select set_config('request.jwt.claims', json_build_object('sub', current_setting('ct.b'), 'role', 'authenticated')::text, true);
do $$
declare cnt int;
begin
  select count(*) into cnt from public.notes where id = current_setting('ct.n')::uuid;
  insert into r values ('another account cannot read it', cnt = 0, cnt::text);
  select count(*) into cnt from public.search_notes('dscr');
  insert into r values ('another account cannot search it', cnt = 0, cnt::text);
  update public.notes set title = 'hijack' where id = current_setting('ct.n')::uuid;
  get diagnostics cnt = row_count;
  insert into r values ('another account cannot edit it', cnt = 0, cnt::text);
  select count(*) into cnt from public.note_versions where note_id = current_setting('ct.n')::uuid;
  insert into r values ('another account cannot read history', cnt = 0, cnt::text);
end $$;

select step, ok, detail from r;
