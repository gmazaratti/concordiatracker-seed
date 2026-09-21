-- A visit says where somebody LANDED. It should say where they went.
--
-- The panel showed `/app` for every session and nothing else, which reads as
-- "we only track the entry point". We are not: `site_events` records a
-- normalised path on every route change, so the whole journey is already
-- sitting there and only the first row was being read.
--
-- WHY A JSONB ARRAY AND NOT A SECOND QUERY. One row per visit already comes
-- back; the pages belong to that row. A separate call would mean N+1 requests
-- to render one table, and a join would multiply the visit rows and break the
-- counts above it.
--
-- ORDERED BY WHEN THEY FIRST HIT IT, not by count: the sequence is the
-- interesting part ("landed on /app, went to Courses, then Planner"), and a
-- frequency ranking throws exactly that away. `views` is carried alongside so
-- a page they kept coming back to is still visible.
--
-- RUN in the Supabase SQL editor. Safe to re-run.

-- Return type changes, so it has to be dropped rather than replaced.
drop function if exists public.admin_user_visits(uuid, int);

create or replace function public.admin_user_visits(p_user uuid, p_limit int default 50)
returns table (
  session_id   text,
  started_at   timestamptz,
  ended_at     timestamptz,
  seconds      int,
  events       int,
  device       text,
  source       text,
  first_path   text,
  -- [{ path, views, at }] in the order they were first opened.
  pages        jsonb
)
language sql security definer set search_path = public stable as $$
  with ev as (
    select e.session_id, e.created_at, e.device, e.referrer_host, e.utm_source, e.path
      from public.site_events e
     where public.is_admin() and e.user_id = p_user and e.session_id is not null
  ),
  per_page as (
    select session_id, path, count(*)::int as views, min(created_at) as first_at
      from ev
     where path is not null
     group by session_id, path
  )
  select
    ev.session_id::text,
    min(ev.created_at),
    max(ev.created_at),
    greatest(0, extract(epoch from (max(ev.created_at) - min(ev.created_at)))::int),
    count(*)::int,
    max(ev.device),
    coalesce(
      nullif(max(ev.referrer_host), ''),
      nullif(max(ev.utm_source), ''),
      'Direct'
    ),
    (array_agg(ev.path order by ev.created_at))[1],
    coalesce((
      select jsonb_agg(jsonb_build_object('path', p.path, 'views', p.views, 'at', p.first_at)
                       order by p.first_at)
        from per_page p
       where p.session_id = ev.session_id
    ), '[]'::jsonb)
  from ev
  group by ev.session_id
  order by min(ev.created_at) desc
  limit greatest(1, least(coalesce(p_limit, 50), 500));
$$;
grant execute on function public.admin_user_visits(uuid, int) to authenticated;

-- (The course-source function moved to db/course_source.sql once measuring
-- showed the inference it relied on was wrong — see the header there.)
