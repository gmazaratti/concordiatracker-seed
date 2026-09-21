-- Posts, reposts and stories — the publishing half of Community.
--
-- WHAT THIS IS FOR. Until now an organisation could publish exactly one kind
-- of thing: an event, which is a dated obligation. Clubs do not only run
-- events — they recruit, they announce results, they show you the room was
-- full — and the reason every one of them lives on Instagram instead of here
-- is that we gave them nowhere to say any of it.
--
-- ORGS PUBLISH, PEOPLE REACT. Posts and stories are authored by an
-- ORGANISATION, never by a student. That is not a limitation waiting to be
-- lifted; it is the product. A feed of student posts is a social network with
-- a moderation problem and a cold-start problem, and the CLAUDE.md line that
-- Community "is NOT a social network" still holds. What students get is the
-- receiving half: follow, like, comment, repost, reply, share.
--
-- ONLY AN APPROVED ORG CAN PUBLISH. `ct_can_act_as_org` is the single gate,
-- used by every insert policy here. An unapproved org can already build a
-- profile; what approval buys is the right to put something in front of
-- other people. Same rule the event publish path uses, said once.
--
-- STORIES EXPIRE. 24 hours, in the column, and every read filters on it. A
-- "story" that stays forever is a post, and the whole reason a club will post
-- a photo of a half-full room is that it is gone tomorrow.
--
-- REPLIES TO A STORY ARE ORDINARY DMs. No `story_replies` table: a reply is a
-- message, it belongs in the conversation you already have with that account,
-- and routing it through `messages` means `dm_policy`, blocking and the
-- stranger limits all apply with no second implementation to keep in step.
--
-- RUN in the Supabase SQL editor. Safe to re-run.

-- ── 0. Who may publish as an organisation ───────────────────────────────────
create or replace function public.ct_can_act_as_org(p_org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organizations o
     where o.id = p_org
       and coalesce(o.status, 'pending') = 'approved'
       and (
         o.owner_id = auth.uid()
         or exists (
           select 1 from public.org_members m
            where m.org_id = o.id
              and m.user_id = auth.uid()
              and coalesce(m.status, 'active') = 'active'
         )
       )
  ) or public.is_admin();
$$;
grant execute on function public.ct_can_act_as_org(uuid) to authenticated;

-- ── 1. Posts ────────────────────────────────────────────────────────────────
create table if not exists public.org_posts (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  -- Which human pressed publish. Never shown; it is what makes a post
  -- attributable when somebody asks who put it there.
  author_user uuid references auth.users (id) on delete set null,
  caption     text not null default '',
  -- [{ "url": "https://…" }] — one entry is a single image, several is a
  -- carousel. An array rather than five columns because the difference
  -- between a post and a slideshow should not be a schema change.
  media       jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  edited_at   timestamptz,
  deleted     boolean not null default false
);

do $$ begin
  alter table public.org_posts
    add constraint org_posts_media_ck
    check (jsonb_typeof(media) = 'array' and jsonb_array_length(media) between 1 and 10);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.org_posts
    add constraint org_posts_caption_ck check (length(caption) <= 2200);
exception when duplicate_object then null; end $$;

create index if not exists org_posts_org_idx  on public.org_posts (org_id, created_at desc);
create index if not exists org_posts_feed_idx on public.org_posts (created_at desc) where not deleted;

alter table public.org_posts enable row level security;

drop policy if exists org_posts_read on public.org_posts;
create policy org_posts_read on public.org_posts
  for select to anon, authenticated
  using (
    not deleted
    and exists (
      select 1 from public.organizations o
       where o.id = org_id and coalesce(o.status, 'pending') = 'approved'
    )
  );

drop policy if exists org_posts_write on public.org_posts;
create policy org_posts_write on public.org_posts
  for insert to authenticated with check (public.ct_can_act_as_org(org_id));

drop policy if exists org_posts_update on public.org_posts;
create policy org_posts_update on public.org_posts
  for update to authenticated using (public.ct_can_act_as_org(org_id));

