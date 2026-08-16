-- ============================================================================
-- Course descriptions.
-- RUN IN: Supabase SQL Editor. Safe to re-run.
-- Requires db/course_catalog.sql.
--
-- Concordia publishes these on a separate endpoint (/course/description) keyed
-- by the same course ID, so they join cleanly onto the mirror rather than
-- needing a table of their own.
-- ============================================================================

alter table public.course_catalog
  add column if not exists description text;

-- Search should reach into the description too: a student looking for
-- "machine learning" will not know which four-letter subject owns it.
drop index if exists course_catalog_search_idx;
create index if not exists course_catalog_search_idx
  on public.course_catalog using gin (
    (subject || ' ' || catalog || ' ' || title || ' ' || coalesce(description, '')) gin_trgm_ops
  );

/** Search, now including the description, and returning it. */
create or replace function public.search_courses(p_q text, p_limit int default 40)
returns table (
  id text, subject text, catalog text, title text,
  career text, class_unit numeric, prerequisites text, description text
)
language sql security definer set search_path = public stable as $$
  with q as (select upper(trim(coalesce(p_q, ''))) as term)
  select c.id, c.subject, c.catalog, c.title, c.career, c.class_unit, c.prerequisites, c.description
  from public.course_catalog c, q
  where q.term <> ''
    and (
      (c.subject || ' ' || c.catalog) ilike '%' || q.term || '%'
      or (c.subject || c.catalog) ilike '%' || replace(q.term, ' ', '') || '%'
      or c.title ilike '%' || q.term || '%'
      or c.description ilike '%' || q.term || '%'
    )
  order by
    -- An exact code first, then a code prefix, then a title match, and only
    -- then a description match: someone typing "COMP 248" wants that course,
    -- not every course whose description mentions it.
    ((c.subject || ' ' || c.catalog) = q.term) desc,
    ((c.subject || ' ' || c.catalog) ilike q.term || '%') desc,
    (c.title ilike '%' || q.term || '%') desc,
    c.subject, c.catalog
  limit greatest(1, least(coalesce(p_limit, 40), 100));
$$;
grant execute on function public.search_courses(text, int) to anon, authenticated;

/** Browse, now returning the description too. */
create or replace function public.browse_courses(
  p_subjects text[] default null,
  p_offset   int    default 0,
  p_limit    int    default 10
)
returns table (
  id text, subject text, catalog text, title text,
  career text, class_unit numeric, prerequisites text, description text,
  total_count bigint
)
language sql security definer set search_path = public stable as $$
  with matched as (
    select c.*
    from public.course_catalog c
    where p_subjects is null
       or cardinality(p_subjects) = 0
       or c.subject = any (p_subjects)
  )
  select m.id, m.subject, m.catalog, m.title, m.career, m.class_unit, m.prerequisites,
         m.description, count(*) over () as total_count
  from matched m
  order by m.subject, m.catalog
  offset greatest(0, coalesce(p_offset, 0))
  limit  greatest(1, least(coalesce(p_limit, 10), 400));
$$;
grant execute on function public.browse_courses(text[], int, int) to anon, authenticated;
