-- ============================================================================
-- Comments grow up: replies, likes, pinning, and "liked by the author".
-- RUN IN: Supabase SQL Editor. Safe to re-run. Non-destructive.
--
-- THREE ADDITIONS, one table each time they could have been:
--
--   parent_id   a reply is a comment with a parent. Not a `replies` table —
--               the body, the author, the moderation policy and the like
--               button are identical, and a second table would mean keeping
--               two sets of all of them in step.
--   pinned_at   a timestamp rather than a boolean, so "the three pinned ones"
--               has a stable order that is not the comment's own age.
--   likes       its own table, because a like is a row per person and the
--               count has to be derivable without trusting a counter that
--               drifts the first time a delete is missed.
--
-- ONE LEVEL OF NESTING, ENFORCED. A reply to a reply is refused and folded
-- onto the top-level parent instead. Unbounded nesting produces threads that
-- cannot be rendered on a 390px screen without horizontal scrolling, and
-- every product that shipped it later capped it anyway.
-- ============================================================================

alter table public.post_comments
  add column if not exists parent_id uuid references public.post_comments (id) on delete cascade,
  add column if not exists pinned_at timestamptz;

create index if not exists post_comments_parent_idx
  on public.post_comments (parent_id, created_at) where parent_id is not null;
create index if not exists post_comments_pinned_idx
  on public.post_comments (post_id, pinned_at desc) where pinned_at is not null;

-- ── One level deep ──────────────────────────────────────────────────────────
-- A trigger rather than a CHECK, because the rule is about ANOTHER row.
create or replace function public.ct_comment_depth() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_parent uuid; v_post uuid;
begin
  if new.parent_id is null then return new; end if;
  select parent_id, post_id into v_parent, v_post
    from public.post_comments where id = new.parent_id;
  if v_post is null then
    raise exception 'That comment does not exist.' using errcode = 'foreign_key_violation';
  end if;
  if v_post <> new.post_id then
    raise exception 'A reply has to be on the same post as the comment it answers.'
      using errcode = 'check_violation';
  end if;
  -- Replying to a reply attaches to its parent instead of refusing: the person
  -- meant to join that thread, and an error would be a worse answer than the
  -- obvious one.
  if v_parent is not null then new.parent_id := v_parent; end if;
  return new;
end $$;

drop trigger if exists trg_comment_depth on public.post_comments;
create trigger trg_comment_depth
  before insert or update of parent_id on public.post_comments
  for each row execute function public.ct_comment_depth();

