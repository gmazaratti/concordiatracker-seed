-- ============================================================================
-- Drafts for posts and events, and a permission to write them without
-- publishing them.
--
-- WHAT A DRAFT IS: the team's working copy. It is never in front of a
-- student — not in the feed, not on the profile, not in a notification — and
-- anybody on the team whose role allows it can pick one up and carry on, so
-- one member starts it and another finishes it.
--
-- THE NEW PERMISSION, `draft_content`, is the junior half of publishing:
-- start and edit drafts, but not put them out. Somebody who CAN publish
-- reviews the draft and posts it. That is the whole point of the key, so the
-- one step it must never allow — a draft becoming public — is enforced by a
-- TRIGGER, not by a policy: a policy can say who may update a row, but only a
-- trigger can see that THIS update is the one that turns a draft into a post.
--
-- ADDITIVE ONLY. Two boolean columns that default to false (so every existing
-- post and event is already "published", which is what they are), one new
-- permission key, and extra permissive policies. Nothing that works today
-- stops working.
-- ============================================================================

-- ── Columns ─────────────────────────────────────────────────────────────────
alter table public.org_posts add column if not exists is_draft boolean not null default false;
alter table public.org_posts add column if not exists last_edited_by uuid;
alter table public.org_posts add column if not exists last_edited_at timestamptz;

alter table public.events add column if not exists is_draft boolean not null default false;
alter table public.events add column if not exists drafted_by uuid;
alter table public.events add column if not exists last_edited_by uuid;
alter table public.events add column if not exists last_edited_at timestamptz;

create index if not exists org_posts_drafts_idx on public.org_posts (org_id) where is_draft;
create index if not exists events_drafts_idx on public.events (org_id) where is_draft;

-- ── The permission key ──────────────────────────────────────────────────────
-- `create_org_role` / `update_org_role` store ONLY keys in this list, so a
-- role cannot carry `draft_content` until it is here. Legacy aliases stay.
create or replace function public.ct_org_perm_keys()
returns text[]
language sql
immutable
as $$
  select array[
    'post_create',    -- write a post or a story
    'post_feed',      -- publish a post to the Community feed
    'post_edit',      -- edit one that is already out
    'post_delete',    -- take one down
    'event_create',   -- post an event
    'event_update',   -- change one
    'draft_content',  -- start and edit drafts; somebody who can publish posts them
    'profile_edit',   -- name, bio, logo, banner, colour, links
    'handle_change',  -- the club's address; every shared link points at it
    'roles_grant',    -- hand somebody a role below your own
    'manage_team',    -- invite and remove people
    'view_insights',  -- the aggregate reach numbers
    -- Legacy aliases still named by live policies. `org_perm` maps them.
    'manage_events',
    'edit_profile'
  ];
$$;

-- The seeded Admin role keeps doing everything it did, plus drafting.
update public.org_roles
   set permissions = coalesce(permissions, '{}'::jsonb) || '{"draft_content": true}'::jsonb
 where system_key = 'admin'
   and not (coalesce(permissions, '{}'::jsonb) ? 'draft_content');

