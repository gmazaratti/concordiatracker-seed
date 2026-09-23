-- ============================================================================
-- Stories can go back to drafts.
--
-- "Send back to drafts" takes a live story off the ring without losing it:
-- the team can post it again later, and it gets a fresh 24/48/72h from THAT
-- moment (a story's life is counted from when it goes up, which is why
-- republishing resets created_at as well as expires_at — the duration check
-- in story_duration.sql is relative to created_at).
--
-- Drafts are invisible to everyone outside the team: the read policy, the
-- ring (live_stories) and the reel (org_story_reel) all exclude them. The
-- team lists them through org_story_drafts(), which ignores expiry — a draft
-- kept past its old end time is still a draft.
--
-- Every verb checks the SAME thing posting a story checks: acting for the
-- club, with post_create. Re-runnable.
-- ============================================================================

alter table public.org_stories add column if not exists is_draft boolean not null default false;

drop policy if exists org_stories_read on public.org_stories;
create policy org_stories_read on public.org_stories
  for select to anon, authenticated
  using (
    not is_draft
    and expires_at > now()
    and exists (select 1 from public.organizations o
                 where o.id = org_stories.org_id and coalesce(o.status, 'pending') = 'approved')
  );

create or replace function public.live_stories()
returns table(org_id uuid, handle text, name text, logo text, color text, glyph text, verified boolean,
              total integer, unseen integer, latest_at timestamptz, cover text)
language sql stable security definer set search_path to 'public' as $$
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
   group by o.id, o.handle, o.name, o.logo, o.color, o.glyph, o.verified
   order by count(*) filter (where v.story_id is null) > 0 desc, max(s.created_at) desc;
$$;

create or replace function public.org_story_reel(p_org uuid)
returns table(id uuid, image_url text, caption text, overlays jsonb, mentions text[], place text,
              link_url text, created_at timestamptz, seen boolean, liked boolean, views integer)
language sql stable security definer set search_path to 'public' as $$
  select s.id, s.image_url, s.caption, s.overlays, s.mentions, s.place, s.link_url,
         s.created_at,
         v.story_id is not null,
         coalesce(v.liked, false),
         -- A count, never a list. The club learns how many, not who.
         (select count(*)::int from public.story_views w where w.story_id = s.id)
    from public.org_stories s
    left join public.story_views v on v.story_id = s.id and v.user_id = auth.uid()
   where s.org_id = p_org and s.expires_at > now() and not s.is_draft
   order by s.created_at;
$$;

create or replace function public.story_to_draft(p_story uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare o uuid;
begin
  select org_id into o from org_stories where id = p_story;
  if o is null then raise exception 'That story no longer exists.'; end if;
  if not (public.ct_can_act_as_org(o) and public.org_perm(o, 'post_create')) then
    raise exception 'You cannot manage this club''s stories.' using errcode = '42501';
  end if;
  update org_stories set is_draft = true where id = p_story;
end $$;

create or replace function public.publish_story_draft(p_story uuid, p_hours int default 24)
returns void
language plpgsql security definer set search_path = public as $$
declare o uuid;
begin
  if p_hours not in (24, 48, 72) then raise exception 'A story lasts 24, 48 or 72 hours.'; end if;
  select org_id into o from org_stories where id = p_story and is_draft;
  if o is null then raise exception 'That draft no longer exists.'; end if;
  if not (public.ct_can_act_as_org(o) and public.org_perm(o, 'post_create')) then
    raise exception 'You cannot manage this club''s stories.' using errcode = '42501';
  end if;
  update org_stories
     set is_draft = false, created_at = now(), expires_at = now() + make_interval(hours => p_hours)
   where id = p_story;
end $$;

create or replace function public.org_story_drafts(p_org uuid)
returns table(id uuid, image_url text, caption text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.ct_can_act_as_org(p_org) then return; end if;
  return query
  select s.id, s.image_url, s.caption, s.created_at
    from org_stories s where s.org_id = p_org and s.is_draft
   order by s.created_at desc;
end $$;

revoke all on function public.story_to_draft(uuid) from public, anon;
revoke all on function public.publish_story_draft(uuid, int) from public, anon;
revoke all on function public.org_story_drafts(uuid) from public, anon;
grant execute on function public.story_to_draft(uuid) to authenticated;
grant execute on function public.publish_story_draft(uuid, int) to authenticated;
grant execute on function public.org_story_drafts(uuid) to authenticated;

-- Deleting through a function, not a plain DELETE: a DELETE … RETURNING is
-- filtered by the READ policy, which hides drafts, so the client could not
-- tell "deleted a draft" from "deleted nothing". Same permission as posting.
create or replace function public.delete_story(p_story uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare o uuid;
begin
  select org_id into o from org_stories where id = p_story;
  if o is null then return false; end if;
  if not (public.ct_can_act_as_org(o) and public.org_perm(o, 'post_create')) then
    raise exception 'You cannot manage this club''s stories.' using errcode = '42501';
  end if;
  delete from org_stories where id = p_story;
  return true;
end $$;
revoke all on function public.delete_story(uuid) from public, anon;
grant execute on function public.delete_story(uuid) to authenticated;
