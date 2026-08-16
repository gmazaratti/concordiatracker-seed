-- ============================================================================
-- Seat watching — get pushed when a full class opens up.
-- RUN IN: Supabase → SQL Editor → paste → Run. Safe to re-run.
--
-- Data comes from Concordia's Open Data API (opendata.concordia.ca), which
-- exposes enrollmentCapacity / currentEnrollment / waitlistCapacity /
-- currentWaitlistTotal per section. Sanctioned and keyed — no scraping, no
-- student credentials, nothing that breaks when their HTML changes.
--
-- The API key lives ONLY on the server (CONCORDIA_API_USER / CONCORDIA_API_KEY
-- in Vercel, no VITE_ prefix). The client never talks to Concordia directly.
-- ============================================================================

create table if not exists public.seat_watches (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,

  -- Concordia's identifiers. class_number + term_code is the unique section.
  class_number  text not null,
  term_code     text not null,
  subject       text not null,          -- "COMP"  — for display and re-query
  catalog       text not null,          -- "248"
  section       text not null,          -- "U" / "BB"
  course_title  text,

  -- Last observed state, so the poller can detect a TRANSITION rather than
  -- re-notifying every tick while a seat sits open.
  last_enrollment       int,
  last_capacity         int,
  last_waitlist_total   int,
  last_waitlist_cap     int,
  /** True when Concordia flags some seats as reserved for specific programs —
   * "a seat opened" is then not necessarily "a seat you can take", and the UI
   * says so rather than sending someone to a seat they can't have. */
  has_reserved  boolean not null default false,

  notified_at   timestamptz,
  checked_at    timestamptz,
  created_at    timestamptz not null default now(),

  unique (user_id, class_number, term_code)
);

create index if not exists seat_watches_user_idx on public.seat_watches (user_id);
-- The poller scans by section so many watchers of one class cost one API call.
create index if not exists seat_watches_section_idx on public.seat_watches (term_code, class_number);

alter table public.seat_watches enable row level security;

-- Read and delete your own. No INSERT policy: adding a watch goes through
-- add_seat_watch(), which enforces the free-tier limit server-side. A client
-- insert could otherwise ignore the cap entirely.
drop policy if exists "seat_watch_select" on public.seat_watches;
create policy "seat_watch_select" on public.seat_watches
  for select using (auth.uid() = user_id);

drop policy if exists "seat_watch_delete" on public.seat_watches;
create policy "seat_watch_delete" on public.seat_watches
  for delete using (auth.uid() = user_id);

grant select, delete on public.seat_watches to authenticated;

-- ── Limits ───────────────────────────────────────────────────────────────────
-- Free watches one class; Pro watches as many as you like. Coursicle's proven
-- line (2M students), and it maps to how the pain actually works: everyone has
-- one class they desperately need, and a full course load is a Pro problem.
create or replace function public.seat_watch_limit()
returns int language sql security definer set search_path = public stable as $$
  select case
    when exists (
      select 1 from public.user_profile p
       where p.user_id = auth.uid() and p.plan_status = 'pro'
    ) then 25   -- a sane ceiling even on Pro, so one account can't hammer the API
    else 1
  end;
$$;
grant execute on function public.seat_watch_limit() to authenticated;

