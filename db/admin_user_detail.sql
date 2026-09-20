-- ============================================================================
-- What one user's activity looks like, for the admin pop-out.
-- RUN IN: Supabase SQL Editor. Safe to re-run.
--
-- Derived from `site_events`, which already records session_id, visitor_id,
-- path, referrer_host, utm_*, device and a `ping` heartbeat. No new tracking
-- is added here and none is needed.
--
-- HOW A "VISIT" IS DEFINED: one `session_id`. Its duration is the gap between
-- the first and last event in it, which the heartbeat makes a fair estimate of
-- dwell time. A session with a single event has NO measurable duration -- it
-- is reported as zero and counted separately, rather than being quietly
-- averaged in as a real zero-second visit and dragging the mean down.
-- ============================================================================

-- ── Per-visit ────────────────────────────────────────────────────────────────
create or replace function public.admin_user_visits(p_user uuid, p_limit int default 50)
returns table (
  session_id   text,
  started_at   timestamptz,
  ended_at     timestamptz,
  seconds      int,
  events       int,
  device       text,
  -- Where they came FROM. The referrer if a browser sent one, else the utm
  -- tag if the link carried one, else genuinely direct.
  source       text,
  first_path   text
)
language sql security definer set search_path = public stable as $$
  select
    e.session_id::text,
    min(e.created_at),
    max(e.created_at),
    greatest(0, extract(epoch from (max(e.created_at) - min(e.created_at)))::int),
    count(*)::int,
    max(e.device),
    coalesce(
      nullif(max(e.referrer_host), ''),
      nullif(max(e.utm_source), ''),
      'Direct'
    ),
    -- The page the session STARTED on, which is the useful one: it says what
    -- brought them in, where the last path only says where they stopped.
    (array_agg(e.path order by e.created_at))[1]
  from public.site_events e
  where public.is_admin() and e.user_id = p_user and e.session_id is not null
  group by e.session_id
  order by min(e.created_at) desc
  limit greatest(1, least(coalesce(p_limit, 50), 500));
$$;
grant execute on function public.admin_user_visits(uuid, int) to authenticated;

-- ── The summary above it ─────────────────────────────────────────────────────
create or replace function public.admin_user_summary(p_user uuid)
returns jsonb
language sql security definer set search_path = public stable as $$
  with v as (
    select e.session_id,
           min(e.created_at) as started,
           max(e.created_at) as ended,
           count(*)::int     as events
      from public.site_events e
     where e.user_id = p_user and e.session_id is not null
     group by e.session_id
  ),
  measured as (select * from v where ended > started)
  select case when not public.is_admin() then '{}'::jsonb else jsonb_build_object(
    'joined_at',      (select p.created_at from public.user_profile p where p.user_id = p_user),
    'last_visit_at',  (select max(ended) from v),
    'visits',         (select count(*)::int from v),
    -- Named rather than hidden: an average over sessions that had no second
    -- event is not an average of visit lengths, it is a number shaped like one.
    'visits_unmeasurable', (select count(*)::int from v where ended <= started),
    'total_seconds',  coalesce((select sum(extract(epoch from (ended - started)))::int from measured), 0),
    'avg_seconds',    coalesce((select avg(extract(epoch from (ended - started)))::int from measured), 0),
    'events_total',   (select coalesce(sum(events), 0)::int from v),
    'page_views',     (select count(*)::int from public.site_events e
                        where e.user_id = p_user and e.kind = 'view'),
    -- What they have actually DONE, which is the part a visit count cannot say.
    'courses',        (select count(*)::int from public.courses c
                        where c.user_id = p_user and coalesce(c.archived, false) = false),
    'assignments',    (select count(*)::int from public.assignments a
                        where a.user_id = p_user and coalesce(a.deleted, false) = false),
    'parses',         (select count(*)::int from public.parse_events pe
                        where pe.user_id = p_user and pe.success),
    'tickets',        (select count(*)::int from public.tickets t where t.user_id = p_user),
    'first_seen',     (select min(started) from v)
  ) end;
$$;
grant execute on function public.admin_user_summary(uuid) to authenticated;

-- Reading site_events by user is the hot path for both of the above.
create index if not exists site_events_user_session_idx
  on public.site_events (user_id, session_id, created_at);

-- Check:
--   select * from public.admin_user_visits('<uuid>', 10);
--   select jsonb_pretty(public.admin_user_summary('<uuid>'));

-- ── The unlogged door, closed ────────────────────────────────────────────────
-- `admin_set_plan(uuid, text, timestamptz)` from db/admin_console.sql changes
-- a plan with no record that it happened -- which is the exact hole the audit
-- log exists to close, left standing as an overload beside the logged one.
--
-- Dropped rather than deprecated. A privileged function that still works is a
-- function something will still call, and the whole value of the log is that
-- it has no gaps. The logged replacement is
-- `admin_set_plan(uuid, boolean, text, timestamptz)` in db/admin_audit.sql.
drop function if exists public.admin_set_plan(uuid, text, timestamptz);

-- ── The list needs the new flags ─────────────────────────────────────────────
-- Return type changes, so it has to be dropped first (42P13).
drop function if exists public.admin_list_users();
create or replace function public.admin_list_users()
returns table (
  user_id uuid, name text, email text, created_at timestamptz, role text,
  plan_status text, plan_expires_at timestamptz, admin_notes text,
  can_upload_blueprints boolean, vanity_code text, referred_by_code text,
  course_count bigint, assignment_count bigint, following_count bigint,
  signups_attributed bigint,
  is_internal boolean, comped boolean,
  -- Surfaced in the list so the one thing you scan for -- who is actually
  -- paying -- does not need a click per row to find out.
  stripe_customer_id text, subscription_status text, last_seen_at timestamptz
) language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return query
    select p.user_id, p.name, p.email, p.created_at, p.role,
           p.plan_status, p.plan_expires_at, p.admin_notes,
           coalesce(p.can_upload_blueprints, true), p.vanity_code, p.referred_by_code,
           (select count(*) from public.courses c where c.user_id = p.user_id),
           (select count(*) from public.assignments a where a.user_id = p.user_id and coalesce(a.deleted,false) = false),
           (select count(*) from public.org_follows f where f.user_id = p.user_id),
           (select count(*) from public.user_profile r where r.referred_by_code is not null and r.referred_by_code = p.vanity_code),
           coalesce(p.is_internal, false), coalesce(p.comped, false),
           p.stripe_customer_id, p.subscription_status,
           (select max(e.created_at) from public.site_events e where e.user_id = p.user_id)
    from public.user_profile p
    order by p.created_at desc;
end; $$;
grant execute on function public.admin_list_users() to authenticated;