-- ── Who may touch a draft ───────────────────────────────────────────────────
create or replace function public.ct_can_draft(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.ct_is_org_member(p_org)
     and (public.org_perm(p_org, 'draft_content')
          or public.org_perm(p_org, 'post_create')
          or public.org_perm(p_org, 'event_create'));
$$;
grant execute on function public.ct_can_draft(uuid) to authenticated;

-- ── Posts: policies ─────────────────────────────────────────────────────────
-- Public read excludes drafts. The team's own branch (`ct_can_act_as_org`)
-- already sees everything, and a PENDING club's team can see its drafts too,
-- because drafting is exactly what a club waiting on approval can do.
drop policy if exists "org_posts_read" on public.org_posts;
create policy "org_posts_read" on public.org_posts for select using (
  (
    not deleted
    and not is_draft
    and exists (select 1 from public.organizations o
                 where o.id = org_posts.org_id
                   and coalesce(o.status, 'pending') = 'approved')
  )
  or public.ct_can_act_as_org(org_id)
  or (is_draft and not deleted and public.ct_is_org_member(org_id))
);

drop policy if exists "org_posts_draft_insert" on public.org_posts;
create policy "org_posts_draft_insert" on public.org_posts for insert
  with check (is_draft and public.ct_can_draft(org_id));

drop policy if exists "org_posts_draft_update" on public.org_posts;
create policy "org_posts_draft_update" on public.org_posts for update
  using (is_draft and public.ct_is_org_member(org_id))
  with check (public.ct_is_org_member(org_id));

-- ── Posts: the guard (live body + the draft branch in front of it) ─────────
create or replace function public.ct_guard_post_delete()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- A DRAFT is the team's working copy.
  if coalesce(old.is_draft, false) then
    if not coalesce(new.is_draft, false) then
      -- THE step that puts it in front of students. `draft_content` alone is
      -- deliberately not enough — that is what the key is for.
      if not public.org_perm(new.org_id, 'post_feed') then
        raise exception 'Only someone who can publish to the feed can post a draft.'
          using errcode = '42501';
      end if;
      -- It is news now, not when somebody first started typing it.
      new.created_at := now();
      new.last_edited_by := auth.uid();
      new.last_edited_at := now();
      return new;
    end if;
    if new.deleted is distinct from old.deleted then
      if not (public.ct_can_draft(new.org_id) or public.org_perm(new.org_id, 'post_delete')) then
        raise exception 'You do not have permission to discard this club''s drafts.'
          using errcode = '42501';
      end if;
      return new;
    end if;
    if not (public.ct_can_draft(new.org_id) or public.org_perm(new.org_id, 'post_edit')) then
      raise exception 'You do not have permission to edit this club''s drafts.'
        using errcode = '42501';
    end if;
    new.last_edited_by := auth.uid();
    new.last_edited_at := now();
    return new;
  end if;

  -- A published post does not go back to being private.
  if coalesce(new.is_draft, false) then
    raise exception 'A post that is already out cannot be turned back into a draft.'
      using errcode = '42501';
  end if;

  if new.deleted is distinct from old.deleted then
    if not public.org_perm(new.org_id, case when new.deleted then 'post_delete' else 'post_edit' end) then
      raise exception 'You do not have permission to delete this club''s posts.';
    end if;
  elsif not public.org_perm(new.org_id, 'post_edit') then
    raise exception 'You do not have permission to edit this club''s posts.';
  end if;
  return new;
end $$;

-- ── Posts: followers are told when it is PUBLISHED, not when it is drafted ──
create or replace function public.ct_on_org_post()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  audience uuid[];
  org_name text;
  org_slug text;
  approved boolean;
begin
  if coalesce(new.deleted, false) then return new; end if;
  -- A draft is nobody's news.
  if coalesce(new.is_draft, false) then return new; end if;
  -- On UPDATE, only the draft→published moment counts; an edit to a post
  -- that is already out must not notify everybody a second time.
  if tg_op = 'UPDATE' and not (coalesce(old.is_draft, false) and not coalesce(new.is_draft, false)) then
    return new;
  end if;

  select o.name, trim(leading '@' from o.handle),
         coalesce(o.status, 'pending') = 'approved'
    into org_name, org_slug, approved
    from public.organizations o where o.id = new.org_id;

  if not coalesce(approved, false) then return new; end if;

  select array_agg(u) into audience
    from public.ct_post_audience(new.org_id, new.author_user) u;
  if audience is null then return new; end if;

  perform public.ct_notify(
    audience,
    'org_post',
    coalesce(org_name, 'A club you follow') || ' posted',
    case
      when coalesce(btrim(new.caption), '') = '' then 'A new photo.'
      else left(new.caption, 140)
    end,
    '/app/community/org/' || org_slug || '?tab=posts',
    new.id,
    org_name
  );
  return new;
end $$;

drop trigger if exists trg_org_post on public.org_posts;
create trigger trg_org_post
  after insert or update of is_draft on public.org_posts
  for each row execute function public.ct_on_org_post();

-- ── Posts: the feed never shows a draft (live body + one clause) ────────────
create or replace function public.post_feed(
  p_org uuid default null::uuid, p_following boolean default false,
  p_limit integer default 20, p_offset integer default 0)
returns table(id uuid, org_id uuid, handle text, org_name text, logo text, color text,
  glyph text, verified boolean, caption text, media jsonb, created_at timestamp with time zone,
  likes integer, comments integer, reposts integer, i_like boolean, i_repost boolean,
  collaborators jsonb, audience text, place text, place_url text, event_id uuid,
  publish_at timestamp with time zone, hide_likes boolean, hide_shares boolean)
language sql
stable security definer
set search_path to 'public'
as $$
  select p.id, o.id, o.handle, o.name, o.logo, o.color, o.glyph, coalesce(o.verified, false),
         p.caption, p.media, p.created_at,
         (select count(*)::int from public.post_likes l where l.post_id = p.id),
         (select count(*)::int from public.post_comments c where c.post_id = p.id and not c.deleted),
         (select count(*)::int from public.reposts r
           where r.target_kind = 'post' and r.target_id = p.id::text),
         exists (select 1 from public.post_likes l where l.post_id = p.id and l.user_id = auth.uid()),
         exists (select 1 from public.reposts r
                  where r.target_kind = 'post' and r.target_id = p.id::text
                    and r.actor_user = auth.uid()),
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'org_id', co.id, 'handle', co.handle, 'name', co.name,
                    'logo', co.logo, 'color', co.color, 'glyph', co.glyph,
                    'verified', coalesce(co.verified, false))
                  order by co.name)
             from public.post_collaborators pc
             join public.organizations co on co.id = pc.org_id
            where pc.post_id = p.id and pc.status = 'accepted'
              and coalesce(co.status, 'pending') = 'approved'
         ), '[]'::jsonb),
         p.audience, p.place, p.place_url, p.event_id, p.publish_at,
         p.hide_likes, p.hide_shares
    from public.org_posts p
    join public.organizations o on o.id = p.org_id
   where not p.deleted
     and not p.is_draft
     and coalesce(o.status, 'pending') = 'approved'
     and (
       p_org is null
       or p.org_id = p_org
       or exists (select 1 from public.post_collaborators pc
                   where pc.post_id = p.id and pc.org_id = p_org and pc.status = 'accepted')
     )
     and (
       not p_following
       or exists (select 1 from public.org_follows f
                   where f.user_id = auth.uid()
                     and (f.org_id = o.id
                          or exists (select 1 from public.post_collaborators pc
                                      where pc.post_id = p.id and pc.org_id = f.org_id
                                        and pc.status = 'accepted')))
     )
     and (
       p.publish_at is null
       or p.publish_at <= now()
       or public.ct_is_org_member(p.org_id)
     )
     and (
       p.audience <> 'followers'
       or public.ct_is_org_member(p.org_id)
       or exists (select 1 from public.org_follows f
                   where f.org_id = o.id and f.user_id = auth.uid())
     )
   order by p.created_at desc
   limit greatest(1, least(coalesce(p_limit, 20), 50))
  offset greatest(0, coalesce(p_offset, 0));
