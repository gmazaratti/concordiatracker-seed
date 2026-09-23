-- ============================================================================
-- What a post carries besides its pictures and its caption.
-- RUN IN: Supabase SQL Editor. Safe to re-run. Non-destructive.
--
-- Every column is NULLABLE (or has a default), so nothing that exists changes
-- meaning and nothing has to be backfilled. A deployment that has not run this
-- yet loses the new controls and keeps publishing exactly as before — the
-- client probes for the columns the same way it does for `translations`.
--
-- WHAT IS DELIBERATELY NOT HERE:
--   * no "boost" column. The feature does not exist, and a column for it would
--     be a promise in the schema that nothing keeps.
--   * no AI label. It was on the reference screen and it is the platform's
--     problem, not ours: we do not generate anybody's images.
--
-- THE FUNCTION BELOW WAS COPIED FROM `pg_get_functiondef` ON THE LIVE ONE, not
-- written from memory. The first attempt at this file invented a signature and
-- a column order that do not exist (and read `reposts.user_id`, which is
-- `actor_user`), and it would have replaced the working feed with a broken one.
-- ============================================================================

alter table public.org_posts
  -- WHO CAN SEE IT. `everyone` or `followers`. A text column with a CHECK
  -- rather than an enum: adding a third audience later is one migration, and
  -- an enum in Postgres is the thing you cannot easily take a value out of.
  add column if not exists audience text not null default 'everyone',
  -- WHERE IT IS. Free text, because "the atrium" is a real answer and no
  -- geocoder knows it.
  add column if not exists place text,
  -- A MAP LINK, kept separate from the text so the label can say one thing and
  -- the link go to another — which is what pasting a Google Maps URL under a
  -- human name amounts to.
  add column if not exists place_url text,
  -- THE EVENT THIS POST IS ABOUT, when there is one. Posts and events stay
  -- separate records; this is a reference, never an automatic creation.
  -- `uuid`, read off PostgREST's schema doc rather than assumed — a text
  -- column here would have failed the reference outright.
  add column if not exists event_id uuid references public.events (id) on delete set null,
  -- NOT YET PUBLIC. Null means out now, which is every post that exists.
  add column if not exists publish_at timestamptz,
  -- The counts the club would rather not show. Nothing is deleted — the likes
  -- and shares still happen and still count for them; the number is hidden.
  add column if not exists hide_likes boolean not null default false,
  add column if not exists hide_shares boolean not null default false;

do $$
begin
  alter table public.org_posts
    add constraint org_posts_audience_ck check (audience in ('everyone', 'followers'));
exception
  when duplicate_object then null;
end $$;

-- Scheduled posts are not on anybody's feed until their time comes, and the
-- index is what stops that check being a scan on every read.
create index if not exists org_posts_publish_at_idx
  on public.org_posts (publish_at) where publish_at is not null;

/**
 * THE FEED, WITH TWO MORE GATES.
 *
 * Dropped first: a `returns table` row type cannot be widened by
 * `create or replace` — Postgres answers 42P13 and refuses the whole file.
 *
 * BOTH NEW CONDITIONS ARE ABOUT WHO MAY SEE A ROW, never about how it looks:
 *   * `publish_at` in the future hides it from everyone EXCEPT the team that
 *     wrote it, who need to see what they have queued.
 *   * `audience = 'followers'` hides it from people who do not follow the org.
 *     Its own team always sees its posts.
 *
 * `hide_likes` / `hide_shares` are RETURNED rather than applied: they are a
 * display decision, and the club still has to be able to count its own.
 */
drop function if exists public.post_feed(uuid, boolean, int, int);

create or replace function public.post_feed(
  p_org uuid default null::uuid,
  p_following boolean default false,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  org_id uuid,
  handle text,
  org_name text,
  logo text,
  color text,
  glyph text,
  verified boolean,
  caption text,
  media jsonb,
  created_at timestamptz,
  likes integer,
  comments integer,
  reposts integer,
  i_like boolean,
  i_repost boolean,
  collaborators jsonb,
  audience text,
  place text,
  place_url text,
  event_id uuid,
  publish_at timestamptz,
  hide_likes boolean,
  hide_shares boolean
)
language sql stable security definer set search_path to 'public' as $function$
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
     and coalesce(o.status, 'pending') = 'approved'
     -- A PROFILE shows posts the org published AND posts it co-authored.
     -- One row either way, so a club that collaborates with its partner
     -- cannot produce two cards.
     and (
       p_org is null
       or p.org_id = p_org
       or exists (select 1 from public.post_collaborators pc
                   where pc.post_id = p.id and pc.org_id = p_org and pc.status = 'accepted')
     )
     -- Following either name is enough to see it.
     and (
       not p_following
       or exists (select 1 from public.org_follows f
                   where f.user_id = auth.uid()
                     and (f.org_id = o.id
                          or exists (select 1 from public.post_collaborators pc
                                      where pc.post_id = p.id and pc.org_id = f.org_id
                                        and pc.status = 'accepted')))
     )
     -- Queued, and not yours: not yet news.
     and (
       p.publish_at is null
       or p.publish_at <= now()
       or public.ct_is_org_member(p.org_id)
     )
     -- Followers only, and you do not: not yours to read.
     and (
       p.audience <> 'followers'
       or public.ct_is_org_member(p.org_id)
       or exists (select 1 from public.org_follows f
                   where f.org_id = o.id and f.user_id = auth.uid())
     )
   order by p.created_at desc
   limit greatest(1, least(coalesce(p_limit, 20), 50))
  offset greatest(0, coalesce(p_offset, 0));
$function$;
grant execute on function public.post_feed(uuid, boolean, int, int) to anon, authenticated;

-- ── Checks ──────────────────────────────────────────────────────────────────
--   update public.org_posts set publish_at = now() + interval '1 day' where id = '<id>';
--   select id from public.post_feed();   -- absent unless you run that org
--   update public.org_posts set audience = 'followers' where id = '<id>';
--   select id from public.post_feed();   -- absent unless you follow it
