-- Where a course came from, recorded rather than guessed.
--
-- THE FIRST ATTEMPT AT THIS WAS WRONG, and measuring caught it. I inferred
-- the source from `origin = 'manual'` plus the provenance on the assessments
-- an import created — and then ran it over a real account, where every
-- course came back "manual" with zero assessments. `createCourse` stamps
-- `origin: 'manual'` on EVERY path, including the catalogue picker, so the
-- column cannot tell typing a code from choosing one off Concordia's
-- calendar. An admin panel that labels a catalogue pick "manual" is worse
-- than one that says nothing.
--
-- So it is recorded at creation instead, by the path that creates it:
--   catalogue — picked from the Concordia course mirror
--   manual    — typed in by hand
--   blueprint — imported from a student-uploaded outline
--   outline   — imported from a teacher-verified / eConcordia outline
--   moodle    — created from the classes the Moodle feed names
--   syllabus  — created by the syllabus parser
--
-- HISTORY STAYS NULL, deliberately. Existing rows genuinely do not know, and
-- backfilling them from a rule I already know to be unreliable would put a
-- confident wrong answer in front of the person using it to make decisions.
-- The panel reads null as "not recorded".
--
-- RUN in the Supabase SQL editor. Safe to re-run.

alter table public.courses
  add column if not exists source text;

comment on column public.courses.source is
  'How the course was added: catalogue | manual | blueprint | outline | moodle | syllabus. Null on rows created before this was recorded.';

drop function if exists public.admin_user_courses(uuid);

create or replace function public.admin_user_courses(p_user uuid)
returns table (
  id          text,
  code        text,
  name        text,
  term        text,
  credits     numeric,
  archived    boolean,
  assessments int,
  source      text
)
language sql security definer set search_path = public stable as $$
  select
    c.id::text,
    c.code,
    c.name,
    c.term,
    c.credits,
    coalesce(c.archived, false),
    coalesce(a.n, 0)::int,
    -- What was recorded, or the ONE inference that is still safe: assessments
    -- marked official can only have come from a verified outline. Everything
    -- else on an older row is honestly unknown.
    coalesce(
      c.source,
      case when coalesce(a.official, 0) > 0 then 'outline' end
    )
  from public.courses c
  left join lateral (
    select count(*) as n,
           count(*) filter (where s.provenance_status = 'official') as official
      from public.assignments s
     where s.course_id = c.id and coalesce(s.deleted, false) = false
  ) a on true
  where public.is_admin() and c.user_id = p_user
  -- `courses` has no created_at (checked against information_schema, not
  -- assumed), so current term first and then by code.
  order by coalesce(c.archived, false), c.term desc nulls last, c.code;
$$;
grant execute on function public.admin_user_courses(uuid) to authenticated;