$$;

-- ── Posts: the team's drafts ────────────────────────────────────────────────
-- Names come back with each row because "started by Dana, last touched by
-- Sam" is the entire reason to share a draft between people.
create or replace function public.org_post_drafts(p_org uuid)
returns table (id uuid, caption text, media jsonb, created_at timestamptz,
               author_user uuid, author_name text,
               last_edited_by uuid, last_edited_name text, last_edited_at timestamptz,
               audience text, place text, place_url text, event_id uuid,
               hide_likes boolean, hide_shares boolean)
language sql
stable security definer
set search_path to 'public'
as $$
  select p.id, p.caption, p.media, p.created_at,
         p.author_user, (select u.name from public.user_profile u where u.user_id = p.author_user),
         p.last_edited_by, (select u.name from public.user_profile u where u.user_id = p.last_edited_by),
         p.last_edited_at, p.audience, p.place, p.place_url, p.event_id,
         p.hide_likes, p.hide_shares
    from public.org_posts p
   where p.org_id = p_org
     and p.is_draft and not p.deleted
     and public.ct_is_org_member(p_org)
   order by coalesce(p.last_edited_at, p.created_at) desc;
$$;
grant execute on function public.org_post_drafts(uuid) to authenticated;

-- ── Events: policies ────────────────────────────────────────────────────────
drop policy if exists "events_public_read" on public.events;
create policy "events_public_read" on public.events for select using (
  not is_draft
  and exists (select 1 from public.organizations o
               where o.id = events.org_id and o.status = 'approved')
);

