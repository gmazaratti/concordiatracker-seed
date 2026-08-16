-- ============================================================================
-- Course directory: a cached mirror of Concordia's catalogue.
-- RUN IN: Supabase SQL Editor. Safe to re-run.
--
-- The catalogue endpoint returns all 7,946 courses in one 1.4MB response.
-- Fetching that per search would be absurd for us and rude to them, so it's
-- mirrored here and refreshed on a schedule. Course descriptions and
-- prerequisites change once a year, not once a minute.
--
-- This table is PUBLIC READ on purpose: it's published university catalogue
-- data, not user data, and the directory should work for a signed-out visitor
-- browsing from the landing page.
-- ============================================================================

create table if not exists public.course_catalog (
  id            text primary key,          -- Concordia's course ID
  subject       text not null,             -- "COMP"
  catalog       text not null,             -- "248"
  title         text not null,
  career        text,                      -- UGRD / GRAD
  class_unit    numeric,                   -- credits
  prerequisites text,                      -- free prose, parsed at read time
  crosslisted   text,
  synced_at     timestamptz not null default now()
);

create index if not exists course_catalog_subject_idx on public.course_catalog (subject, catalog);
-- Search runs over code and title together, so "comp 248" and "object oriented"
-- both land. pg_trgm gives useful ranking on partial words without a tsvector.
create extension if not exists pg_trgm;
create index if not exists course_catalog_search_idx
  on public.course_catalog using gin ((subject || ' ' || catalog || ' ' || title) gin_trgm_ops);

alter table public.course_catalog enable row level security;

drop policy if exists "catalog_public_read" on public.course_catalog;
create policy "catalog_public_read" on public.course_catalog for select using (true);
grant select on public.course_catalog to anon, authenticated;

-- No write policy: only the sync job (service role) fills this.

/**
 * Search the directory.
 *
 * Ranks exact code matches first, then prefix matches, then anything else, so
 * typing "COMP 248" puts COMP 248 at the top rather than COMP 2480.
 */
create or replace function public.search_courses(p_q text, p_limit int default 40)
returns table (
  id text, subject text, catalog text, title text,
  career text, class_unit numeric, prerequisites text
)
language sql security definer set search_path = public stable as $$
  with q as (select upper(trim(coalesce(p_q, ''))) as term)
  select c.id, c.subject, c.catalog, c.title, c.career, c.class_unit, c.prerequisites
  from public.course_catalog c, q
  where q.term <> ''
    and (
      (c.subject || ' ' || c.catalog) ilike '%' || q.term || '%'
      or (c.subject || c.catalog) ilike '%' || replace(q.term, ' ', '') || '%'
      or c.title ilike '%' || q.term || '%'
    )
  order by
    ((c.subject || ' ' || c.catalog) = q.term) desc,
    ((c.subject || ' ' || c.catalog) ilike q.term || '%') desc,
    c.subject, c.catalog
  limit greatest(1, least(coalesce(p_limit, 40), 100));
$$;
grant execute on function public.search_courses(text, int) to anon, authenticated;

/** Every subject code, for a browse-by-department view. */
create or replace function public.course_subjects()
returns table (subject text, course_count int)
language sql security definer set search_path = public stable as $$
  select c.subject, count(*)::int
  from public.course_catalog c
  group by c.subject
  order by c.subject;
$$;
grant execute on function public.course_subjects() to anon, authenticated;

/** How fresh the mirror is, so the UI can say so rather than implying live data. */
create or replace function public.catalog_status()
returns table (total int, synced_at timestamptz)
language sql security definer set search_path = public stable as $$
  select count(*)::int, max(c.synced_at) from public.course_catalog c;
$$;
grant execute on function public.catalog_status() to anon, authenticated;
