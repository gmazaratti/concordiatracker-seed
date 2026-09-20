-- ============================================================================
-- Calendar sync — a private, subscribable feed of your deadlines.
-- RUN IN: Supabase SQL Editor. Safe to re-run.
--
-- WHY A FEED AND NOT THE GOOGLE CALENDAR API.
--   Apple has no public Calendar API at all; the only programmatic route is
--   CalDAV with an app-specific password, which means asking a student for a
--   credential. That is not a thing this product will ever do.
--   Google does have an API, but it needs an OAuth app, a sensitive-scope
--   verification, and a token to refresh per user -- for the privilege of
--   writing events INTO their calendar, where our copy immediately starts
--   drifting from ours the moment a date moves.
--   A subscribed iCalendar URL is what Google, Apple, Outlook and every other
--   calendar already speak. ONE implementation covers all of them, there is no
--   OAuth, nothing to refresh, and it cannot drift because their calendar is
--   re-reading ours rather than holding a copy.
--
-- THE URL IS A CAPABILITY. Anyone holding it can read that student's deadlines
-- without signing in -- that is precisely what makes it work in Google, which
-- fetches it from Google's servers with no session of ours. So:
--   * the token is 256 bits, minted here, never derived from the user id
--   * it can be rotated, which instantly kills every copy of the old link
--   * the row is select-own and has NO insert/update/delete policy; every
--     change goes through the functions below
-- Unlike the Moodle link, the owner CAN read this one back: it is ours to
-- give, and they have to paste it into Google.
-- ============================================================================

create table if not exists public.calendar_feeds (
  user_id             uuid primary key references auth.users (id) on delete cascade,
  token               text not null unique,
  -- Which layers ride the feed. Defaults are the two that are unambiguously
  -- the student's own work; the registrar's calendar is public and belongs to
  -- a different decision.
  include_assessments boolean not null default true,
  include_tasks       boolean not null default true,
  created_at          timestamptz not null default now(),
  rotated_at          timestamptz,
  -- Proof of life. "Google says it subscribed but nothing shows up" is the
  -- support ticket this feature will generate, and the only way to answer it
  -- is to know whether Google has ever actually fetched the URL.
  last_fetched_at     timestamptz,
  last_fetch_agent    text,
  fetch_count         integer not null default 0
);

alter table public.calendar_feeds enable row level security;

drop policy if exists calendar_feeds_select_own on public.calendar_feeds;
create policy calendar_feeds_select_own on public.calendar_feeds
  for select using (auth.uid() = user_id);
-- Deliberately no insert/update/delete policy: see the header.

-- A 64-character hex token from two v4 UUIDs. Built this way rather than from
-- pgcrypto's gen_random_bytes so the migration has no extension dependency --
-- two UUIDs carry 244 random bits, which is far past anything guessable.
create or replace function public.ct_new_feed_token()
returns text language sql volatile as $$
  select replace(gen_random_uuid()::text, '-', '') ||
         replace(gen_random_uuid()::text, '-', '');
$$;

-- ── Read ─────────────────────────────────────────────────────────────────────
-- Returns zero rows when there is no feed, rather than a row of nulls: "not set
-- up" and "set up and empty" are different answers and the UI shows different
-- screens for them.
create or replace function public.my_calendar_feed()
returns table (
  token text, include_assessments boolean, include_tasks boolean,
  created_at timestamptz, last_fetched_at timestamptz,
  last_fetch_agent text, fetch_count integer
)
language sql security definer set search_path = public stable as $$
  select f.token, f.include_assessments, f.include_tasks,
         f.created_at, f.last_fetched_at, f.last_fetch_agent, f.fetch_count
    from public.calendar_feeds f
   where f.user_id = auth.uid();
$$;
grant execute on function public.my_calendar_feed() to authenticated;

-- ── Write ────────────────────────────────────────────────────────────────────
-- Idempotent: calling it twice hands back the same URL rather than quietly
-- invalidating a link the student already pasted into Google.
create or replace function public.enable_calendar_feed()
returns text
language plpgsql security definer set search_path = public as $$
declare v_token text;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;

  select f.token into v_token from public.calendar_feeds f where f.user_id = auth.uid();
  if v_token is not null then return v_token; end if;

  v_token := public.ct_new_feed_token();
  insert into public.calendar_feeds (user_id, token) values (auth.uid(), v_token);
  return v_token;
end $$;
grant execute on function public.enable_calendar_feed() to authenticated;

-- Rotating is the revoke button. Every copy of the old link -- in Google, in a
-- screenshot, in a message someone forwarded -- stops resolving immediately,
-- which is the whole reason it exists and is why the UI says so plainly.
create or replace function public.rotate_calendar_feed()
returns text
language plpgsql security definer set search_path = public as $$
declare v_token text := public.ct_new_feed_token();
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  update public.calendar_feeds f
     set token = v_token, rotated_at = now(), last_fetched_at = null, fetch_count = 0
   where f.user_id = auth.uid();
  if not found then raise exception 'You do not have a calendar feed yet.'; end if;
  return v_token;
end $$;
grant execute on function public.rotate_calendar_feed() to authenticated;

create or replace function public.disable_calendar_feed()
returns void
language sql security definer set search_path = public as $$
  delete from public.calendar_feeds f where f.user_id = auth.uid();
$$;
grant execute on function public.disable_calendar_feed() to authenticated;

create or replace function public.set_calendar_feed_layers(
  p_assessments boolean, p_tasks boolean
)
returns void
language sql security definer set search_path = public as $$
  update public.calendar_feeds f
     set include_assessments = coalesce(p_assessments, f.include_assessments),
         include_tasks       = coalesce(p_tasks, f.include_tasks)
   where f.user_id = auth.uid();
$$;
grant execute on function public.set_calendar_feed_layers(boolean, boolean) to authenticated;

-- ── Proof of life ────────────────────────────────────────────────────────────
-- Called by the feed endpoint with the SERVICE ROLE only; execute is revoked
-- from everybody else, because a counter anyone can bump is not evidence.
--
-- This exists for one support question: "I subscribed and nothing shows up."
-- Without it the answer is a shrug. With it the panel can say "Google last
-- read this 3 hours ago", which separates "the link is wrong" from "Google
-- has it and has not refreshed yet" -- two problems with opposite fixes.
create or replace function public.ct_touch_calendar_feed(p_token text, p_agent text default null)
returns void
language sql security definer set search_path = public as $$
  update public.calendar_feeds f
     set last_fetched_at = now(),
         last_fetch_agent = left(coalesce(p_agent, ''), 120),
         fetch_count = f.fetch_count + 1
   where f.token = p_token;
$$;
revoke all on function public.ct_touch_calendar_feed(text, text) from public, anon, authenticated;

-- The feed endpoint looks the row up by token with the service role, so no
-- grant is needed for that path. This index is what makes it a point lookup.
create unique index if not exists calendar_feeds_token_uidx on public.calendar_feeds (token);

-- Check:
--   select public.enable_calendar_feed();
--   select * from public.my_calendar_feed();
