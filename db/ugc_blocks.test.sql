-- Rolled back. (echo "begin;"; cat db/ugc_blocks.test.sql; echo "rollback;") > .t.sql && supabase db query --linked -f .t.sql
create temp table r (step text, ok boolean, detail text) on commit drop;
grant all on r to authenticated;
do $$
declare a uuid; o uuid; p uuid; bh text; before_n int;
begin
  select user_id into a from public.user_profile p where handle is not null
    and not exists (select 1 from public.admins x where x.user_id = p.user_id) order by created_at limit 1;
  select handle into bh from public.user_profile where handle is not null and user_id <> a order by created_at limit 1;
  select id into o from public.organizations where status = 'approved' and owner_id is distinct from a
    and not exists (select 1 from public.org_members m where m.org_id = organizations.id and m.user_id = a) limit 1;
  insert into public.org_posts (org_id, caption, media) values (o, 'ugc test', '[{"url":"x","kind":"image"}]') returning id into p;
  insert into public.org_follows (user_id, org_id) values (a, o) on conflict do nothing;
  select count(*) into before_n from public.notifications where kind = 'block_report';
  perform set_config('ct.a', a::text, true); perform set_config('ct.o', o::text, true);
  perform set_config('ct.p', p::text, true); perform set_config('ct.bh', bh, true);
  perform set_config('ct.n', before_n::text, true);
end $$;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('ct.a'), 'role', 'authenticated')::text, true);
do $$
declare n int; o uuid := current_setting('ct.o')::uuid; p uuid := current_setting('ct.p')::uuid;
begin
  select count(*) into n from public.post_feed(o, false, 50, 0) where id = p;
  insert into r values ('the post shows before blocking', n = 1, n::text);
  perform public.block_org(o);
  select count(*) into n from public.post_feed(o, false, 50, 0) where id = p;
  insert into r values ('blocking the club removes its posts from the feed', n = 0, n::text);
  select count(*) into n from public.live_stories() where org_id = o;
  insert into r values ('…and its stories', n = 0, n::text);
  select count(*) into n from public.org_follows where user_id = auth.uid() and org_id = o;
  insert into r values ('…and unfollows it', n = 0, n::text);
  select count(*) into n from public.my_org_blocks() where org_id = o;
  insert into r values ('it is listed under my blocks', n = 1, n::text);
  begin
    insert into public.org_blocks (user_id, org_id) values (auth.uid(), o);
    insert into r values ('a block cannot be written directly', false, 'allowed');
  exception when others then insert into r values ('a block cannot be written directly', true, sqlerrm); end;
  perform public.block_user(current_setting('ct.bh'));
  perform public.unblock_org(o);
  select count(*) into n from public.post_feed(o, false, 50, 0) where id = p;
  insert into r values ('unblocking brings the posts back', n = 1, n::text);
end $$;
reset role;
do $$
declare n int;
begin
  select count(*) - current_setting('ct.n')::int into n from public.notifications where kind = 'block_report';
  insert into r values ('both blocks notified the moderators', n >= 2, n::text);
end $$;
select step, ok, detail from r;