create or replace function public.add_seat_watch(
  p_class_number text,
  p_term_code    text,
  p_subject      text,
  p_catalog      text,
  p_section      text,
  p_course_title text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_count int; v_limit int;
begin
  if auth.uid() is null then raise exception 'Sign in to watch a class.'; end if;

  -- Re-watching something you already watch is a no-op, not an error.
  select id into v_id from public.seat_watches
   where user_id = auth.uid() and class_number = p_class_number and term_code = p_term_code;
  if v_id is not null then return v_id; end if;

  select count(*) into v_count from public.seat_watches where user_id = auth.uid();
  select public.seat_watch_limit() into v_limit;
  if v_count >= v_limit then
    raise exception 'You can watch % class(es) on your plan.', v_limit;
  end if;

  insert into public.seat_watches
    (user_id, class_number, term_code, subject, catalog, section, course_title)
  values
    (auth.uid(), p_class_number, p_term_code, p_subject, p_catalog, p_section, p_course_title)
  returning id into v_id;
  return v_id;
end $$;
grant execute on function public.add_seat_watch(text, text, text, text, text, text) to authenticated;

create or replace function public.my_seat_watches()
returns table (
  id uuid, class_number text, term_code text, subject text, catalog text,
  section text, course_title text, last_enrollment int, last_capacity int,
  last_waitlist_total int, last_waitlist_cap int, has_reserved boolean,
  checked_at timestamptz, notified_at timestamptz
)
language sql security definer set search_path = public stable as $$
  select w.id, w.class_number, w.term_code, w.subject, w.catalog, w.section,
         w.course_title, w.last_enrollment, w.last_capacity,
         w.last_waitlist_total, w.last_waitlist_cap, w.has_reserved,
         w.checked_at, w.notified_at
  from public.seat_watches w
  where w.user_id = auth.uid()
  order by w.created_at desc;
$$;
grant execute on function public.my_seat_watches() to authenticated;

-- ── Poller support (service role only) ───────────────────────────────────────
-- The distinct sections anyone is watching, so one API call serves every
-- watcher of that class rather than one call per user.
create or replace function public.seat_watch_sections()
returns table (term_code text, subject text, catalog text)
language sql security definer set search_path = public stable as $$
  select distinct w.term_code, w.subject, w.catalog from public.seat_watches w;
$$;
revoke all on function public.seat_watch_sections() from public, anon, authenticated;

/**
 * Record what the API returned for one section and return the watchers who
 * should be notified.
 *
 * A watcher is notified only on a FULL → OPEN transition, so a seat that sits
 * open for an hour produces one push rather than one per poll. The very first
 * observation never notifies: `last_capacity is null` means we have no idea
 * whether it just opened or has been open all along, and guessing would send a
 * burst of false alarms the moment this feature ships.
 */
create or replace function public.record_seat_state(
  p_term_code       text,
  p_class_number    text,
  p_enrollment      int,
  p_capacity        int,
  p_waitlist_total  int,
  p_waitlist_cap    int,
  p_has_reserved    boolean
)
returns table (user_id uuid, subject text, catalog text, section text, course_title text)
language plpgsql security definer set search_path = public as $$
begin
  return query
  update public.seat_watches w
     set last_enrollment     = p_enrollment,
         last_capacity       = p_capacity,
         last_waitlist_total = p_waitlist_total,
         last_waitlist_cap   = p_waitlist_cap,
         has_reserved        = coalesce(p_has_reserved, false),
         checked_at          = now(),
         notified_at         = case
           when w.last_capacity is not null
            and w.last_enrollment >= w.last_capacity   -- was full
            and p_enrollment < p_capacity              -- is now open
           then now() else w.notified_at end
   where w.term_code = p_term_code
     and w.class_number = p_class_number
  returning
    w.user_id, w.subject, w.catalog, w.section, w.course_title;
end $$;
revoke all on function public.record_seat_state(text, text, int, int, int, int, boolean)
  from public, anon, authenticated;

/** Watchers whose section just flipped open and haven't been pushed yet. */
create or replace function public.pending_seat_alerts()
returns table (
  id uuid, user_id uuid, subject text, catalog text, section text,
  course_title text, last_enrollment int, last_capacity int, has_reserved boolean
)
language sql security definer set search_path = public stable as $$
  select w.id, w.user_id, w.subject, w.catalog, w.section, w.course_title,
         w.last_enrollment, w.last_capacity, w.has_reserved
  from public.seat_watches w
  where w.notified_at is not null
    and w.notified_at > now() - interval '10 minutes'
    and w.last_enrollment < w.last_capacity;
$$;
revoke all on function public.pending_seat_alerts() from public, anon, authenticated;
