-- ============================================================================
-- Seat alerts you cannot miss, and how many students track a course.
-- RUN IN: Supabase SQL Editor. Safe to re-run.
--
-- Two features in one migration because they share the same normalisation
-- helper and both read the course catalogue.
--
--   1. An acknowledged-based seat alert, so a seat that opens at 3am is still
--      in your face at 9am. The existing push path is untouched.
--   2. Aggregate counts of how many students track a course. AGGREGATE ONLY:
--      no query here can return who, and the counts are deliberately coarse.
-- ============================================================================

-- ── Shared: one way to compare course codes ────────────────────────────────
-- "COMP 248", "comp248" and "COMP-248" are the same course. Blueprints store
-- "COMP 248", the catalogue stores subject + catalog separately, and students
-- type whatever they like, so every join has to go through this.
create or replace function public.ct_norm_code(p_code text)
returns text language sql immutable as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
$$;
grant execute on function public.ct_norm_code(text) to anon, authenticated;

-- ============================================================================
-- 1. Seat alerts
-- ============================================================================

-- When the poller sees a section flip open it stamps notified_at. That drives
-- the push. This column tracks whether the STUDENT has actually seen it in the
-- app, which is a different question: a push can be missed, silenced, or fire
-- while the phone is face down.
alter table public.seat_watches
  add column if not exists alert_seen_at timestamptz;

/**
 * Record what the poller observed.
 *
 * Unchanged except for one line: a fresh open clears alert_seen_at, so a
 * section that opens, fills, and opens again alerts a second time instead of
 * staying silent because the first alert was dismissed months ago.
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
           then now() else w.notified_at end,
         alert_seen_at       = case
           when w.last_capacity is not null
            and w.last_enrollment >= w.last_capacity
            and p_enrollment < p_capacity
           then null else w.alert_seen_at end
   where w.term_code = p_term_code
     and w.class_number = p_class_number
  returning
    w.user_id, w.subject, w.catalog, w.section, w.course_title;
end $$;
revoke all on function public.record_seat_state(text, text, int, int, int, int, boolean)
  from public, anon, authenticated;

/**
 * The caller's own unacknowledged open seats.
 *
 * No time window, unlike pending_seat_alerts() which exists to send a push
 * exactly once. This one persists until the student dismisses it or the seat
 * fills again, because the whole point is that logging in tells you.
 */
create or replace function public.my_seat_alerts()
returns table (
  id uuid, class_number text, term_code text, subject text, catalog text,
  section text, course_title text, last_enrollment int, last_capacity int,
  has_reserved boolean, notified_at timestamptz
)
language sql security definer set search_path = public stable as $$
  select w.id, w.class_number, w.term_code, w.subject, w.catalog, w.section,
         w.course_title, w.last_enrollment, w.last_capacity, w.has_reserved,
         w.notified_at
  from public.seat_watches w
  where w.user_id = auth.uid()
    and w.notified_at is not null
    and (w.alert_seen_at is null or w.alert_seen_at < w.notified_at)
    -- Only while it is still actually open. An alert for a seat that refilled
    -- while you slept would send someone to a full section.
    and w.last_capacity is not null
    and w.last_enrollment < w.last_capacity
  order by w.notified_at desc;
$$;
grant execute on function public.my_seat_alerts() to authenticated;

/** Dismiss one alert. Ownership is enforced here, not trusted from the client. */
create or replace function public.ack_seat_alert(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.seat_watches
     set alert_seen_at = now()
   where id = p_id and user_id = auth.uid();
$$;
grant execute on function public.ack_seat_alert(uuid) to authenticated;

/** Dismiss everything currently alerting. */
create or replace function public.ack_seat_alerts()
returns void language sql security definer set search_path = public as $$
  update public.seat_watches
     set alert_seen_at = now()
   where user_id = auth.uid() and notified_at is not null;
$$;
grant execute on function public.ack_seat_alerts() to authenticated;

-- ============================================================================
-- 2. How many students track a course
-- ============================================================================

/**
 * Aggregate interest in one course code.
 *
 * SECURITY DEFINER because public.courses is select-own: without it a student
 * could only ever count themselves. It returns two integers and nothing else —
 * there is no argument that widens it to identities, and no version of this
 * function should ever return a user_id.
 *
 * Counts are per COURSE CODE, not per section, which also keeps them coarse
 * enough that "3 students" never singles anyone out.
 */
create or replace function public.course_tracking(p_code text)
returns table (tracked_by int, watching int)
language sql security definer set search_path = public stable as $$
  select
    (select count(distinct c.user_id)::int
       from public.courses c
      where public.ct_norm_code(c.code) = public.ct_norm_code(p_code)),
    (select count(distinct w.user_id)::int
       from public.seat_watches w
      where public.ct_norm_code(w.subject || w.catalog) = public.ct_norm_code(p_code));
$$;
grant execute on function public.course_tracking(text) to authenticated;

/**
 * Catalogue search, annotated with what we know about each course.
 *
 * This is what lets the add-course picker offer every course Concordia
 * publishes while still making the ones with a ready-made outline obviously
 * better. Previously the picker could only show courses that already had a
 * blueprint, which meant most of the calendar was invisible and students typed
 * their course name by hand and mistyped it.
 */
create or replace function public.search_courses_enriched(p_q text, p_limit int default 40)
returns table (
  id text, subject text, catalog text, title text,
  career text, class_unit numeric, prerequisites text,
  blueprint_count int, has_verified boolean, tracked_by int
)
language sql security definer set search_path = public stable as $$
  with q as (select upper(trim(coalesce(p_q, ''))) as term),
  hits as (
    select c.*
    from public.course_catalog c, q
    where q.term <> ''
      and (
        (c.subject || ' ' || c.catalog) ilike '%' || q.term || '%'
        or (c.subject || c.catalog) ilike '%' || replace(q.term, ' ', '') || '%'
        or c.title ilike '%' || q.term || '%'
      )
    order by
      ((c.subject || ' ' || c.catalog) = (select term from q)) desc,
      ((c.subject || ' ' || c.catalog) ilike (select term from q) || '%') desc,
      c.subject, c.catalog
    limit greatest(1, least(coalesce(p_limit, 40), 100))
  )
  select
    h.id, h.subject, h.catalog, h.title, h.career, h.class_unit, h.prerequisites,
    coalesce(b.n, 0)::int,
    coalesce(b.verified, false),
    coalesce(t.n, 0)::int
  from hits h
  left join lateral (
    select count(*)::int as n, bool_or(sb.verified) as verified
    from public.shared_blueprints sb
    where public.ct_norm_code(sb.course_code) = public.ct_norm_code(h.subject || h.catalog)
  ) b on true
  left join lateral (
    select count(distinct uc.user_id)::int as n
    from public.courses uc
    where public.ct_norm_code(uc.code) = public.ct_norm_code(h.subject || h.catalog)
  ) t on true;
$$;
grant execute on function public.search_courses_enriched(text, int) to anon, authenticated;

-- Both lateral joins normalise the stored code, so an index on the raw column
-- would not be used. These make the annotation cheap at catalogue scale.
create index if not exists shared_blueprints_norm_code_idx
  on public.shared_blueprints (public.ct_norm_code(course_code));
create index if not exists courses_norm_code_idx
  on public.courses (public.ct_norm_code(code));
