-- Rolled back. Run with:
-- (echo "begin;"; cat db/notes_batch3.test.sql; echo "rollback;") > .t.sql && supabase db query --linked -f .t.sql
create temp table r (step text, ok boolean, detail text) on commit drop;
grant all on r to authenticated;

do $$
declare a uuid; b uuid; c uuid; bh text;
begin
  select user_id into a from public.user_profile where handle is not null order by created_at limit 1;
  select user_id, handle into b, bh from public.user_profile where handle is not null and user_id <> a order by created_at limit 1;
  select user_id into c from public.user_profile where handle is not null and user_id not in (a, b) order by created_at limit 1;
  delete from public.profile_blocks where blocker_id in (a, b, c) and blocked_id in (a, b, c);
  delete from public.messages where (sender = a and recipient = c) or (sender = c and recipient = a);
  insert into public.user_follows (follower, following) values (a, b), (b, a) on conflict do nothing;
  delete from public.user_follows where (follower = a and following = c) or (follower = c and following = a);
  update public.user_profile set dm_policy = 'everyone' where user_id in (b, c);
  insert into storage.objects (bucket_id, name) values ('dm-media', a::text || '/11111111-1111-4111-8111-111111111111.webp');
  perform set_config('ct.a', a::text, true); perform set_config('ct.b', b::text, true);
  perform set_config('ct.c', c::text, true); perform set_config('ct.bh', bh, true);
end $$;

set local role authenticated;
create or replace function pg_temp.as_user(k text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', current_setting('ct.' || k), 'role', 'authenticated')::text, true)
$$;

-- ── Images in DMs ───────────────────────────────────────────────────────────
select pg_temp.as_user('a');
do $$
declare a text := current_setting('ct.a'); b uuid := current_setting('ct.b')::uuid; c uuid := current_setting('ct.c')::uuid; att jsonb;
begin
  begin
    insert into public.messages (sender, recipient, body, attachment)
    values (a::uuid, b, '', jsonb_build_object('kind', 'image', 'path', b::text || '/11111111-1111-4111-8111-111111111111.webp', 'w', 10, 'h', 10));
    insert into r values ('an image from someone else''s folder is refused', false, 'allowed');
  exception when others then insert into r values ('an image from someone else''s folder is refused', true, sqlerrm); end;
  begin
    insert into public.messages (sender, recipient, body, attachment)
    values (a::uuid, b, '', jsonb_build_object('kind', 'image', 'path', a || '/22222222-2222-4222-8222-222222222222.webp', 'w', 10, 'h', 10));
    insert into r values ('an image that was never uploaded is refused', false, 'allowed');
  exception when others then insert into r values ('an image that was never uploaded is refused', true, sqlerrm); end;
  begin
    insert into public.messages (sender, recipient, body, attachment)
    values (a::uuid, b, '', jsonb_build_object('kind', 'image', 'path', a || '/../../etc/passwd', 'w', 10, 'h', 10));
    insert into r values ('a path with ../ is refused', false, 'allowed');
  exception when others then insert into r values ('a path with ../ is refused', true, sqlerrm); end;
  insert into public.messages (sender, recipient, body, attachment)
  values (a::uuid, b, '', jsonb_build_object('kind', 'image', 'path', a || '/11111111-1111-4111-8111-111111111111.webp', 'w', 99999, 'h', 30, 'evil', '<script>', 'url', 'https://x.example'))
  returning attachment into att;
  insert into r values ('a valid image to a friend is sent', att is not null, null);
  insert into r values ('extra fields are stripped', not (att ? 'evil') and not (att ? 'url'), att::text);
  insert into r values ('sizes are clamped', (att->>'w')::int = 10000, att->>'w');
  begin
    insert into public.messages (sender, recipient, body, attachment)
    values (a::uuid, c, '', jsonb_build_object('kind', 'image', 'path', a || '/11111111-1111-4111-8111-111111111111.webp', 'w', 10, 'h', 10));
    insert into r values ('no images to a stranger who has not replied', false, 'allowed');
  exception when others then insert into r values ('no images to a stranger who has not replied', true, sqlerrm); end;
end $$;

select pg_temp.as_user('b');
do $$
begin
  insert into r values ('the recipient can read the photo', public.ct_can_read_dm_media(current_setting('ct.a') || '/11111111-1111-4111-8111-111111111111.webp'), null);
end $$;
select pg_temp.as_user('c');
do $$
begin
  insert into r values ('a stranger cannot read the photo', not public.ct_can_read_dm_media(current_setting('ct.a') || '/11111111-1111-4111-8111-111111111111.webp'), null);
end $$;

-- ── Mentions and version authors ────────────────────────────────────────────
select pg_temp.as_user('a');
do $$
declare n uuid; res text;
begin
  insert into public.notes (title, content) values ('mention test', '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"one"}]}]}') returning id into n;
  perform set_config('ct.n', n::text, true);
  perform public.share_note_with('note', n, current_setting('ct.bh'), 'editor');
  res := public.note_mention(n, current_setting('ct.b')::uuid);
  insert into r values ('mentioning someone the note is shared with notifies them', res = 'sent', res);
  res := public.note_mention(n, current_setting('ct.b')::uuid);
  insert into r values ('a second mention within ten minutes does not', res = 'recent', res);
  res := public.note_mention(n, current_setting('ct.c')::uuid);
  insert into r values ('someone without access is not notified', res = 'no_access', res);
  res := public.note_mention(n, current_setting('ct.a')::uuid);
  insert into r values ('you are never notified about yourself', res = 'self', res);
end $$;

select pg_temp.as_user('b');
do $$
declare n uuid := current_setting('ct.n')::uuid; who uuid; vby uuid;
begin
  update public.notes set content = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"two"}]}]}' where id = n;
  select updated_by into who from public.notes where id = n;
  insert into r values ('the database records who saved', who = current_setting('ct.b')::uuid, who::text);
  select edited_by into vby from public.note_version_list(n) limit 1;
  insert into r values ('the kept version names who wrote it', vby = current_setting('ct.a')::uuid, coalesce(vby::text, 'none'));
end $$;

select pg_temp.as_user('c');
do $$
declare cnt int;
begin
  select count(*) into cnt from public.note_version_list(current_setting('ct.n')::uuid);
  insert into r values ('a stranger cannot list the versions', cnt = 0, cnt::text);
end $$;

select step, ok, detail from r;
