-- Which features has this person used? (2026-11-10)
--
-- Feeds the discovery engine (src/lib/discovery.ts): the Today card and the
-- occasional popup only ever point at something the student has NOT used, and
-- stop mentioning it the day they do. Measured from the data itself, not from
-- page views, because opening a page is not using a feature.
--
-- Only the caller's own facts, as booleans and one count. Courses, grades and
-- past courses are not here: the app already has those loaded.

create or replace function public.my_feature_usage()
returns jsonb
language sql
security definer
set search_path to 'public'
stable
as $$
  select jsonb_build_object(
    'account_days', (select floor(extract(epoch from now() - u.created_at) / 86400)::int from auth.users u where u.id = auth.uid()),
    'schedule',      exists (select 1 from public.saved_schedules s where s.user_id = auth.uid()),
    'seat_watch',    exists (select 1 from public.seat_watches s where s.user_id = auth.uid()),
    'calendar_sync', exists (select 1 from public.calendar_feeds s where s.user_id = auth.uid()),
    'moodle',        exists (select 1 from public.moodle_connections s where s.user_id = auth.uid()),
    'notes',         exists (select 1 from public.notes s where s.user_id = auth.uid()),
    'clubs',         exists (select 1 from public.org_follows s where s.user_id = auth.uid()),
    'family',        exists (select 1 from public.guardian_links s where s.student = auth.uid() and s.status <> 'revoked'),
    'programme',     exists (select 1 from public.user_profile p where p.user_id = auth.uid() and p.major_id is not null),
    'scanned',       exists (select 1 from public.parse_events e where e.user_id = auth.uid() and e.success)
  )
$$;

revoke all on function public.my_feature_usage() from public, anon;
grant execute on function public.my_feature_usage() to authenticated;
