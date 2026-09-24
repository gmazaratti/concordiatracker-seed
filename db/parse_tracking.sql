-- ─────────────────────────────────────────────────────────────────────────────
-- Syllabus parses: an honest status, enough detail to diagnose one, and a way
-- to retry a failure.
--
-- THE BUG THIS FIXES. `parse_events.success` defaulted to FALSE, so a parse
-- was recorded as failed from the moment it started. Between 2026-09-18 and
-- the fix on 2026-09-24 nothing marked the successes, and the admin feed
-- printed "Syllabus parsed · Failed" for parses that had put a whole course
-- on the student's list (Juliette Zacharkevics' SOCI 262, seven assessments,
-- is the one that was reported). A default that asserts an outcome is a lie
-- waiting for the code that corrects it to be forgotten.
--
-- NOW: success is NULL while the parse runs. TRUE and FALSE are only written
-- by the code that knows. A NULL that is minutes old is a parse the platform
-- killed before either could run, and is reported as exactly that.
--
-- Also recorded per parse: the file's name and size, which path read it
-- (extracted text or the PDF itself), how many assessments came back, the
-- course code, how long it took, and — on failure only — where the file is
-- kept so an admin can retry it. Failed files are deleted after 30 days
-- (api/_parse-cleanup.ts, run by the daily cron).
--
-- Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.parse_events alter column success drop not null;
alter table public.parse_events alter column success set default null;

alter table public.parse_events
  add column if not exists finished_at     timestamptz,
  add column if not exists source          text not null default 'upload',
  add column if not exists file_name       text,
  add column if not exists bytes           integer,
  add column if not exists path            text,
  add column if not exists items           integer,
  add column if not exists course_code     text,
  add column if not exists duration_ms     integer,
  add column if not exists file_path       text,
  add column if not exists outcome_unknown boolean not null default false,
  add column if not exists retry_status    text,
  add column if not exists retry_error     text,
  add column if not exists retry_result    jsonb,
  add column if not exists retried_at      timestamptz,
  add column if not exists retried_by      uuid;

create index if not exists parse_events_created_idx on public.parse_events (created_at desc);

-- ── Backfill ─────────────────────────────────────────────────────────────────
-- Six rows in the window where nothing marked success have no error and no
-- refund. Every ordinary failure in that window went through `release`, which
-- wrote both, so these reached the end of the handler — but a function the
-- platform killed would ALSO leave no error. So only the ones with evidence are
-- marked: the student has a course imported from a syllabus (checked by hand
-- before writing this — Juliette's SOCI 262 and José's two). The rest become
-- "outcome not recorded", which is the truth.
update public.parse_events e
   set success = true, finished_at = coalesce(e.finished_at, e.created_at)
 where e.created_at >= '2026-09-18 16:26:51+00' and e.created_at < '2026-09-24 03:00:00+00'
   and e.success is false and e.error is null and not e.refunded
   and exists (select 1 from public.courses c where c.user_id = e.user_id and c.source = 'syllabus');

-- Everything else with no error and no refund: the outcome was never written
-- down and cannot be recovered. Say so rather than calling it a failure.
update public.parse_events
   set outcome_unknown = true
 where created_at < '2026-09-24 03:00:00+00'
   and success is false and error is null and not refunded;

-- ── The writers ──────────────────────────────────────────────────────────────
-- One place copies the metadata, so the four writers cannot disagree about it.
create or replace function public.ct_parse_meta(p_event uuid, p_meta jsonb)
returns void language sql security definer set search_path = public as $$
  update public.parse_events e set
    file_name   = coalesce(left(p_meta->>'file_name', 200), e.file_name),
    bytes       = coalesce((p_meta->>'bytes')::int, e.bytes),
    path        = coalesce(left(p_meta->>'path', 60), e.path),
    items       = coalesce((p_meta->>'items')::int, e.items),
    course_code = coalesce(left(p_meta->>'course_code', 20), e.course_code),
    duration_ms = coalesce((p_meta->>'duration_ms')::int, e.duration_ms),
    file_path   = coalesce(left(p_meta->>'file_path', 300), e.file_path),
    source      = coalesce(left(p_meta->>'source', 20), e.source)
  where e.id = p_event and p_meta is not null;