-- ── 2. Likes and comments ───────────────────────────────────────────────────
-- Anyone signed in. These are the only two things a STUDENT publishes here,
-- and both are attached to something an organisation already chose to post —
-- which is exactly the containment that keeps this from being a feed of
-- strangers talking to strangers.
create table if not exists public.post_likes (
  post_id uuid not null references public.org_posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.post_likes enable row level security;

drop policy if exists post_likes_read on public.post_likes;
create policy post_likes_read on public.post_likes
  for select to anon, authenticated using (true);
drop policy if exists post_likes_write on public.post_likes;
create policy post_likes_write on public.post_likes
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists post_likes_delete on public.post_likes;
create policy post_likes_delete on public.post_likes
  for delete to authenticated using (auth.uid() = user_id);

create table if not exists public.post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.org_posts (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now(),
  deleted    boolean not null default false
);
do $$ begin
  alter table public.post_comments
    add constraint post_comments_body_ck check (length(btrim(body)) between 1 and 1000);
exception when duplicate_object then null; end $$;
create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);
alter table public.post_comments enable row level security;

drop policy if exists post_comments_read on public.post_comments;
create policy post_comments_read on public.post_comments
  for select to anon, authenticated using (not deleted);
drop policy if exists post_comments_write on public.post_comments;
create policy post_comments_write on public.post_comments
  for insert to authenticated with check (auth.uid() = user_id);
-- The author can retract their own; the org that owns the post can hide one
-- from its own comments, which is the moderation floor for anything public.
drop policy if exists post_comments_update on public.post_comments;
create policy post_comments_update on public.post_comments
  for update to authenticated using (
    auth.uid() = user_id
    or exists (
      select 1 from public.org_posts p
       where p.id = post_id and public.ct_can_act_as_org(p.org_id)
    )
  );

-- ── 3. Reposts ──────────────────────────────────────────────────────────────
-- ONE TABLE FOR TWO TARGETS. An event and a post are both "a thing somebody
-- published that I want on my profile", and the second tab on a profile shows
-- them together. Two tables would mean two reads, two policies and a union on
-- every profile.
--
-- `target_id` is text because events carry text ids (`ev-techfair`) and posts
-- carry uuids. Storing the uuid as text costs an index entry and buys one
-- table instead of two; typing it as uuid would have excluded every event,
-- which is the only kind the user actually asked for.
create table if not exists public.reposts (
  id          uuid primary key default gen_random_uuid(),
  -- Exactly one of these. A repost is either a person saying "look at this"
  -- or an organisation amplifying another organisation.
  actor_user  uuid references auth.users (id) on delete cascade,
  actor_org   uuid references public.organizations (id) on delete cascade,
  target_kind text not null check (target_kind in ('event', 'post')),
  target_id   text not null,
  note        text,
  created_at  timestamptz not null default now()
);
do $$ begin
  alter table public.reposts
    add constraint reposts_one_actor_ck
    check ((actor_user is null) <> (actor_org is null));
exception when duplicate_object then null; end $$;

create unique index if not exists reposts_unique_idx
  on public.reposts (coalesce(actor_user, actor_org), target_kind, target_id);
create index if not exists reposts_target_idx on public.reposts (target_kind, target_id);

alter table public.reposts enable row level security;

drop policy if exists reposts_read on public.reposts;
create policy reposts_read on public.reposts
  for select to anon, authenticated using (true);
drop policy if exists reposts_write on public.reposts;
create policy reposts_write on public.reposts
  for insert to authenticated with check (
    (actor_user is not null and actor_user = auth.uid())
    or (actor_org is not null and public.ct_can_act_as_org(actor_org))
  );
drop policy if exists reposts_delete on public.reposts;
create policy reposts_delete on public.reposts
  for delete to authenticated using (
    actor_user = auth.uid()
    or (actor_org is not null and public.ct_can_act_as_org(actor_org))
  );

