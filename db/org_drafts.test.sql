-- ============================================================================
-- Drafts: somebody who may only draft can start and edit one and can never be
-- the person who publishes it; nobody outside the team ever sees one; and
-- followers hear about a post when it is PUBLISHED, not when it is started.
-- Real database, one transaction, rolled back.
-- ============================================================================
begin;

create temporary table t_out (n int generated always as identity, label text, got text, want text);
grant all on t_out to authenticated;
grant usage on sequence t_out_n_seq to authenticated;
create or replace function pg_temp.want(p_label text, p_got text, p_want text) returns void
language sql as $$ insert into t_out (label, got, want) values (p_label, p_got, p_want); $$;

create or replace function pg_temp.be(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_uid::text, 'role', 'authenticated',
                      'email', p_uid::text || '@t.test')::text, true);
$$;

do $$
declare
  org uuid := gen_random_uuid();
  owner_u uuid := gen_random_uuid();
  drafter_u uuid := gen_random_uuid();
  follower_u uuid := gen_random_uuid();
  stranger_u uuid := gen_random_uuid();
  intern uuid;
begin
  insert into auth.users (id, email, instance_id, aud, role) values
    (owner_u,    'zz-dr-owner@t.test',    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    (drafter_u,  'zz-dr-drafter@t.test',  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    (follower_u, 'zz-dr-follower@t.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    (stranger_u, 'zz-dr-stranger@t.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
  insert into public.user_profile (user_id, email, name, handle, is_internal)
  values (follower_u, 'zz-dr-follower@t.test', 'Follower', 'zzdrfollower', true)
  on conflict (user_id) do nothing;

  insert into public.organizations (id, owner_id, handle, name, glyph, color, status)
  values (org, owner_u, '@zz-drafttest', 'Draft Test', 'DT', '#8fb39a', 'approved');

  insert into public.org_roles (org_id, name, color, position, permissions)
  values (org, 'Intern', '#6b7280', 5,
          '{"draft_content": true, "post_create": false, "post_feed": false, "event_create": false}'::jsonb)
  returning id into intern;

  insert into public.org_members (org_id, user_id, email, name, role, status, role_id)
  values (org, drafter_u, 'zz-dr-drafter@t.test', 'Drafter', 'member', 'active', intern);

  insert into public.org_follows (user_id, org_id) values (follower_u, org);

  perform set_config('t.org', org::text, true);
  perform set_config('t.owner', owner_u::text, true);
  perform set_config('t.drafter', drafter_u::text, true);
  perform set_config('t.follower', follower_u::text, true);
  perform set_config('t.stranger', stranger_u::text, true);
end $$;

-- ── POSTS ───────────────────────────────────────────────────────────────────
-- 1. The intern starts a draft, as the API would.
select pg_temp.be(current_setting('t.drafter')::uuid);
set local role authenticated;
insert into public.org_posts (org_id, author_user, caption, media, is_draft)
values (current_setting('t.org')::uuid, current_setting('t.drafter')::uuid, 'first go',
        '[{"url":"https://x.test/a.webp"}]'::jsonb, true);
reset role;
select pg_temp.want('an intern can start a draft post',
  (select count(*)::text from public.org_posts where org_id = current_setting('t.org')::uuid and is_draft), '1');
select set_config('t.post', (select id::text from public.org_posts
  where org_id = current_setting('t.org')::uuid limit 1), true);

-- 2. The intern cannot publish a post outright.
select pg_temp.be(current_setting('t.drafter')::uuid);
set local role authenticated;
do $$ begin
  begin
    insert into public.org_posts (org_id, author_user, caption, media, is_draft)
    values (current_setting('t.org')::uuid, current_setting('t.drafter')::uuid, 'sneaky',
            '[{"url":"https://x.test/b.webp"}]'::jsonb, false);
    perform pg_temp.want('an intern cannot publish a post directly', 'ALLOWED', 'refused');
  exception when others then
    perform pg_temp.want('an intern cannot publish a post directly', 'refused', 'refused');
  end;
end $$;

-- 3. The intern can keep editing the draft...
update public.org_posts set caption = 'second go' where id = current_setting('t.post')::uuid;
reset role;
select pg_temp.want('an intern can edit the draft',
  (select caption from public.org_posts where id = current_setting('t.post')::uuid), 'second go');

-- 4. ...and cannot be the one who publishes it.
select pg_temp.be(current_setting('t.drafter')::uuid);
set local role authenticated;
do $$ begin
  begin
    update public.org_posts set is_draft = false where id = current_setting('t.post')::uuid;
    perform pg_temp.want('an intern cannot publish the draft', 'ALLOWED', 'refused');
  exception when others then
    perform pg_temp.want('an intern cannot publish the draft', 'refused', 'refused');
  end;
end $$;
reset role;

-- 5. Nobody outside the team can see it, and the feed does not carry it.
select pg_temp.be(current_setting('t.stranger')::uuid);
set local role authenticated;
select pg_temp.want('a stranger cannot read the draft',
  (select count(*)::text from public.org_posts where id = current_setting('t.post')::uuid), '0');
reset role;
select pg_temp.be(current_setting('t.follower')::uuid);
select pg_temp.want('the feed does not carry a draft',
  (select count(*)::text from public.post_feed(current_setting('t.org')::uuid)), '0');
select pg_temp.want('a follower is not told about a draft',
  (select count(*)::text from public.notifications
    where user_id = current_setting('t.follower')::uuid and kind = 'org_post'), '0');

-- 6. The owner publishes it. Now it is news.
select pg_temp.be(current_setting('t.owner')::uuid);
set local role authenticated;
update public.org_posts set is_draft = false where id = current_setting('t.post')::uuid;
reset role;
select pg_temp.want('the owner can publish the draft',
  (select (not is_draft)::text from public.org_posts where id = current_setting('t.post')::uuid), 'true');
select pg_temp.be(current_setting('t.follower')::uuid);
select pg_temp.want('the feed carries it once published',
  (select count(*)::text from public.post_feed(current_setting('t.org')::uuid)), '1');
select pg_temp.want('the follower is told exactly once, at publish',
  (select count(*)::text from public.notifications
    where user_id = current_setting('t.follower')::uuid and kind = 'org_post'), '1');

-- 7. And it cannot be pulled back into drafts.
select pg_temp.be(current_setting('t.owner')::uuid);
set local role authenticated;
do $$ begin
  begin
    update public.org_posts set is_draft = true where id = current_setting('t.post')::uuid;
    perform pg_temp.want('a published post cannot become a draft again', 'ALLOWED', 'refused');
  exception when others then
    perform pg_temp.want('a published post cannot become a draft again', 'refused', 'refused');
  end;
end $$;
reset role;

-- ── EVENTS ──────────────────────────────────────────────────────────────────
select pg_temp.be(current_setting('t.drafter')::uuid);
set local role authenticated;
insert into public.events (org_id, title, start, category, is_draft)
values (current_setting('t.org')::uuid, 'Draft night', now() + interval '5 days', 'clubs', true);
reset role;
select pg_temp.want('an intern can start a draft event',
  (select count(*)::text from public.events where org_id = current_setting('t.org')::uuid and is_draft), '1');
select set_config('t.event', (select id::text from public.events
  where org_id = current_setting('t.org')::uuid limit 1), true);
select pg_temp.want('the draft records who started it',
  (select (drafted_by = current_setting('t.drafter')::uuid)::text from public.events
    where id = current_setting('t.event')::uuid), 'true');

select pg_temp.be(current_setting('t.drafter')::uuid);
set local role authenticated;
do $$ begin
  begin
    update public.events set is_draft = false where id = current_setting('t.event')::uuid;
    -- RLS WITH CHECK makes this a 0-row update rather than an error.
    perform pg_temp.want('an intern cannot publish the draft event',
      (select case when is_draft then 'refused' else 'ALLOWED' end
         from public.events where id = current_setting('t.event')::uuid), 'refused');
  exception when others then
    perform pg_temp.want('an intern cannot publish the draft event', 'refused', 'refused');
  end;
end $$;
reset role;

select pg_temp.be(current_setting('t.stranger')::uuid);
set local role authenticated;
select pg_temp.want('a stranger cannot see the draft event',
  (select count(*)::text from public.events where id = current_setting('t.event')::uuid), '0');
reset role;

select pg_temp.be(current_setting('t.owner')::uuid);
set local role authenticated;
update public.events set is_draft = false where id = current_setting('t.event')::uuid;
reset role;
select pg_temp.be(current_setting('t.stranger')::uuid);
set local role authenticated;
select pg_temp.want('once published, anybody can see the event',
  (select count(*)::text from public.events where id = current_setting('t.event')::uuid), '1');
reset role;

-- ── The key exists and roles can carry it ───────────────────────────────────
select pg_temp.want('draft_content is a known permission key',
  ('draft_content' = any(public.ct_org_perm_keys()))::text, 'true');

select case when got = want then 'ok  ' else 'FAIL' end as r, label, got, want from t_out order by n;
rollback;
