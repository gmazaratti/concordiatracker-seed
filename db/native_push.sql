-- ============================================================================
-- Native push: iPhones in the device store, a push for the bell, per-type
-- switches. Idempotent: safe to re-run.
-- ============================================================================
--
-- 1. push_subscriptions learns a second KIND of device.
--    web  — unchanged: a browser Web Push subscription (endpoint, p256dh, auth).
--    apns — the App Store app: an APNs device token. `endpoint` is kept unique
--           and NOT NULL by storing 'apns:<token>', so every existing query
--           (dedupe on endpoint, prune by endpoint) works without a branch.
--    The CHECK makes each shape complete: a web row without keys, or an apns
--    row whose endpoint disagrees with its token, cannot be written.
--
-- 2. notifications.pushed_at + claim_bell_pushes(): the stored bell rows are
--    turned into pushes ONCE. The claim stamps pushed_at in the same statement
--    that selects, under SKIP LOCKED, so two overlapping ticks of the 15-minute
--    job cannot both send a row.
--
-- 3. user_profile.push_prefs: one switch per category, read by the claim
--    itself so the settings screen and the sender cannot disagree. Absent key
--    = on (a new category starts on for everyone, and the column needs no
--    backfill).
-- ============================================================================

-- ── 1. devices ──────────────────────────────────────────────────────────────
alter table public.push_subscriptions
  add column if not exists kind text not null default 'web',
  add column if not exists device_token text,
  add column if not exists apns_env text;

alter table public.push_subscriptions alter column p256dh drop not null;
alter table public.push_subscriptions alter column auth drop not null;

alter table public.push_subscriptions drop constraint if exists push_subscriptions_kind_ck;
alter table public.push_subscriptions add constraint push_subscriptions_kind_ck
  check (kind in ('web', 'apns'));

alter table public.push_subscriptions drop constraint if exists push_subscriptions_env_ck;
alter table public.push_subscriptions add constraint push_subscriptions_env_ck
  check (apns_env is null or apns_env in ('production', 'sandbox'));

alter table public.push_subscriptions drop constraint if exists push_subscriptions_shape_ck;
alter table public.push_subscriptions add constraint push_subscriptions_shape_ck
  check (
    (kind = 'web' and p256dh is not null and auth is not null)
    or (kind = 'apns' and device_token ~ '^[0-9a-fA-F]{32,200}$' and endpoint = 'apns:' || device_token)
  );

-- ── 2. per-type switches ────────────────────────────────────────────────────
alter table public.user_profile
  add column if not exists push_prefs jsonb not null default '{}'::jsonb;

alter table public.user_profile drop constraint if exists user_profile_push_prefs_ck;
alter table public.user_profile add constraint user_profile_push_prefs_ck
  check (jsonb_typeof(push_prefs) = 'object');

-- Which switch governs a notification kind. NULL = never pushed (it still
-- shows in the bell). Kept to the three the product has decided to push.
create or replace function public.ct_push_category(p_kind text)
returns text
language sql
immutable
as $$
  select case p_kind
    when 'org_post' then 'club_posts'
    when 'follow' then 'follows'
    when 'request_status' then 'feature_requests'
    when 'request_comment' then 'feature_requests'
    else null
  end
$$;

-- ── 3. the claim ────────────────────────────────────────────────────────────
alter table public.notifications add column if not exists pushed_at timestamptz;

-- Everything already in the bell counts as delivered: switching this on must
-- not push a month of old notifications at once. Only rows that existed before
-- the column did are touched (a re-run finds none).
update public.notifications set pushed_at = created_at
where pushed_at is null and created_at < now() - interval '5 minutes';

create index if not exists notifications_unpushed_idx
  on public.notifications (created_at)
  where pushed_at is null;

create or replace function public.claim_bell_pushes(p_limit int default 200)
returns table (id uuid, user_id uuid, kind text, title text, body text, link text)
language sql
security definer
set search_path = public
as $$
  with picked as (
    select n.id
    from public.notifications n
    join public.user_profile p on p.user_id = n.user_id
    where n.pushed_at is null
      and n.read_at is null
      and n.created_at > now() - interval '1 day'
      and public.ct_push_category(n.kind) is not null
      and coalesce((p.push_prefs ->> public.ct_push_category(n.kind))::boolean, true)
    order by n.created_at
    limit greatest(1, least(coalesce(p_limit, 200), 500))
    for update of n skip locked
  )
  update public.notifications n
     set pushed_at = now()
    from picked
   where n.id = picked.id
  returning n.id, n.user_id, n.kind, n.title, n.body, n.link
$$;

-- The service role (the cron job) only: a signed-in student must not be able
-- to mark their own, let alone anyone else's, notifications as pushed.
revoke all on function public.claim_bell_pushes(int) from public, anon, authenticated;
grant execute on function public.claim_bell_pushes(int) to service_role;

-- Setting your own switches goes through a function rather than a raw update,
-- so a bad key cannot land in the column and the client need not know the
-- column's shape.
create or replace function public.set_push_pref(p_category text, p_on boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefs jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if p_category not in ('club_posts', 'follows', 'feature_requests') then
    raise exception 'Unknown notification type.' using errcode = '22023';
  end if;
  update public.user_profile
     set push_prefs = coalesce(push_prefs, '{}'::jsonb) || jsonb_build_object(p_category, coalesce(p_on, true))
   where user_id = auth.uid()
  returning push_prefs into v_prefs;
  return coalesce(v_prefs, '{}'::jsonb);
end;
$$;

revoke all on function public.set_push_pref(text, boolean) from public, anon;
grant execute on function public.set_push_pref(text, boolean) to authenticated;

-- ── 4. registering an iPhone ────────────────────────────────────────────────
-- A device token belongs to the PHONE, not to an account. When someone signs
-- out and a friend signs in on the same phone, the token has to move to the
-- friend, and a plain upsert cannot do that: the old row is the other
-- person's, and RLS rightly refuses to let the new account touch it. So
-- registering goes through this function, which moves the row to the caller.
-- Possessing the token (it is handed to the app by iOS, and never shown) is
-- what entitles a phone to claim it.
create or replace function public.register_apns_device(p_token text, p_user_agent text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if p_token is null or p_token !~ '^[0-9a-fA-F]{32,200}$' then
    raise exception 'That is not a device token.' using errcode = '22023';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, kind, device_token, user_agent)
  values (auth.uid(), 'apns:' || p_token, 'apns', p_token, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        kind = 'apns',
        device_token = excluded.device_token,
        user_agent = excluded.user_agent,
        created_at = now();
end;
$$;

-- Signing out stops this phone receiving the account's notifications. Only
-- the caller's own row is touched.
create or replace function public.unregister_apns_device(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.push_subscriptions
  where user_id = auth.uid() and endpoint = 'apns:' || p_token
$$;

revoke all on function public.register_apns_device(text, text) from public, anon;
revoke all on function public.unregister_apns_device(text) from public, anon;
grant execute on function public.register_apns_device(text, text) to authenticated;
grant execute on function public.unregister_apns_device(text) to authenticated;