$$;
revoke all on function public.ct_parse_meta(uuid, jsonb) from public, anon, authenticated;

drop function if exists public.finish_parse(uuid);
create or replace function public.finish_parse(p_event uuid, p_meta jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.parse_events set success = true, finished_at = now()
   where id = p_event and user_id = auth.uid() and success is null;
  if found then perform public.ct_parse_meta(p_event, p_meta - 'file_path'); end if;
end $$;

drop function if exists public.fail_parse(uuid, text);
create or replace function public.fail_parse(p_event uuid, p_error text, p_meta jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.parse_events
     set success = false, finished_at = now(), error = left(coalesce(p_error, ''), 400)
   where id = p_event and user_id = auth.uid() and success is not true;
  if found then
    -- A stored file must live under the caller's own folder: the path is the
    -- only thing tying the file to them, and an admin retry downloads it.
    if p_meta ? 'file_path' and (p_meta->>'file_path') not like auth.uid()::text || '/%' then
      p_meta := p_meta - 'file_path';
    end if;
    perform public.ct_parse_meta(p_event, p_meta);
  end if;
end $$;

create or replace function public.cancel_parse(p_event uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.parse_events set refunded = true
   where id = p_event and user_id = auth.uid() and success is not true;
end $$;

-- Server-only twins (the personal API runs as the service role).
drop function if exists public.ct_finish_parse(uuid, text, boolean);
create or replace function public.ct_finish_parse(p_event uuid, p_error text, p_refund boolean, p_meta jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.parse_events
     set success = false, finished_at = now(),
         error = left(coalesce(p_error, 'unknown'), 500),
         refunded = coalesce(p_refund, false)
   where id = p_event;
  perform public.ct_parse_meta(p_event, p_meta);
end $$;

drop function if exists public.ct_parse_succeeded(uuid);
create or replace function public.ct_parse_succeeded(p_event uuid, p_meta jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.parse_events set success = true, finished_at = now() where id = p_event;
  perform public.ct_parse_meta(p_event, p_meta);
end $$;

revoke all on function public.ct_finish_parse(uuid, text, boolean, jsonb),
  public.ct_parse_succeeded(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.finish_parse(uuid, jsonb), public.fail_parse(uuid, text, jsonb),
  public.cancel_parse(uuid) to authenticated;

-- ── Failed uploads, kept for a retry ─────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('parse-failures', 'parse-failures', false, 4194304, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 4194304,
  allowed_mime_types = array['application/pdf'];

drop policy if exists "parse_failures_insert_own" on storage.objects;
create policy "parse_failures_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'parse-failures' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "parse_failures_read" on storage.objects;
create policy "parse_failures_read" on storage.objects for select to authenticated
  using (bucket_id = 'parse-failures'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ── Status, as one word ──────────────────────────────────────────────────────
-- "processing" only while a parse could still be running; the model has a 23s
-- ceiling and the platform 25s, so anything past two minutes is dead.
create or replace function public.ct_parse_status(e public.parse_events)
returns text language sql stable as $$
  select case
    when e.success then 'succeeded'
    when e.success is false and e.outcome_unknown then 'unknown'
    when e.success is false then 'failed'
    when e.created_at > now() - interval '2 minutes' then 'processing'
    else 'stalled'
  end
$$;

-- ── Admin: the overview ──────────────────────────────────────────────────────
create or replace function public.admin_parse_overview(p_days int default 30)
returns jsonb language sql stable security definer set search_path = public as $$
  with ev as (
    select e.*, public.ct_parse_status(e) as status,
           coalesce(p.is_internal, false) as internal
      from public.parse_events e
      left join public.user_profile p on p.user_id = e.user_id
  ),
  real as (select * from ev where not internal),
  win as (select * from real where created_at >= now() - make_interval(days => greatest(1, least(p_days, 365))))
  select case when not public.is_admin() then '{}'::jsonb else jsonb_build_object(
    'total',        (select count(*) from real),
    'succeeded',    (select count(*) from real where status = 'succeeded'),
    'failed',       (select count(*) from real where status = 'failed'),
    'processing',   (select count(*) from real where status = 'processing'),
    'stalled',      (select count(*) from real where status = 'stalled'),
    'unknown',      (select count(*) from real where status = 'unknown'),
    'refunded',     (select count(*) from real where refunded),
    'internal',     (select count(*) from ev where internal),
    'today',        (select count(*) from real where created_at >= date_trunc('day', now())),
    'last_success_at', (select max(created_at) from real where status = 'succeeded'),
    'last_failure_at', (select max(created_at) from real where status = 'failed'),
    'median_ms',    (select percentile_cont(0.5) within group (order by duration_ms)::int
                       from win where duration_ms is not null and status = 'succeeded'),
    'p90_ms',       (select percentile_cont(0.9) within group (order by duration_ms)::int
                       from win where duration_ms is not null and status = 'succeeded'),
    'zero_items',   (select count(*) from win where status = 'succeeded' and items = 0),
    'window', jsonb_build_object(
       'days', p_days,
       -- Known outcomes only: an "unknown" is not a failure and must not
       -- pull the rate down as if it were one.
       'total', (select count(*) from win where status in ('succeeded', 'failed', 'stalled')),
       'unknown', (select count(*) from win where status = 'unknown'),
       'succeeded', (select count(*) from win where status = 'succeeded'),
       'failed', (select count(*) from win where status in ('failed', 'stalled'))),
    'series', coalesce((
       select jsonb_agg(jsonb_build_object('day', d::date, 'ok', ok, 'failed', bad) order by d)
         from (
           select g.d,
                  (select count(*) from win w where w.created_at::date = g.d::date and w.status = 'succeeded') ok,
                  (select count(*) from win w where w.created_at::date = g.d::date and w.status in ('failed', 'stalled')) bad
             from generate_series(date_trunc('day', now()) - make_interval(days => greatest(1, least(p_days, 365)) - 1),
                                  date_trunc('day', now()), interval '1 day') g(d)
         ) s), '[]'::jsonb),
    'paths', coalesce((
       select jsonb_agg(jsonb_build_object('path', k, 'n', n, 'ok', ok))
         from (select split_part(coalesce(path, 'not recorded'), ':', 1) k, count(*) n,
                      count(*) filter (where status = 'succeeded') ok
                 from win group by 1 order by 2 desc) x), '[]'::jsonb),
    'top_errors', coalesce((
       select jsonb_agg(jsonb_build_object('error', k, 'n', n, 'last_at', last_at))
         from (select regexp_replace(left(error, 90), '\d+', '#', 'g') k, count(*) n, max(created_at) last_at
                 from real where status = 'failed' and error is not null
                group by 1 order by 2 desc limit 8) x), '[]'::jsonb),
    'by_user', coalesce((
       select jsonb_agg(u order by u->>'last_at' desc)
         from (select jsonb_build_object(
                  'user_id', r.user_id, 'name', p.name, 'handle', p.handle, 'email', p.email,
                  'total', count(*), 'ok', count(*) filter (where r.status = 'succeeded'),
                  'failed', count(*) filter (where r.status in ('failed', 'stalled')),
                  'last_at', max(r.created_at)) u
                 from real r left join public.user_profile p on p.user_id = r.user_id
                group by r.user_id, p.name, p.handle, p.email
                order by max(r.created_at) desc limit 50) x), '[]'::jsonb),
    'by_course', coalesce((
       select jsonb_agg(jsonb_build_object('course', k, 'total', n, 'ok', ok, 'failed', bad))
         from (select upper(course_code) k, count(*) n,
                      count(*) filter (where status = 'succeeded') ok,
                      count(*) filter (where status in ('failed', 'stalled')) bad
                 from real where course_code is not null and course_code <> ''
                group by 1 order by 2 desc limit 30) x), '[]'::jsonb)
  ) end
$$;

-- ── Admin: the event list ────────────────────────────────────────────────────
drop function if exists public.admin_parse_events(text, int);
create function public.admin_parse_events(p_status text default null, p_limit int default 100)
returns table (
  id uuid, created_at timestamptz, finished_at timestamptz, status text, refunded boolean,
  error text, source text, file_name text, bytes int, path text, items int, course_code text,
  duration_ms int, has_file boolean, retry_status text, retry_error text, retried_at timestamptz,
  user_id uuid, name text, handle text, email text, internal boolean)
language sql stable security definer set search_path = public as $$
  select e.id, e.created_at, e.finished_at, public.ct_parse_status(e), e.refunded,
         e.error, e.source, e.file_name, e.bytes, e.path, e.items, e.course_code,
         e.duration_ms, e.file_path is not null, e.retry_status, e.retry_error, e.retried_at,
         e.user_id, p.name, p.handle, p.email, coalesce(p.is_internal, false)
    from public.parse_events e
    left join public.user_profile p on p.user_id = e.user_id
   where public.is_admin()
     and (p_status is null or public.ct_parse_status(e) = p_status
          or (p_status = 'problems' and public.ct_parse_status(e) in ('failed', 'stalled')))
   order by e.created_at desc
   limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

-- Kept for older callers; now reads the real status.
create or replace function public.admin_parse_failures()
returns table (created_at timestamptz, handle text, refunded boolean, error text)
language sql stable security definer set search_path = public as $$
  select e.created_at, p.handle, e.refunded, e.error
    from public.parse_events e
    left join public.user_profile p on p.user_id = e.user_id
   where public.is_admin() and public.ct_parse_status(e) in ('failed', 'stalled')
   order by e.created_at desc
   limit 100;
$$;

-- ── The retry result, for the student it belongs to ─────────────────────────
create or replace function public.my_parse_retry(p_event uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select e.retry_result from public.parse_events e
   where e.id = p_event and e.user_id = auth.uid() and e.retry_status = 'succeeded';
$$;

grant execute on function public.admin_parse_overview(int), public.admin_parse_events(text, int),
  public.admin_parse_failures(), public.my_parse_retry(uuid) to authenticated;

-- ── The activity feed: the real word ────────────────────────────────────────
create or replace function public.admin_recent_activity(p_limit integer default 20)
returns table(kind text, label text, detail text, who text, at timestamptz)
language sql stable security definer set search_path = public as $$
  select * from (
    select 'signup'::text                                   as kind,
           'New account'::text                              as label,
           coalesce(p.program, 'No program yet')::text      as detail,
           coalesce(p.name, p.email, 'Unnamed')::text       as who,
           p.created_at                                     as happened_at
      from public.user_profile p
     where coalesce(p.is_internal, false) = false

    union all
    select 'ticket', 'Support ticket', t.subject,
           coalesce(t.name, t.email, 'Anonymous'), t.created_at
      from public.tickets t

    union all
    select 'parse', 'Syllabus parsed',
           case public.ct_parse_status(pe)
             when 'succeeded' then 'Imported' || coalesce(' · ' || pe.course_code, '')
                                  || coalesce(' · ' || pe.items || ' items', '')
             when 'processing' then 'Processing'
             when 'stalled' then 'Stopped before finishing'
             when 'unknown' then 'Outcome not recorded'
             else 'Failed' || coalesce(': ' || left(pe.error, 80), '')
           end,
           coalesce(p.name, p.email, 'Unnamed'), pe.created_at
      from public.parse_events pe
      join public.user_profile p on p.user_id = pe.user_id
     where coalesce(p.is_internal, false) = false

    union all
    select 'bug', 'Bug report', left(coalesce(b.title, b.description, ''), 80),
           coalesce(b.user_email, 'Anonymous'), b.created_at
      from public.bug_reports b

    union all
    select 'admin', 'Admin action: ' || l.action, l.reason,
           coalesce(l.actor_email, 'unknown'), l.created_at
      from public.admin_audit_log l
  ) rows
  where public.is_admin()
  order by rows.happened_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;