-- ── 4. Stories ──────────────────────────────────────────────────────────────
create table if not exists public.org_stories (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  author_user uuid references auth.users (id) on delete set null,
  image_url   text not null,
  caption     text,
  -- Text the club dragged onto the image: position as a FRACTION of the
  -- frame (0–1), so it lands in the same place on a phone and a desktop.
  -- [{ "text": "...", "x": .5, "y": .3, "font": "modern", "color": "#fff",
  --    "anim": "rise", "align": "center", "chip": true }]
  overlays    jsonb not null default '[]'::jsonb,
  -- Handles, stored as typed rather than as ids: an account that is renamed
  -- should not silently retag somebody else, and a story is gone in a day.
  mentions    text[] not null default '{}',
  place       text,
  link_url    text,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '24 hours'
);
create index if not exists org_stories_live_idx on public.org_stories (org_id, created_at desc);
alter table public.org_stories enable row level security;

drop policy if exists org_stories_read on public.org_stories;
create policy org_stories_read on public.org_stories
  for select to anon, authenticated
  using (
    expires_at > now()
    and exists (
      select 1 from public.organizations o
       where o.id = org_id and coalesce(o.status, 'pending') = 'approved'
    )
  );

drop policy if exists org_stories_write on public.org_stories;
create policy org_stories_write on public.org_stories
  for insert to authenticated with check (public.ct_can_act_as_org(org_id));
drop policy if exists org_stories_delete on public.org_stories;
create policy org_stories_delete on public.org_stories
  for delete to authenticated using (public.ct_can_act_as_org(org_id));

create table if not exists public.story_views (
  story_id uuid not null references public.org_stories (id) on delete cascade,
  user_id  uuid not null references auth.users (id) on delete cascade,
  liked    boolean not null default false,
  seen_at  timestamptz not null default now(),
  primary key (story_id, user_id)
);
alter table public.story_views enable row level security;

-- YOU CAN READ YOUR OWN VIEW ROW AND NOBODY ELSE'S. The club gets a COUNT
-- through a definer function; it never gets the list. Same rule as the
-- organizer metrics: aggregate only, because a student should be able to
-- look at a club's story without the club learning they did.
drop policy if exists story_views_read on public.story_views;
create policy story_views_read on public.story_views
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists story_views_write on public.story_views;
create policy story_views_write on public.story_views
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists story_views_update on public.story_views;
create policy story_views_update on public.story_views
  for update to authenticated using (auth.uid() = user_id);

-- ── 5. Reads ────────────────────────────────────────────────────────────────

/**
 * The stories row at the top of the feed.
 *
 * One entry per organisation that has something live, ordered the way
 * Instagram orders it: unseen first, then most recent. Carries a count and
 * the cover image so the row draws in one round trip.
 */
create or replace function public.live_stories()
returns table (
  org_id     uuid,
  handle     text,
  name       text,
  logo       text,
  color      text,
  glyph      text,
  verified   boolean,
  total      integer,
  unseen     integer,
  latest_at  timestamptz,
  cover      text
)
language sql stable security definer set search_path = public as $$
  select o.id, o.handle, o.name, o.logo, o.color, o.glyph, coalesce(o.verified, false),
         count(*)::int,
         count(*) filter (where v.story_id is null)::int,
         max(s.created_at),
         (array_agg(s.image_url order by s.created_at desc))[1]
    from public.org_stories s
    join public.organizations o on o.id = s.org_id
    left join public.story_views v on v.story_id = s.id and v.user_id = auth.uid()
   where s.expires_at > now()
     and coalesce(o.status, 'pending') = 'approved'
   group by o.id, o.handle, o.name, o.logo, o.color, o.glyph, o.verified
   order by count(*) filter (where v.story_id is null) > 0 desc, max(s.created_at) desc;
$$;
grant execute on function public.live_stories() to anon, authenticated;