-- The team sees its own events, drafts included, whatever its status.
drop policy if exists "events_team_read" on public.events;
create policy "events_team_read" on public.events for select
  using (public.ct_is_org_member(org_id) or public.is_admin());

drop policy if exists "events_draft_insert" on public.events;
create policy "events_draft_insert" on public.events for insert
  with check (is_draft and public.ct_can_draft(org_id));

-- WITH CHECK keeps it a draft: somebody who may only draft can edit one all
-- day and can never be the person who publishes it.
drop policy if exists "events_draft_update" on public.events;
create policy "events_draft_update" on public.events for update
  using (is_draft and public.ct_can_draft(org_id))
  with check (is_draft and public.ct_can_draft(org_id));

drop policy if exists "events_draft_delete" on public.events;
create policy "events_draft_delete" on public.events for delete
  using (is_draft and public.ct_can_draft(org_id));

-- ── Events: publishing is its own permission ────────────────────────────────
create or replace function public.ct_guard_event_draft()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'INSERT' then
    if new.is_draft then
      new.drafted_by := coalesce(new.drafted_by, auth.uid());
      new.last_edited_by := auth.uid();
      new.last_edited_at := now();
    end if;
    return new;
  end if;

  if old.is_draft and not new.is_draft then
    if not public.org_perm(new.org_id, 'event_create') then
      raise exception 'Only someone who can post events can publish a draft.'
        using errcode = '42501';
    end if;
    new.posted_at := now();
  elsif not old.is_draft and new.is_draft then
    raise exception 'An event that is already out cannot be turned back into a draft.'
      using errcode = '42501';
  end if;
  new.last_edited_by := auth.uid();
  new.last_edited_at := now();
  return new;
end $$;

drop trigger if exists trg_guard_event_draft on public.events;
create trigger trg_guard_event_draft
  before insert or update on public.events
  for each row execute function public.ct_guard_event_draft();

-- The org's public counts leave drafts out.
create or replace function public.org_social(p_handle text)
returns jsonb
language plpgsql
stable security definer
set search_path = public
as $$
declare
  o_id   uuid;
  result jsonb;
begin
  select o.id into o_id from public.organizations o
   where lower(trim(leading '@' from o.handle)) = lower(trim(leading '@' from p_handle));
  if o_id is null then return null; end if;

  select jsonb_build_object(
    'org_id',    o_id,
    'followers', (select count(*) from public.org_follows f where f.org_id = o_id),
    'posts',     (select count(*) from public.org_posts p
                   where p.org_id = o_id and not p.deleted and not p.is_draft),
    'reposts',   (select count(*) from public.reposts r where r.actor_org = o_id),
    'i_follow',  exists (
      select 1 from public.org_follows f where f.org_id = o_id and f.user_id = auth.uid()
    ),
    'i_manage',  public.ct_can_act_as_org(o_id)
  ) into result;
  return result;
end; $$;
grant execute on function public.org_social(text) to anon, authenticated;
