-- ============================================================================
-- Academic profile: what year you're in, and what your record unlocks.
-- RUN IN: Supabase SQL Editor. Safe to re-run.
-- Requires db/course_catalog.sql and db/seat_alerts_and_tracking.sql first
-- (this uses course_catalog and ct_norm_code).
-- ============================================================================

-- Program and school already live on user_profile. These are the two the
-- planner needs and did not have.
alter table public.user_profile
  add column if not exists year_of_study int,
  add column if not exists minor text,
  -- Set by the student, not inferred. Prerequisite checking is only shown once
  -- this is true, because colouring a requirement red against a half-entered
  -- history tells someone they are ineligible for a course they have already
  -- qualified for, and red is the kind of answer people act on.
  add column if not exists record_complete boolean not null default false;

-- A past course with no grade still counts for credits and still counts as a
-- prerequisite met, so final_percent has to be genuinely optional. It already
-- is nullable; this only documents the intent for the next reader.
comment on column public.courses.final_percent is
  'Frozen final grade. NULL means the course is complete but ungraded: it counts for credits and prerequisites, and is skipped by GPA.';

-- ============================================================================
-- Who teaches a section
-- ============================================================================

/**
 * Concordia's Open Data does NOT publish instructor names. The schedule feed's
 * 41 fields have none, and /course/faculty is faculty-and-department org
 * structure, not people. So this comes from our own data instead, and says so:
 *
 *   - a teacher-verified blueprint means the instructor of record published it
 *     through the portal, which is the strongest claim we can make;
 *   - a community blueprint is a student's report, and gets counted, not
 *     asserted.
 *
 * Same discipline as the provenance badges: show where it came from rather than
 * flattening both into "the instructor is X".
 */
create or replace function public.section_instructors(p_code text)
returns table (section text, professor text, verified boolean, reports int)
language sql security definer set search_path = public stable as $$
  select
    upper(trim(b.section))            as section,
    trim(b.professor)                 as professor,
    bool_or(b.verified)               as verified,
    count(*)::int                     as reports
  from public.shared_blueprints b
  where public.ct_norm_code(b.course_code) = public.ct_norm_code(p_code)
    and coalesce(trim(b.professor), '') <> ''
    and coalesce(trim(b.section), '')   <> ''
  group by 1, 2
  order by bool_or(b.verified) desc, count(*) desc;
$$;
grant execute on function public.section_instructors(text) to anon, authenticated;

-- ============================================================================
-- What your record unlocks
-- ============================================================================

/**
 * The course codes named inside a prerequisite sentence.
 *
 * Concordia writes prerequisites as prose. This pulls the CODES out; it does
 * NOT attempt the logic between them (and / or / "previously or concurrently" /
 * "or equivalent" / minimum-grade conditions). Everything built on top has to
 * stay honest about that, because a rule half-understood and presented as fact
 * is worse than showing the student the sentence.
 */
create or replace function public.prereq_codes(p_text text)
returns text[] language sql immutable as $$
  select coalesce(
    array_agg(distinct public.ct_norm_code(m[1])),
    '{}'::text[]
  )
  from regexp_matches(coalesce(p_text, ''), '([A-Z]{4}\s?[0-9]{3}[A-Z]?)', 'g') m;
$$;
grant execute on function public.prereq_codes(text) to anon, authenticated;

/**
 * Courses in the given subjects, scored against what the student has finished.
 *
 * `missing` is the codes named in the prerequisite that are not in `p_completed`.
 * Empty means every course NAMED is done — which is NOT the same as "you are
 * eligible", because an "or" clause may have needed only one of them and a
 * minimum grade may still apply. The UI says exactly that and shows the
 * original sentence, and no caller should ever reword it into a promise.
 */
create or replace function public.prereq_progress(
  p_completed text[],
  p_subjects  text[],
  p_limit     int default 200
)
returns table (
  id text, subject text, catalog text, title text,
  class_unit numeric, prerequisites text, missing text[]
)
language sql security definer set search_path = public stable as $$
  with done as (
    select coalesce(array_agg(public.ct_norm_code(t.code)), '{}'::text[]) as codes
    from unnest(coalesce(p_completed, '{}'::text[])) as t(code)
  ),
  -- The completed set is CROSS JOINed rather than read with a scalar subquery.
  -- `x = any ((select arr from t))` is the SUBQUERY form of ANY, which compares
  -- x against each ROW of the subquery: that is text = text[], and it fails.
  -- Joining makes d.codes a plain array expression, which is the array form.
  scored as (
    select
      c.id           as course_id,
      c.subject      as course_subject,
      c.catalog      as course_catalog,
      c.title        as course_title,
      c.class_unit   as course_units,
      c.prerequisites as course_prereqs,
      array(
        select pc.code
        from unnest(public.prereq_codes(c.prerequisites)) as pc(code)
        where not (pc.code = any (d.codes))
      ) as missing_codes
    from public.course_catalog c
    cross join done d
    where c.subject = any (coalesce(p_subjects, '{}'::text[]))
      and coalesce(c.prerequisites, '') <> ''
      -- Only courses that actually name a course. "Written permission of the
      -- department" is a prerequisite we cannot reason about at all.
      and cardinality(public.prereq_codes(c.prerequisites)) > 0
      -- Nothing you have already finished.
      and not (public.ct_norm_code(c.subject || c.catalog) = any (d.codes))
  )
  select s.course_id, s.course_subject, s.course_catalog, s.course_title,
         s.course_units, s.course_prereqs, s.missing_codes
  from scored s
  -- Closest first: everything named already done, then one course away.
  order by cardinality(s.missing_codes), s.course_subject, s.course_catalog
  limit greatest(1, least(coalesce(p_limit, 200), 400));
$$;
grant execute on function public.prereq_progress(text[], text[], int) to anon, authenticated;
