-- App Store guideline 1.2: block a club as well as a person, filter what a
-- block hides on the SERVER, and tell us (the moderators) every time.
--
-- org_blocks is the club half of profile_blocks. Select-own, NO write policy:
-- every change goes through block_org / unblock_org so the follow teardown and
-- the moderator notice cannot be skipped. A club is never told it was blocked.
-- post_feed / live_stories / org_story_reel below are pg_get_functiondef of the
-- live functions (2026-10-11) with one block filter each.

create table if not exists public.org_blocks (
  user_id    uuid not null references auth.users(id) on delete cascade,
  org_id     uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, org_id)
);
alter table public.org_blocks enable row level security;
drop policy if exists org_blocks_select_own on public.org_blocks;
create policy org_blocks_select_own on public.org_blocks for select to authenticated
  using (user_id = auth.uid());
grant select on public.org_blocks to authenticated;

-- Human admins only: an agent account has nothing to review with.
create or replace function public.ct_notify_moderators(p_title text, p_body text, p_link text, p_subject uuid)
returns integer language sql security definer set search_path = public as $$
  select public.ct_notify(
    coalesce((select array_agg(a.user_id) from public.admins a
               where not exists (select 1 from public.agent_accounts g where g.user_id = a.user_id)),
             '{}'::uuid[]),
    'block_report', p_title, p_body, p_link, p_subject, null)
$$;
revoke all on function public.ct_notify_moderators(text, text, text, uuid) from public, anon, authenticated;

create or replace function public.ct_push_category(p_kind text)
returns text language sql immutable as $$
  select case p_kind
    when 'org_post' then 'club_posts'
    when 'follow' then 'follows'
    when 'request_status' then 'feature_requests'
    when 'request_comment' then 'feature_requests'
    when 'block_report' then 'moderation'
    else null
  end
$$;

create or replace function public.block_org(p_org uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); v_handle text;
begin
  if v_me is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  select handle into v_handle from public.organizations where id = p_org;
  if v_handle is null then raise exception 'No such club.' using errcode = 'P0002'; end if;
  if public.ct_is_org_member(p_org) and not public.is_admin() then
    raise exception 'You cannot block a club you are on the team of.' using errcode = '22023';
  end if;
  insert into public.org_blocks (user_id, org_id) values (v_me, p_org) on conflict do nothing;
  delete from public.org_follows f where f.user_id = v_me and f.org_id = p_org;
  perform public.ct_notify_moderators(
    'A club was blocked',
    coalesce((select '@' || handle from public.user_profile where user_id = v_me), 'Someone')
      || ' blocked ' || v_handle || '. Review its posts, stories and events.',
    '/app/community/org/' || ltrim(v_handle, '@'), p_org);
  return jsonb_build_object('blocked', true, 'org_id', p_org);
end $$;

