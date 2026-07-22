-- ── Admin dashboard stats ────────────────────────────────────────────────────
-- One admin-gated rollup of at-a-glance counts for the console Overview.
-- RUN in the Supabase SQL editor. Safe to re-run.

create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  select jsonb_build_object(
    'total_users',          (select count(*) from public.user_profile),
    'new_users_7d',         (select count(*) from public.user_profile where created_at > now() - interval '7 days'),
    'new_users_30d',        (select count(*) from public.user_profile where created_at > now() - interval '30 days'),
    'pro_users',            (select count(*) from public.user_profile
                              where plan_status = 'pro' or (pro_until is not null and pro_until > now())),
    'total_courses',        (select count(*) from public.courses),
    'total_assignments',    (select count(*) from public.assignments where coalesce(deleted, false) = false),
    'total_orgs',           (select count(*) from public.organizations),
    'pending_orgs',         (select count(*) from public.organizations where status = 'pending'),
    'total_events',         (select count(*) from public.events),
    'total_teachers',       (select count(*) from public.teacher_accounts),
    'pending_applications', (select count(*) from public.access_requests where status = 'pending'),
    'survey_responses',     (select count(*) from public.survey_response),
    'feature_requests',     (select count(*) from public.feature_requests),
    'open_bugs',            (select count(*) from public.bug_reports),
    -- "site activity in the last 7 days" — a rough pulse across the write surfaces.
    'activity_7d',
      (select count(*) from public.org_activity  where created_at > now() - interval '7 days')
      + (select count(*) from public.announcements where posted_at  > now() - interval '7 days')
      + (select count(*) from public.events        where posted_at  > now() - interval '7 days')
      + (select count(*) from public.feature_requests where created_at > now() - interval '7 days')
  ) into r;
  return r;
end $$;
grant execute on function public.admin_dashboard_stats() to authenticated;
