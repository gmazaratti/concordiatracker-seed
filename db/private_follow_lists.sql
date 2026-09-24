-- ─────────────────────────────────────────────────────────────────────────────
-- Follower / following lists are private for private profiles.
--
-- `profile_follow_list` was granted to anon and answered for ANY handle, so a
-- signed-out visitor could list who a private account follows and who follows
-- it. A private profile does not appear in search, and its social graph should
-- not be readable either.
--
-- WHO MAY LIST, now:
--   * anybody, when the profile is public (unchanged);
--   * the owner;
--   * the owner's APPROVED followers. There is no separate approval step in this
--     app: a follow the owner has returned is the accepted connection
--     (`ct_is_mutual`, the same test that gates messages and schedule sharing),
--     so that is what "approved" means here.
-- Never across a block, in either direction.
--
-- Everyone else gets an empty list. `can_view_follow_lists` answers the same
-- question up front, so the UI can say the lists are private instead of
-- showing "no followers", which would be a false statement about the account.
--
-- Counts (profile_social) are untouched: a number reveals nobody.
-- Re-runnable: create or replace, same signature, grants restated.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.can_view_follow_lists(p_handle text)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select (
             coalesce(up.profile_public, false)
             or up.user_id = auth.uid()
             or public.ct_is_mutual(auth.uid(), up.user_id)
           )
           and not public.ct_blocked_between(auth.uid(), up.user_id)
      from public.user_profile up
     where lower(up.handle) = lower(trim(p_handle))
     limit 1
  ), false);
$$;
grant execute on function public.can_view_follow_lists(text) to anon, authenticated;

create or replace function public.profile_follow_list(
  p_handle text,
  p_kind   text,               -- 'followers' | 'following'
  p_limit  int default 50,
  p_offset int default 0
)
returns table (
  handle     text,
  name       text,
  avatar_url text,
  i_follow   boolean,
  is_me      boolean
)
language sql stable security definer set search_path = public as $$
  with target as (
    select up.user_id from public.user_profile up
     where lower(up.handle) = lower(trim(p_handle))
       and public.can_view_follow_lists(p_handle)
  ),
  people as (
    select case when p_kind = 'followers' then f.follower else f.following end as uid
      from public.user_follows f, target t
     where (p_kind = 'followers' and f.following = t.user_id)
        or (p_kind = 'following' and f.follower  = t.user_id)
  )
  select p.handle, p.name, p.avatar_url,
         public.ct_follows(auth.uid(), p.user_id),
         p.user_id = auth.uid()
    from people
    join public.user_profile p on p.user_id = people.uid
   where not public.ct_blocked_between(auth.uid(), p.user_id)
   order by p.name nulls last, p.handle
   limit greatest(1, least(coalesce(p_limit, 50), 100))
  offset greatest(0, coalesce(p_offset, 0));
$$;
grant execute on function public.profile_follow_list(text, text, int, int) to anon, authenticated;