/** Every live story for one org, oldest first — the order they are watched in. */
create or replace function public.org_story_reel(p_org uuid)
returns table (
  id         uuid,
  image_url  text,
  caption    text,
  overlays   jsonb,
  mentions   text[],
  place      text,
  link_url   text,
  created_at timestamptz,
  seen       boolean,
  liked      boolean,
  views      integer
)
language sql stable security definer set search_path = public as $$
  select s.id, s.image_url, s.caption, s.overlays, s.mentions, s.place, s.link_url,
         s.created_at,
         v.story_id is not null,
         coalesce(v.liked, false),
         -- A count, never a list. The club learns how many, not who.
         (select count(*)::int from public.story_views w where w.story_id = s.id)
    from public.org_stories s
    left join public.story_views v on v.story_id = s.id and v.user_id = auth.uid()
   where s.org_id = p_org and s.expires_at > now()
   order by s.created_at;
$$;
grant execute on function public.org_story_reel(uuid) to anon, authenticated;

/** Mark seen, and optionally set the like in the same write. */
create or replace function public.mark_story_seen(p_story uuid, p_liked boolean default null)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  insert into public.story_views (story_id, user_id, liked)
  values (p_story, auth.uid(), coalesce(p_liked, false))
  on conflict (story_id, user_id) do update
    set liked = coalesce(p_liked, public.story_views.liked);
  return true;
end; $$;
grant execute on function public.mark_story_seen(uuid, boolean) to authenticated;

/**
 * The feed, and the reposts tab, from one shape.
 *
 * `p_org` narrows to one organisation's own posts (the profile grid);
 * `p_following` narrows to what the caller follows (the feed). Counts and the
 * caller's own like/repost state come back with the row, because a feed that
 * renders and THEN fills in whether you liked something flickers every heart
 * on every scroll.
 */
create or replace function public.post_feed(
  p_org       uuid default null,
  p_following boolean default false,
  p_limit     int default 20,
  p_offset    int default 0
)
returns table (
  id          uuid,
  org_id      uuid,
  handle      text,
  org_name    text,
  logo        text,
  color       text,
  glyph       text,
  verified    boolean,
  caption     text,
  media       jsonb,
  created_at  timestamptz,
  likes       integer,
  comments    integer,
  reposts     integer,
  i_like      boolean,
  i_repost    boolean
)
language sql stable security definer set search_path = public as $$
  select p.id, o.id, o.handle, o.name, o.logo, o.color, o.glyph, coalesce(o.verified, false),
         p.caption, p.media, p.created_at,
         (select count(*)::int from public.post_likes l where l.post_id = p.id),
         (select count(*)::int from public.post_comments c where c.post_id = p.id and not c.deleted),
         (select count(*)::int from public.reposts r
           where r.target_kind = 'post' and r.target_id = p.id::text),
         exists (select 1 from public.post_likes l where l.post_id = p.id and l.user_id = auth.uid()),
         exists (select 1 from public.reposts r
                  where r.target_kind = 'post' and r.target_id = p.id::text
                    and r.actor_user = auth.uid())
    from public.org_posts p
    join public.organizations o on o.id = p.org_id
   where not p.deleted
     and coalesce(o.status, 'pending') = 'approved'
     and (p_org is null or p.org_id = p_org)
     and (
       not p_following
       or exists (select 1 from public.org_follows f
                   where f.org_id = o.id and f.user_id = auth.uid())
     )
   order by p.created_at desc
   limit greatest(1, least(coalesce(p_limit, 20), 50))
  offset greatest(0, coalesce(p_offset, 0));
$$;
grant execute on function public.post_feed(uuid, boolean, int, int) to anon, authenticated;

/** Comments on one post, with who wrote them. */
create or replace function public.post_comment_list(p_post uuid, p_limit int default 100)
returns table (
  id         uuid,
  user_id    uuid,
  handle     text,
  name       text,
  avatar_url text,
  body       text,
  created_at timestamptz,
  is_mine    boolean
)
language sql stable security definer set search_path = public as $$
  select c.id, c.user_id, up.handle, up.name, up.avatar_url, c.body, c.created_at,
         c.user_id = auth.uid()
    from public.post_comments c
    join public.user_profile up on up.user_id = c.user_id
   where c.post_id = p_post and not c.deleted
     and not public.ct_blocked_between(auth.uid(), c.user_id)
   order by c.created_at
   limit greatest(1, least(coalesce(p_limit, 100), 200));
