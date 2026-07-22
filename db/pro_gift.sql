-- ── "Gifted Pro" celebration ─────────────────────────────────────────────────
-- When an admin grants a user Pro, flag it so the app can throw a one-time
-- confetti + thank-you moment the next time they log in. pro_gift_by carries the
-- granter's name so the message reads personal ("from Alex").
--
-- RUN AFTER db/admin_console.sql. Safe to re-run.

alter table public.user_profile
  add column if not exists pro_gift_pending boolean not null default false,
  add column if not exists pro_gift_by      text;

-- Extend the admin grant so a Pro grant also arms the celebration (and revoking
-- to free clears it). Redefining is idempotent (create or replace).
create or replace function public.admin_set_plan(p_uid uuid, p_plan text, p_expires timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare granter text;
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
end; $$;

-- The recipient clears their own celebration once they've seen it.
create or replace function public.dismiss_pro_gift()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.user_profile set pro_gift_pending = false where user_id = auth.uid();
end; $$;

grant execute on function public.admin_set_plan(uuid, text, timestamptz) to authenticated;
grant execute on function public.dismiss_pro_gift() to authenticated;
