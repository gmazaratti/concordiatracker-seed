-- A club posts; the people who follow it are told.
--
-- WHY ON BY DEFAULT. Following a club is an explicit act with exactly one
-- meaning — "tell me what this club is doing". A follow that produces nothing
-- until you happen to open the right tab is a follow that did nothing, and the
-- whole reason an organisation is here is to reach the people who asked to
-- hear from it. So the default is on, and it is one switch to turn off.
--
-- POSTS, NOT STORIES. A story is gone in 24 hours and a club may put up five
-- in an evening; notifying on each is how somebody turns the whole thing off
-- and stops hearing about the post that mattered. Instagram draws the same
-- line for the same reason. Stories are found on the ring at the top of the
-- feed, which is what that row is for.
--
-- ONE NOTIFICATION PER POST, not per image — a ten-image carousel is one thing
-- the club said.
--
-- A TRIGGER, not a call inside the publish handler. Same reasoning as every
-- other fan-out in db/notifications.sql: a post can be written by the composer,
-- by a script, by an admin in the SQL editor or by the next endpoint somebody
-- adds, and a notification that depends on remembering to send it is one that
-- eventually is not sent.
--
-- RUN in the Supabase SQL editor. Safe to re-run. Requires db/notifications.sql
-- and db/social_posts.sql.

-- ── The switch ──────────────────────────────────────────────────────────────
alter table public.user_profile
  add column if not exists notify_org_posts boolean not null default true;

comment on column public.user_profile.notify_org_posts is
  'Tell me when a club I follow posts. On by default — a follow is a request to hear from them.';

-- ── Who hears about it ──────────────────────────────────────────────────────
-- Followers who have not turned it off, minus whoever pressed publish. A
-- member of the club who happens to follow it should not be told about their
-- own announcement.
create or replace function public.ct_post_audience(p_org uuid, p_exclude uuid)
returns setof uuid
language sql stable security definer set search_path = public as $$
  select f.user_id
    from public.org_follows f
    join public.user_profile up on up.user_id = f.user_id
   where f.org_id = p_org
     and coalesce(up.notify_org_posts, true)
     and (p_exclude is null or f.user_id <> p_exclude)
     -- A member of the club is already the sender of this news.
     and not exists (
       select 1 from public.org_members m
        where m.org_id = p_org and m.user_id = f.user_id
          and coalesce(m.status, 'active') = 'active'
     );
$$;

create or replace function public.ct_on_org_post() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  audience uuid[];
  org_name text;
  org_slug text;
  approved boolean;
begin
  if coalesce(new.deleted, false) then return new; end if;

  select o.name, trim(leading '@' from o.handle),
         coalesce(o.status, 'pending') = 'approved'
    into org_name, org_slug, approved
    from public.organizations o where o.id = new.org_id;

  -- An unapproved club is invisible in Community, so a notification pointing
  -- at it would lead nowhere.
  if not coalesce(approved, false) then return new; end if;

  select array_agg(u) into audience
    from public.ct_post_audience(new.org_id, new.author_user) u;
  if audience is null then return new; end if;

  perform public.ct_notify(
    audience,
    'org_post',
    coalesce(org_name, 'A club you follow') || ' posted',
    -- Enough to know whether it is for you. A post with no caption says so
    -- rather than arriving as a blank line.
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
  after insert on public.org_posts
  for each row execute function public.ct_on_org_post();
