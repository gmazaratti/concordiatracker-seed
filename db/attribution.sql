-- ── Marketing-channel attribution ────────────────────────────────────────────
-- Onboarding asks "how'd you find us?" and stores the choice on
-- user_profile.ui_state.heardFrom (+ heardFromDetail free-text for "other").
-- user_profile is own-row RLS, so aggregating across users needs a SECURITY
-- DEFINER, admin-gated rollup. Distinct from the referral system (vanity_code /
-- referred_by_code) — this is "which channel", that is "which person".
--
-- RUN anytime (read-only). Safe to re-run.

create or replace function public.attribution_summary()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  select jsonb_build_object(
    'total', (select count(*) from public.user_profile),
    'answered', (
      select count(*) from public.user_profile
      where coalesce(ui_state ->> 'heardFrom', '') <> ''
    ),
    -- { source_id : count } over everyone who answered
    'counts', (
      select coalesce(jsonb_object_agg(src, n), '{}'::jsonb) from (
        select ui_state ->> 'heardFrom' as src, count(*) as n
        from public.user_profile
        where coalesce(ui_state ->> 'heardFrom', '') <> ''
        group by 1
      ) s
    ),
    -- the free-text write-ins from people who picked "other"
    'other_details', (
      select coalesce(jsonb_agg(d.detail), '[]'::jsonb) from (
        select ui_state ->> 'heardFromDetail' as detail
        from public.user_profile
        where ui_state ->> 'heardFrom' = 'other'
          and coalesce(ui_state ->> 'heardFromDetail', '') <> ''
        limit 300
      ) d
    )
  )
  into result;
  return coalesce(result, '{}'::jsonb);
end $$;
grant execute on function public.attribution_summary() to authenticated;
