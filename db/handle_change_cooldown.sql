-- ============================================================================
-- Handle change cooldown — limit @handle changes to once every 14 days.
-- Safe to run more than once. Run this BEFORE (or with) the frontend deploy;
-- the app degrades gracefully if the column/trigger aren't present yet (handle
-- changes are simply unthrottled until then), so there's no hard ordering.
-- ============================================================================

-- 1. Track when the handle was last CHANGED (null = never changed yet).
alter table public.user_profile
  add column if not exists handle_changed_at timestamptz;

-- 2. Enforce the cooldown server-side so it can't be bypassed by a crafted
--    client. The onboarding FIRST-set (old handle null) is free and does NOT
--    start the clock; the first real change is also free and starts it; after
--    that, a change is rejected if the previous one was < 14 days ago.
create or replace function public.enforce_handle_cooldown()
returns trigger
language plpgsql
as $$
begin
  if new.handle is distinct from old.handle then
    -- Only throttle real changes (there was already a handle), not the first set.
    if old.handle is not null then
      if old.handle_changed_at is not null
         and old.handle_changed_at > now() - interval '14 days' then
        raise exception 'handle change is rate-limited (once every 14 days)'
          using errcode = 'check_violation';
      end if;
      new.handle_changed_at := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_handle_cooldown on public.user_profile;
create trigger trg_handle_cooldown
  before update of handle on public.user_profile
  for each row execute function public.enforce_handle_cooldown();
