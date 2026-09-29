-- ============================================================================
-- Admin alerts: support tickets and syllabus scans join signups and orgs, and
-- each admin chooses which ones reach their phone.
--
-- The digest cron (/api/run-reminders, ~15 min) already sent one push per new
-- signup and per pending organisation, plus one summary for feedback and
-- access requests. This adds:
--   * a push per NEW SUPPORT TICKET (a customer waiting is the most urgent
--     thing this inbox has),
--   * a push per FAILED SCAN (a student just hit a wall; the file is kept for
--     a retry in Admin -> Parses),
--   * successful scans (one each, or a summary when there are several).
--
-- PREFERENCES: `admins.alert_prefs` is a map of key -> boolean. A MISSING KEY
-- MEANS ON, so every alert is on by default and a new kind added later is on
-- for everybody without a backfill. The filter is applied HERE, not in the
-- endpoint, so the API that also exposes this digest cannot disagree with it.
--
-- STAMPING: every admin's clock now advances on every run, whatever was sent.
-- It used to advance only when something was sent, which with preferences
-- would mean an admin who switched a kind off and back on a month later got a
-- month of old alerts at once.
--
-- Internal accounts (staff, probes, the review account) never alert, the same
-- rule the signup alert and every dashboard number already follow.
-- Re-run safe.
-- ============================================================================

alter table public.admins
  add column if not exists alert_prefs jsonb not null default '{}'::jsonb;

create or replace function public.ct_admin_alert_keys()
returns text[] language sql immutable as $$
  select array['signups','orgs','requests','tickets','scan_failures','scans','feedback']
$$;

create or replace function public.ct_alert_on(p_prefs jsonb, p_key text)
returns boolean language sql immutable as $$
  select coalesce((p_prefs ->> p_key)::boolean, true)
$$;

-- The caller's own preferences, with every key present (missing = on).
create or replace function public.my_admin_alert_prefs()
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare v jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;
  select coalesce(a.alert_prefs, '{}'::jsonb) into v from public.admins a where a.user_id = auth.uid();
  return (
    select jsonb_object_agg(k, public.ct_alert_on(coalesce(v, '{}'::jsonb), k))
      from unnest(public.ct_admin_alert_keys()) as k
  );
end $$;

create or replace function public.set_admin_alert_pref(p_key text, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;
  if not (p_key = any(public.ct_admin_alert_keys())) then
    raise exception 'Unknown alert %', p_key using errcode = '22023';
  end if;
  update public.admins
     set alert_prefs = coalesce(alert_prefs, '{}'::jsonb) || jsonb_build_object(p_key, coalesce(p_on, true))
   where user_id = auth.uid();
end $$;

revoke all on function public.my_admin_alert_prefs() from public, anon;
revoke all on function public.set_admin_alert_pref(text, boolean) from public, anon;
grant execute on function public.my_admin_alert_prefs() to authenticated;
grant execute on function public.set_admin_alert_pref(text, boolean) to authenticated;

-- A return type cannot be widened by `create or replace`.
drop function if exists public.admin_activity_digests();

create or replace function public.admin_activity_digests()
returns table (
  user_id uuid,
  features int,
  bugs int,
  applications int,
  new_users jsonb,
  new_orgs jsonb,
  new_tickets jsonb,
  new_scans jsonb
)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with computed as (
    select adm.user_id,
           coalesce(adm.activity_pushed_at, 'epoch'::timestamptz) as since,
           coalesce(adm.alert_prefs, '{}'::jsonb) as prefs
      from public.admins adm
  ),
  data as (
    select c.user_id,
      case when public.ct_alert_on(c.prefs, 'feedback') then
        (select count(*) from public.feature_requests fr
          where fr.hidden = false and fr.created_at > c.since) else 0 end as features,
      case when public.ct_alert_on(c.prefs, 'feedback') then
        (select count(*) from public.bug_reports br
          where br.created_at > c.since) else 0 end as bugs,
      case when public.ct_alert_on(c.prefs, 'requests') then
        ((select count(*) from public.access_requests ar
            where ar.status = 'pending' and ar.created_at > c.since)
         + (select count(*) from public.teacher_accounts tc
            where tc.status = 'pending' and tc.created_at > c.since)) else 0 end as applications,
      case when public.ct_alert_on(c.prefs, 'signups') then
        (select coalesce(jsonb_agg(jsonb_build_object(
            'name',  coalesce(up.name, up.email, 'New user'),
            'email', coalesce(up.email, '')
          ) order by up.created_at), '[]'::jsonb)
          from public.user_profile up
         where up.user_id <> c.user_id and up.created_at > c.since
           and coalesce(up.is_internal, false) = false)
      else '[]'::jsonb end as new_users,
      case when public.ct_alert_on(c.prefs, 'orgs') then
        (select coalesce(jsonb_agg(jsonb_build_object(
            'name', o.name, 'handle', o.handle
          ) order by o.created_at), '[]'::jsonb)
          from public.organizations o
         where o.status = 'pending' and o.created_at > c.since)
      else '[]'::jsonb end as new_orgs,
      case when public.ct_alert_on(c.prefs, 'tickets') then
        (select coalesce(jsonb_agg(jsonb_build_object(
            'case_id', t.case_id,
            'subject', t.subject,
            'who',     coalesce(nullif(t.name, ''), t.email, 'Someone')
          ) order by t.created_at), '[]'::jsonb)
          from public.tickets t
          left join public.user_profile p on p.user_id = t.user_id
         where t.created_at > c.since
           and coalesce(p.is_internal, false) = false
           and t.user_id is distinct from c.user_id)
      else '[]'::jsonb end as new_tickets,
      -- Scans are reported once they FINISH: one started a moment ago has no
      -- outcome yet, and alerting on the start would say nothing useful.
      (select coalesce(jsonb_agg(jsonb_build_object(
            'ok',     e.success,
            'file',   coalesce(e.file_name, 'a syllabus'),
            'course', e.course_code,
            'items',  e.items,
            'error',  left(coalesce(e.error, ''), 140),
            'who',    coalesce(p.name, p.email, 'A student')
          ) order by e.finished_at), '[]'::jsonb)
         from public.parse_events e
         left join public.user_profile p on p.user_id = e.user_id
        where e.finished_at > c.since
          and e.success is not null
          and coalesce(p.is_internal, false) = false
          and ((e.success and public.ct_alert_on(c.prefs, 'scans'))
            or (not e.success and public.ct_alert_on(c.prefs, 'scan_failures')))
      ) as new_scans
    from computed c
  ),
  stamped as (
    update public.admins adm set activity_pushed_at = now()
      from data d
     where adm.user_id = d.user_id
    returning adm.user_id
  )
  select d.user_id, d.features::int, d.bugs::int, d.applications::int,
         d.new_users, d.new_orgs, d.new_tickets, d.new_scans
    from data d
   where (d.features + d.bugs + d.applications
          + jsonb_array_length(d.new_users) + jsonb_array_length(d.new_orgs)
          + jsonb_array_length(d.new_tickets) + jsonb_array_length(d.new_scans)) > 0;
end; $$;

revoke all on function public.admin_activity_digests() from public, anon, authenticated;
grant execute on function public.admin_activity_digests() to service_role;
