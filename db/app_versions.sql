-- App versions: the minimum and latest native build per platform.
--
-- Read by /api/app-version, which the iOS shell asks on launch:
--   installed build <  min_build     → a blocking "Please update" screen
--   installed build <  latest_build  → a dismissible banner
--   anything else, or no answer      → the app launches normally (fail open)
--
-- A DATABASE ROW, not an env var, so raising the minimum is an admin action
-- that takes effect in seconds rather than a redeploy.
--
-- OPERATIONAL RULE: min_build must stay BELOW the build on every phone that
-- should keep working. Raising it above the TestFlight / App Store build locks
-- out the founder's own phone and every tester. Raise it only once the new
-- App Store build is live. The admin RPC refuses a minimum above the latest,
-- which catches the typo; it cannot know what is actually installed.
--
-- Idempotent.

create table if not exists public.app_versions (
  platform     text primary key check (platform in ('ios')),
  min_build    integer not null default 1 check (min_build >= 1),
  latest_build integer not null default 1 check (latest_build >= 1),
  store_url    text not null,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users (id) on delete set null,
  constraint app_versions_min_le_latest check (min_build <= latest_build)
);

alter table public.app_versions enable row level security;

-- Public read: a build number and a store link are not secrets, and the
-- check has to work before anyone signs in.
drop policy if exists app_versions_read on public.app_versions;
create policy app_versions_read on public.app_versions for select using (true);
-- No insert/update/delete policies: every write goes through the RPC below.

insert into public.app_versions (platform, min_build, latest_build, store_url)
values ('ios', 1, 1, 'https://apps.apple.com/app/id6816822795')
on conflict (platform) do nothing;

create or replace function public.admin_set_app_version(
  p_platform text,
  p_min_build integer,
  p_latest_build integer
) returns public.app_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.app_versions;
begin
  -- A human admin. An agent token is an admin too, but locking every phone
  -- out is not something an unattended script should be able to do.
  if not public.ct_admin_write() then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;
  if p_min_build is null or p_latest_build is null or p_min_build < 1 or p_latest_build < 1 then
    raise exception 'Builds must be whole numbers of 1 or more.' using errcode = '22023';
  end if;
  if p_min_build > p_latest_build then
    raise exception 'The minimum cannot be above the latest build.' using errcode = '22023';
  end if;

  update public.app_versions av
     set min_build = p_min_build,
         latest_build = p_latest_build,
         updated_at = now(),
         updated_by = auth.uid()
   where av.platform = p_platform
  returning * into v_row;

  if v_row.platform is null then
    raise exception 'Unknown platform %.', p_platform using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

revoke all on function public.admin_set_app_version(text, integer, integer) from public, anon;
grant execute on function public.admin_set_app_version(text, integer, integer) to authenticated;