create or replace function public.unblock_org(p_org uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  delete from public.org_blocks where user_id = auth.uid() and org_id = p_org;
  return jsonb_build_object('blocked', false, 'org_id', p_org);
end $$;

create or replace function public.my_org_blocks()
returns table (org_id uuid, handle text, name text, logo text, color text, glyph text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select o.id, o.handle, o.name, o.logo, o.color, o.glyph, b.created_at
    from public.org_blocks b join public.organizations o on o.id = b.org_id
   where b.user_id = auth.uid()
   order by b.created_at desc
$$;

grant execute on function public.block_org(uuid), public.unblock_org(uuid), public.my_org_blocks() to authenticated;

CREATE OR REPLACE FUNCTION public.block_user(p_handle text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_me     uuid := auth.uid();
  v_them   uuid;
begin
  if v_me is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;

  select p.user_id into v_them
    from public.user_profile p
   where lower(p.handle) = lower(trim(p_handle))
   limit 1;

  if v_them is null then
    raise exception 'No account with that handle.' using errcode = 'P0002';
  end if;
  if v_them = v_me then
    raise exception 'You cannot block yourself.' using errcode = '22023';
  end if;

  insert into public.profile_blocks (blocker_id, blocked_id)
  values (v_me, v_them)
  on conflict (blocker_id, blocked_id) do nothing;

  -- Both directions of both relationships. A block is not a request.
  -- Column names measured against production: requester / addressee, NOT
  -- requester_id / addressee_id.
  delete from public.friendships f
   where (f.requester = v_me and f.addressee = v_them)
      or (f.requester = v_them and f.addressee = v_me);

  -- user_follows, NOT profile_follows. Two migrations created a table for
  -- the same job; measured against production, user_follows is the one the
  -- app writes to and profile_follows has 0 rows. Its columns are
  -- follower / following, without the _id.
  delete from public.user_follows f
   where (f.follower = v_me and f.following = v_them)
      or (f.follower = v_them and f.following = v_me);

  -- App Store 1.2: a block tells us. Every human admin gets it in the bell
  -- (and as a push), with who blocked whom, so the account can be reviewed.
  perform public.ct_notify_moderators(
    'An account was blocked',
    coalesce((select '@' || handle from public.user_profile where user_id = v_me), 'Someone')
      || ' blocked @' || lower(trim(p_handle)) || '. Review their content.',
    '/admin?tab=users&user=' || v_them::text, v_them);

  return jsonb_build_object('blocked', true, 'handle', lower(trim(p_handle)));
end $function$;

CREATE OR REPLACE FUNCTION public.post_feed(p_org uuid DEFAULT NULL::uuid, p_following boolean DEFAULT false, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, org_id uuid, handle text, org_name text, logo text, color text, glyph text, verified boolean, caption text, media jsonb, created_at timestamp with time zone, likes integer, comments integer, reposts integer, i_like boolean, i_repost boolean, collaborators jsonb, audience text, place text, place_url text, event_id uuid, publish_at timestamp with time zone, hide_likes boolean, hide_shares boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
     and not exists (select 1 from public.org_blocks b where b.user_id = auth.uid() and b.org_id = o.id)
   order by p.created_at desc
   limit greatest(1, least(coalesce(p_limit, 20), 50))
  offset greatest(0, coalesce(p_offset, 0));
$function$;

CREATE OR REPLACE FUNCTION public.live_stories()
 RETURNS TABLE(org_id uuid, handle text, name text, logo text, color text, glyph text, verified boolean, total integer, unseen integer, latest_at timestamp with time zone, cover text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select o.id, o.handle, o.name, o.logo, o.color, o.glyph, coalesce(o.verified, false),
         count(*)::int,
         count(*) filter (where v.story_id is null)::int,
         max(s.created_at),
         (array_agg(s.image_url order by s.created_at desc))[1]
    from public.org_stories s
    join public.organizations o on o.id = s.org_id
    left join public.story_views v on v.story_id = s.id and v.user_id = auth.uid()
   where s.expires_at > now()
     and not s.is_draft
     and coalesce(o.status, 'pending') = 'approved'
     and not exists (select 1 from public.org_blocks b where b.user_id = auth.uid() and b.org_id = o.id)
   group by o.id, o.handle, o.name, o.logo, o.color, o.glyph, o.verified
   order by count(*) filter (where v.story_id is null) > 0 desc, max(s.created_at) desc;
$function$;

CREATE OR REPLACE FUNCTION public.org_story_reel(p_org uuid)
 RETURNS TABLE(id uuid, image_url text, caption text, overlays jsonb, mentions text[], place text, link_url text, created_at timestamp with time zone, seen boolean, liked boolean, views integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select s.id, s.image_url, s.caption, s.overlays, s.mentions, s.place, s.link_url,
         s.created_at,
         v.story_id is not null,
         coalesce(v.liked, false),
         -- A count, never a list. The club learns how many, not who.
         (select count(*)::int from public.story_views w where w.story_id = s.id)
    from public.org_stories s
    left join public.story_views v on v.story_id = s.id and v.user_id = auth.uid()
   where s.org_id = p_org and s.expires_at > now() and not s.is_draft
     and not exists (select 1 from public.org_blocks b where b.user_id = auth.uid() and b.org_id = p_org)
   order by s.created_at;
$function$;
