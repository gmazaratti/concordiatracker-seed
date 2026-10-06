-- Rolled back. Run with:
-- (echo "begin;"; cat db/notes_files.test.sql; echo "rollback;") > .t.sql && supabase db query --linked -f .t.sql
create temp table r (step text, ok boolean, detail text) on commit drop;
grant all on r to authenticated;

do $$
declare a uuid; b uuid; c uuid; bh text; f uuid; g uuid;
begin
  select user_id into a from public.user_profile where handle is not null order by created_at limit 1;
  select user_id, handle into b, bh from public.user_profile where handle is not null and user_id <> a order by created_at limit 1;
  select user_id into c from public.user_profile where handle is not null and user_id not in (a, b) order by created_at limit 1;
  insert into public.note_folders (user_id, name) values (a, 'files test shared') returning id into f;
  insert into public.note_folders (user_id, name) values (a, 'files test private') returning id into g;
  insert into storage.objects (bucket_id, name) values
    ('folder-files', a::text || '/11111111-1111-4111-8111-111111111111.pdf'),
    ('folder-files', a::text || '/22222222-2222-4222-8222-222222222222.pdf'),
    ('folder-files', b::text || '/33333333-3333-4333-8333-333333333333.pdf');
  perform set_config('ct.a', a::text, true); perform set_config('ct.b', b::text, true);
  perform set_config('ct.c', c::text, true); perform set_config('ct.bh', bh, true);
  perform set_config('ct.f', f::text, true); perform set_config('ct.g', g::text, true);
end $$;

set local role authenticated;
create or replace function pg_temp.as_user(k text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', current_setting('ct.' || k), 'role', 'authenticated')::text, true)
$$;

select pg_temp.as_user('a');
do $$
declare a text := current_setting('ct.a');
begin
  insert into public.folder_files (folder_id, name, path, mime, size_bytes)
  values (current_setting('ct.f')::uuid, 'shared.pdf', a || '/11111111-1111-4111-8111-111111111111.pdf', 'application/pdf', 10);
  insert into public.folder_files (folder_id, name, path, mime, size_bytes)
  values (current_setting('ct.g')::uuid, 'private.pdf', a || '/22222222-2222-4222-8222-222222222222.pdf', 'application/pdf', 10);
  insert into r values ('the owner adds files to their folders', true, null);
  begin
    insert into public.folder_files (folder_id, name, path) values (null, 'stolen.pdf', current_setting('ct.b') || '/33333333-3333-4333-8333-333333333333.pdf');
    insert into r values ('a row pointing at someone else''s upload is refused', false, 'allowed');
  exception when others then insert into r values ('a row pointing at someone else''s upload is refused', true, sqlerrm); end;
  perform public.share_note_with('folder', current_setting('ct.f')::uuid, current_setting('ct.bh'), 'viewer');
end $$;

select pg_temp.as_user('b');
do $$
declare n int;
begin
  select count(*) into n from public.folder_files where name in ('shared.pdf', 'private.pdf');
  insert into r values ('someone the folder is shared with sees only its files', n = 1, n::text);
  insert into r values ('…and can read the stored object', public.ct_can_read_folder_file(current_setting('ct.a') || '/11111111-1111-4111-8111-111111111111.pdf'), null);
  insert into r values ('…but not the private one', not public.ct_can_read_folder_file(current_setting('ct.a') || '/22222222-2222-4222-8222-222222222222.pdf'), null);
  update public.folder_files set name = 'renamed by viewer' where name = 'shared.pdf';
  select count(*) into n from public.folder_files where name = 'renamed by viewer';
  insert into r values ('a viewer cannot rename it', n = 0, n::text);
  begin
    insert into public.folder_files (folder_id, name, path) values (current_setting('ct.f')::uuid, 'mine.pdf', current_setting('ct.b') || '/33333333-3333-4333-8333-333333333333.pdf');
    insert into r values ('a viewer cannot add files to the folder', false, 'allowed');
  exception when others then insert into r values ('a viewer cannot add files to the folder', true, sqlerrm); end;
end $$;

select pg_temp.as_user('c');
do $$
declare n int;
begin
  select count(*) into n from public.folder_files where name in ('shared.pdf', 'private.pdf');
  insert into r values ('a stranger sees none of them', n = 0, n::text);
  insert into r values ('…and cannot read the object', not public.ct_can_read_folder_file(current_setting('ct.a') || '/11111111-1111-4111-8111-111111111111.pdf'), null);
end $$;

select pg_temp.as_user('a');
do $$
declare n int;
begin
  begin
    update public.folder_files set path = current_setting('ct.a') || '/99999999-9999-4999-8999-999999999999.pdf' where name = 'shared.pdf';
    insert into r values ('a stored path cannot be repointed', false, 'allowed');
  exception when others then insert into r values ('a stored path cannot be repointed', true, sqlerrm); end;
  update public.folder_files set folder_id = null where name = 'private.pdf';
  select count(*) into n from public.folder_files where name = 'private.pdf' and folder_id is null;
  insert into r values ('the owner can move a file to General', n = 1, n::text);
  delete from public.note_folders where id = current_setting('ct.f')::uuid;
  select count(*) into n from public.folder_files where name = 'shared.pdf' and folder_id is null;
  insert into r values ('deleting a folder keeps its files, in General', n = 1, n::text);
end $$;

select step, ok, detail from r;
