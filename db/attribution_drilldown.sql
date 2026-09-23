-- ============================================================================
-- Attribution: who chose what, and who referred whom.
--
-- attribution_summary now EXCLUDES internal accounts (staff, probes, Alfred's
-- QA account), the same rule every other admin count follows — it was the odd
-- one out, so test accounts were answering "how did you hear about us".
--
-- attribution_people(source) is the drill-down behind each row: the people
-- who picked it, with their write-in (for "Somewhere else") and, for "A
-- friend", the person they said referred them. The referrer is stored by the
-- client on ui_state.heardFromReferrer as a HANDLE, chosen from the people
-- search in onboarding (that search returns handles, never user ids, and it
-- should stay that way). Joined case-insensitively; an unknown handle shows as
-- written rather than failing the list.
--
-- Admin-only, like the summary. Re-runnable.
-- ============================================================================

create or replace function public.attribution_summary()
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  with pool as (
    select * from public.user_profile where not coalesce(is_internal, false)
  )
  select jsonb_build_object(
    'total', (select count(*) from pool),
    'answered', (select count(*) from pool where coalesce(ui_state ->> 'heardFrom', '') <> ''),
    'counts', (
      select coalesce(jsonb_object_agg(src, n), '{}'::jsonb) from (
        select ui_state ->> 'heardFrom' as src, count(*) as n
          from pool where coalesce(ui_state ->> 'heardFrom', '') <> ''
         group by 1
      ) s
    ),
    'other_details', (
      select coalesce(jsonb_agg(d.detail), '[]'::jsonb) from (
        select ui_state ->> 'heardFromDetail' as detail
          from pool
         where ui_state ->> 'heardFrom' = 'other'
           and coalesce(ui_state ->> 'heardFromDetail', '') <> ''
         limit 300
      ) d
    ),
    'referrals', (
      select count(*) from pool
       where ui_state ->> 'heardFrom' = 'friend'
         and coalesce(ui_state ->> 'heardFromReferrer', '') <> ''
    )
  ) into result;
  return coalesce(result, '{}'::jsonb);
end $$;

drop function if exists public.attribution_people(text);
create function public.attribution_people(p_source text)
returns table (
  user_id uuid, name text, handle text, avatar_url text, email text, joined_at timestamptz,
  detail text, referrer_handle text, referrer_name text, referrer_avatar text
)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return query
  with pool as (
    select p.*, nullif(regexp_replace(coalesce(p.ui_state ->> 'heardFromReferrer', ''), '^@+', ''), '') as ref_handle
      from public.user_profile p
     where not coalesce(p.is_internal, false)
       and p.ui_state ->> 'heardFrom' = p_source
  )
  select pool.user_id, pool.name, pool.handle, pool.avatar_url, u.email::text, pool.created_at,
         nullif(pool.ui_state ->> 'heardFromDetail', ''),
         coalesce(r.handle, pool.ref_handle), r.name, r.avatar_url
    from pool
    left join auth.users u on u.id = pool.user_id
    left join public.user_profile r on pool.ref_handle is not null and lower(r.handle) = lower(pool.ref_handle)
   order by pool.created_at desc
   limit 500;
end $$;

revoke all on function public.attribution_people(text) from public, anon;
grant execute on function public.attribution_people(text) to authenticated;
