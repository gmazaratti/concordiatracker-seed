-- ── Keep feedback author tiers in sync with plan changes ─────────────────────
-- Feedback posts/comments store a denormalized author_tier snapshot (taken at
-- post time), so a user who goes Pro AFTER posting still showed "Free". This
-- redefines admin_set_plan (supersedes the copy in db/pro_gift.sql) to ALSO
-- refresh that snapshot on every plan change — plus it still arms the gifted-Pro
-- celebration. Run this INSTEAD of / after db/pro_gift.sql. Safe to re-run.

create or replace function public.admin_set_plan(p_uid uuid, p_plan text, p_expires timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare granter text; tier text := case when p_plan = 'pro' then 'pro' else 'free' end;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;

  if p_plan = 'pro' then
    select name into granter from public.user_profile where user_id = auth.uid();
    update public.user_profile
       set plan_status      = p_plan,
           plan_expires_at   = p_expires,
           pro_gift_pending  = true,
           pro_gift_by       = coalesce(nullif(trim(granter), ''), 'the ConcordiaTracker team')
     where user_id = p_uid;
  else
    update public.user_profile
       set plan_status     = p_plan,
           plan_expires_at  = p_expires,
           pro_gift_pending = false
     where user_id = p_uid;
  end if;

  -- Refresh the denormalized author tier on this user's existing feedback so the
  -- Pro (or Free) badge is correct retroactively.
  update public.feature_requests        set author_tier = tier where user_id = p_uid;
  update public.feature_request_comments set author_tier = tier where user_id = p_uid;
end; $$;

grant execute on function public.admin_set_plan(uuid, text, timestamptz) to authenticated;