$$;
grant execute on function public.post_comment_list(uuid, int) to anon, authenticated;

/** What one account has reposted — the second tab on every profile. */
create or replace function public.repost_list(p_handle text, p_is_org boolean default false)
returns table (
  id          uuid,
  target_kind text,
  target_id   text,
  note        text,
  created_at  timestamptz
)
language sql stable security definer set search_path = public as $$
  select r.id, r.target_kind, r.target_id, r.note, r.created_at
    from public.reposts r
   where (
     (not p_is_org and r.actor_user = (
        select up.user_id from public.user_profile up
         where lower(up.handle) = lower(trim(leading '@' from p_handle))))
     or (p_is_org and r.actor_org = (
        select o.id from public.organizations o
         where lower(o.handle) = lower('@' || trim(leading '@' from p_handle))
            or lower(o.handle) = lower(trim(leading '@' from p_handle))))
   )
   order by r.created_at desc
   limit 100;
$$;
grant execute on function public.repost_list(text, boolean) to anon, authenticated;

/** Repost or un-repost. Acting as an org when you may, as yourself otherwise. */
create or replace function public.toggle_repost(
  p_kind text,
  p_target text,
  p_as_org uuid default null
)
returns boolean                                   -- true = now reposted
language plpgsql security definer set search_path = public as $$
declare existing uuid; actor_u uuid; actor_o uuid;
begin
  if auth.uid() is null then return false; end if;
  if p_kind not in ('event', 'post') then return false; end if;

  if p_as_org is not null then
    if not public.ct_can_act_as_org(p_as_org) then return false; end if;
    actor_o := p_as_org;
  else
    actor_u := auth.uid();
  end if;

  select id into existing from public.reposts
   where target_kind = p_kind and target_id = p_target
     and coalesce(actor_user, actor_org) = coalesce(actor_u, actor_o);

  if existing is not null then
    delete from public.reposts where id = existing;
    return false;
  end if;

  insert into public.reposts (actor_user, actor_org, target_kind, target_id)
  values (actor_u, actor_o, p_kind, p_target);
  return true;
end; $$;
grant execute on function public.toggle_repost(text, text, uuid) to authenticated;

/** How many times an event has been reposted, and whether I did. Events live
 *  in their own table with text ids, so they cannot ride `post_feed`. */
create or replace function public.event_repost_state(p_events text[])
returns table (event_id text, reposts integer, i_repost boolean)
language sql stable security definer set search_path = public as $$
  select e.id,
         (select count(*)::int from public.reposts r
           where r.target_kind = 'event' and r.target_id = e.id),
         exists (select 1 from public.reposts r
                  where r.target_kind = 'event' and r.target_id = e.id
                    and r.actor_user = auth.uid())
    from unnest(p_events) as e(id);
$$;
grant execute on function public.event_repost_state(text[]) to anon, authenticated;

-- ── 6. The counts on an org profile ─────────────────────────────────────────
-- Followers cannot be counted from the client: `org_follows` is select-own, so
-- a browser query returns 1 or 0 and calls it the follower count. A definer
-- function returns the NUMBER and never the list, which is the same line the
-- organizer metrics draw — a club learns how many, never who.
create or replace function public.org_social(p_handle text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
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
    'posts',     (select count(*) from public.org_posts p where p.org_id = o_id and not p.deleted),
    'reposts',   (select count(*) from public.reposts r where r.actor_org = o_id),
    'i_follow',  exists (
      select 1 from public.org_follows f where f.org_id = o_id and f.user_id = auth.uid()
    ),
    'i_manage',  public.ct_can_act_as_org(o_id)
  ) into result;
  return result;
end; $$;
grant execute on function public.org_social(text) to anon, authenticated;
