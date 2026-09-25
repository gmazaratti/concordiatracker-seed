-- Settings → Devices: every place you are signed in, the ones you were, and a
-- way to end any of them.
--
-- LIVE SESSIONS ARE SUPABASE'S OWN (`auth.sessions`, which already records the
-- user agent and IP). What it does NOT keep is anything after sign-out: the
-- row is deleted. So "previously connected devices" needs a copy, and
-- `user_device_history` is that copy, refreshed whenever the app loads or the
-- Devices tab is opened, and pruned after 90 days. It holds what Supabase
-- already held (user agent, IP, times), for the account holder's own eyes.
--
-- ENDING A SESSION deletes it from `auth.sessions`, which kills its refresh
-- token. The kicked device's current access token still verifies until it
-- expires (at most an hour), but the app checks the session with the server
-- on every load and signs out when it is gone, so in practice it ends the next
-- time that device opens the app.
--
-- Every function is SECURITY DEFINER and scoped to auth.uid(): nobody can see
-- or end another person's session. Idempotent; safe to re-run.

create table if not exists public.user_device_history (
  session_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  user_agent text,
  ip inet,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  ended_at timestamptz
);
create index if not exists user_device_history_user_idx on public.user_device_history (user_id, last_seen desc);

alter table public.user_device_history enable row level security;
drop policy if exists device_history_read_own on public.user_device_history;
create policy device_history_read_own on public.user_device_history
  for select to authenticated using (user_id = auth.uid());
-- No insert/update/delete policies: only the functions below write it.

-- Copy the caller's live sessions into the history, close out the ones that
-- are gone, and forget anything older than 90 days.
create or replace function public.ct_snapshot_devices()
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  me uuid := auth.uid();
begin
  if me is null then return; end if;
  insert into public.user_device_history as h (session_id, user_id, user_agent, ip, first_seen, last_seen)
  select s.id, s.user_id, s.user_agent, s.ip, s.created_at,
         greatest(s.created_at, coalesce(s.refreshed_at::timestamptz, s.updated_at, s.created_at))
  from auth.sessions s
  where s.user_id = me
  on conflict (session_id) do update
    set last_seen = greatest(h.last_seen, excluded.last_seen),
        user_agent = coalesce(excluded.user_agent, h.user_agent),
        ip = coalesce(excluded.ip, h.ip),
        ended_at = null;
  update public.user_device_history h set ended_at = now()
  where h.user_id = me and h.ended_at is null
    and not exists (select 1 from auth.sessions s where s.id = h.session_id);
  delete from public.user_device_history
  where user_id = me and last_seen < now() - interval '90 days';
end $$;

-- Called once per app load, so sessions are recorded even if the Devices tab
-- is never opened.
create or replace function public.touch_devices()
returns void language sql security definer set search_path = public as $$
  select public.ct_snapshot_devices();
$$;

create or replace function public.my_devices()
returns table (
  session_id uuid,
  user_agent text,
  ip text,
  first_seen timestamptz,
  last_active timestamptz,
  is_current boolean,
  is_active boolean
)
language plpgsql security definer set search_path = public, auth as $$
declare
  me uuid := auth.uid();
  cur uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
begin
  if me is null then return; end if;
  perform public.ct_snapshot_devices();
  return query
    select h.session_id, h.user_agent, host(h.ip), h.first_seen, h.last_seen,
           h.session_id = cur, h.ended_at is null
    from public.user_device_history h
    where h.user_id = me
    order by (h.session_id = cur) desc, (h.ended_at is null) desc, h.last_seen desc
    limit 40;
end $$;

-- End one session. Returns whether anything was ended.
create or replace function public.revoke_session(p_session uuid)
returns boolean language plpgsql security definer set search_path = public, auth as $$
declare
  n int;
begin
  if auth.uid() is null then return false; end if;
  delete from auth.sessions where id = p_session and user_id = auth.uid();
  get diagnostics n = row_count;
  update public.user_device_history set ended_at = now()
  where session_id = p_session and user_id = auth.uid() and ended_at is null;
  return n > 0;
end $$;

revoke all on function public.ct_snapshot_devices() from public, anon;
grant execute on function public.touch_devices() to authenticated;
grant execute on function public.my_devices() to authenticated;
grant execute on function public.revoke_session(uuid) to authenticated;