-- ── Likes ───────────────────────────────────────────────────────────────────
create table if not exists public.post_comment_likes (
  comment_id uuid not null references public.post_comments (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
create index if not exists post_comment_likes_user_idx on public.post_comment_likes (user_id);

alter table public.post_comment_likes enable row level security;

-- Readable by anyone, because the count is public and so is whether the
-- post's author is among them. Writable only as yourself — the same shape
-- `post_likes` already has.
drop policy if exists comment_likes_read on public.post_comment_likes;
create policy comment_likes_read on public.post_comment_likes
  for select to anon, authenticated using (true);
drop policy if exists comment_likes_write on public.post_comment_likes;
create policy comment_likes_write on public.post_comment_likes
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists comment_likes_delete on public.post_comment_likes;
create policy comment_likes_delete on public.post_comment_likes
  for delete to authenticated using (auth.uid() = user_id);

/** Returns the resulting state, so an optimistic heart can put itself back. */
create or replace function public.toggle_comment_like(p_comment uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_had boolean;
begin
  if v_uid is null then return false; end if;
  select true into v_had from public.post_comment_likes
   where comment_id = p_comment and user_id = v_uid;
  if v_had then
    delete from public.post_comment_likes where comment_id = p_comment and user_id = v_uid;
    return false;
  end if;
  insert into public.post_comment_likes (comment_id, user_id) values (p_comment, v_uid)
    on conflict do nothing;
  return true;
end $$;
grant execute on function public.toggle_comment_like(uuid) to authenticated;

-- ── Pinning ─────────────────────────────────────────────────────────────────
/**
 * THE POST'S ORGANISATION PINS, nobody else — not the comment's author, who
 * would otherwise be able to pin themselves to the top of somebody else's
 * post.
 *
 * THE CAP IS ENFORCED HERE, not in the UI. Three is a deliberate number: it
 * is what fits above the fold before the newest comment, and a pinned list
 * that can grow without limit is just a second comment order.
 *
 * A REPLY CANNOT BE PINNED. Pinning lifts something to the top of the thread,
 * and a reply lifted out of the exchange it belongs to reads as a non-sequitur.
 */
create or replace function public.set_comment_pinned(p_comment uuid, p_pinned boolean)
returns text
language plpgsql security definer set search_path = public as $$
declare v_post uuid; v_org uuid; v_parent uuid; n int;
begin
  select c.post_id, c.parent_id into v_post, v_parent
    from public.post_comments c where c.id = p_comment and not c.deleted;
  if v_post is null then return 'no_comment'; end if;
  if v_parent is not null then return 'is_reply'; end if;

  select p.org_id into v_org from public.org_posts p where p.id = v_post;
  if not public.ct_can_act_as_org(v_org) then return 'not_yours'; end if;

  if p_pinned then
    select count(*) into n from public.post_comments
     where post_id = v_post and pinned_at is not null and id <> p_comment and not deleted;
    if n >= 3 then return 'full'; end if;
    update public.post_comments set pinned_at = now() where id = p_comment;
  else
    update public.post_comments set pinned_at = null where id = p_comment;
  end if;
  return 'ok';
end $$;
grant execute on function public.set_comment_pinned(uuid, boolean) to authenticated;

-- ── The list, with everything a row needs to draw itself ────────────────────
-- Dropped first: a `returns table` row type cannot be widened by
-- `create or replace` — Postgres answers 42P13 and refuses the whole file.
drop function if exists public.post_comment_list(uuid, int);

create or replace function public.post_comment_list(p_post uuid, p_limit int default 200)
returns table (
  id          uuid,
  user_id     uuid,
  handle      text,
  name        text,
  avatar_url  text,
  body        text,
  created_at  timestamptz,
  is_mine     boolean,
  parent_id   uuid,
  pinned_at   timestamptz,
  likes       integer,
  i_like      boolean,
  -- True when somebody who can act for the posting organisation has liked it.
  -- The label it draws ("Liked by author") is the post's voice, so it asks
  -- about the ORG rather than about the human who pressed publish.
  liked_by_author boolean,
  -- Whether the viewer may pin it, so the menu can be absent rather than
  -- shown and refused.
  can_pin     boolean
)
language sql stable security definer set search_path = public as $$
  with post as (
    select p.id, p.org_id from public.org_posts p where p.id = p_post
  ),
  authors as (
    -- Everyone who can act for the posting org: its owner and active team.
    select o.owner_id as uid from public.organizations o, post
     where o.id = post.org_id and o.owner_id is not null
    union
    select m.user_id from public.org_members m, post
     where m.org_id = post.org_id and coalesce(m.status, 'active') = 'active'
  )
  select c.id, c.user_id, up.handle, up.name, up.avatar_url, c.body, c.created_at,
         c.user_id = auth.uid(),
         c.parent_id,
         c.pinned_at,
         (select count(*)::int from public.post_comment_likes l where l.comment_id = c.id),
         exists (select 1 from public.post_comment_likes l
                  where l.comment_id = c.id and l.user_id = auth.uid()),
         exists (select 1 from public.post_comment_likes l
                  join authors a on a.uid = l.user_id
                 where l.comment_id = c.id),
         public.ct_can_act_as_org((select org_id from post))
    from public.post_comments c
    join public.user_profile up on up.user_id = c.user_id
   where c.post_id = p_post and not c.deleted
     and not public.ct_blocked_between(auth.uid(), c.user_id)
   order by c.created_at
   limit greatest(1, least(coalesce(p_limit, 200), 500));
$$;
grant execute on function public.post_comment_list(uuid, int) to anon, authenticated;

-- ── Checks ──────────────────────────────────────────────────────────────────
--   select id, parent_id, pinned_at, likes, liked_by_author, can_pin
--     from public.post_comment_list('<post>');
--   select public.set_comment_pinned('<a reply>', true);   -- 'is_reply'
--   select public.toggle_comment_like('<comment>');        -- true, then false
