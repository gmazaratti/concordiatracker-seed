-- Course and instructor reviews.
--
-- WHAT A REVIEW IS HERE, and why it is not a clone of concordia.courses:
-- their reviews are opinion. Ours sit next to a SYLLABUS we have already
-- parsed, so the two kinds of claim are kept apart in the schema:
--
--   • OPINION  — difficulty, experience, prose. A person's read. Averaged.
--   • FACT     — "attendance is mandatory", "the final is cumulative". These
--                come from the outline, carry a source, and are NEVER inferred
--                from a review tag. `SKIP_CLASS_YOU_WONT_PASS` is somebody's
--                impression, not a policy, and printing it as one is the exact
--                confident-wrong-answer this product exists to avoid.
--
-- `attendance` is therefore nullable and stays null on every imported row.
-- It is filled only by somebody who ticks it on our own form, or later by the
-- outline extractor with a citation.
--
-- ATTRIBUTION IS A COLUMN, not a footnote. `source` says where a review came
-- from and it is shown on the row. A review we did not collect must never
-- read as one we did.
--
-- RUN in the Supabase SQL editor. Safe to re-run.

create table if not exists public.course_reviews (
  id          uuid primary key default gen_random_uuid(),
  -- Normalised the same way every other course join in this database is, so
  -- "COMP 248" / "comp248" / "COMP-248" are one course.
  course_code text not null,
  /** Instructor as the source names them. Free text on purpose: we have no
   *  instructor table, and inventing ids for people would mean guessing which
   *  "J. Smith" is which. */
  instructor  text,
  user_id     uuid references auth.users (id) on delete set null,
  /** 'student'          — written here
   *  'concordia.courses'— imported with Beaudelaire's permission */
  source      text not null default 'student',
  /** Their `_id`, so a re-import updates rather than duplicates. */
  source_id   text,
  difficulty  smallint check (difficulty between 1 and 5),
  experience  smallint check (experience between 1 and 5),
  /** Null unless somebody actually stated it. See the note above. */
  attendance  text check (attendance in ('mandatory', 'graded', 'optional')),
  body        text,
  tags        text[] not null default '{}',
  term        text,
  created_at  timestamptz not null default now(),
  hidden      boolean not null default false
);

do $$ begin
  alter table public.course_reviews
    add constraint course_reviews_body_ck check (body is null or length(body) <= 4000);
exception when duplicate_object then null; end $$;

-- One review per person per course. A second opinion on the same class is an
-- edit, not a new row.
create unique index if not exists course_reviews_one_per_user_idx
  on public.course_reviews (user_id, course_code) where user_id is not null;
-- Re-import is idempotent.
--
-- NOT PARTIAL, and that is load-bearing. `where source_id is not null` looks
-- like the careful choice and breaks the only thing the index exists for:
-- Postgres refuses `on conflict (source, source_id)` against a partial index
-- unless the statement repeats the predicate, and PostgREST cannot add one.
-- A full unique index is safe anyway, because unique indexes treat NULLs as
-- DISTINCT — every student-written row has a null `source_id` and they all
-- coexist. Same trap as `todos_external_uid_idx`.
drop index if exists public.course_reviews_source_idx;
create unique index if not exists course_reviews_source_idx
  on public.course_reviews (source, source_id);
create index if not exists course_reviews_course_idx
  on public.course_reviews (course_code, created_at desc) where not hidden;

alter table public.course_reviews enable row level security;

-- Reviews are public; that is the point of them.
drop policy if exists course_reviews_read on public.course_reviews;
create policy course_reviews_read on public.course_reviews
  for select to anon, authenticated using (not hidden);

drop policy if exists course_reviews_write on public.course_reviews;
create policy course_reviews_write on public.course_reviews
  for insert to authenticated with check (auth.uid() = user_id and source = 'student');

drop policy if exists course_reviews_update on public.course_reviews;
create policy course_reviews_update on public.course_reviews
  for update to authenticated using (auth.uid() = user_id or public.is_admin());

drop policy if exists course_reviews_delete on public.course_reviews;
create policy course_reviews_delete on public.course_reviews
  for delete to authenticated using (auth.uid() = user_id or public.is_admin());

-- ── Reading ─────────────────────────────────────────────────────────────────

/**
 * The numbers under a course.
 *
 * THE COUNT IS RETURNED WITH THE AVERAGE, always, and the UI is expected to
 * show it. "Difficulty 4.8" off two reviews and off two hundred are different
 * claims, and an average with no n is the most common way a review page lies.
 */
create or replace function public.course_review_summary(p_code text)
returns table (
  reviews    integer,
  difficulty numeric,
  experience numeric,
  -- Only counted where somebody actually said. Never inferred.
  attendance_mandatory integer,
  attendance_answers   integer
)
language sql stable security definer set search_path = public as $$
  select count(*)::int,
         round(avg(difficulty)::numeric, 2),
         round(avg(experience)::numeric, 2),
         count(*) filter (where attendance = 'mandatory')::int,
         count(*) filter (where attendance is not null)::int
    from public.course_reviews r
   where not r.hidden
     and public.ct_norm_code(r.course_code) = public.ct_norm_code(p_code);
$$;
grant execute on function public.course_review_summary(text) to anon, authenticated;

create or replace function public.course_review_list(p_code text, p_limit int default 50)
returns table (
  id         uuid,
  instructor text,
  source     text,
  difficulty smallint,
  experience smallint,
  attendance text,
  body       text,
  tags       text[],
  term       text,
  created_at timestamptz,
  is_mine    boolean,
  -- Handle only when a real account wrote it; imported rows stay anonymous
  -- because their authors never had one here.
  handle     text,
  name       text
)
language sql stable security definer set search_path = public as $$
  select r.id, r.instructor, r.source, r.difficulty, r.experience, r.attendance,
         r.body, r.tags, r.term, r.created_at,
         r.user_id is not null and r.user_id = auth.uid(),
         up.handle, up.name
    from public.course_reviews r
    left join public.user_profile up on up.user_id = r.user_id
   where not r.hidden
     and public.ct_norm_code(r.course_code) = public.ct_norm_code(p_code)
   order by r.created_at desc
   limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;
grant execute on function public.course_review_list(text, int) to anon, authenticated;

/** Write or replace your own. One per course, so this upserts. */
create or replace function public.save_course_review(
  p_code       text,
  p_instructor text,
  p_difficulty smallint,
  p_experience smallint,
  p_attendance text,
  p_body       text,
  p_tags       text[] default '{}',
  p_term       text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;

  insert into public.course_reviews
    (course_code, instructor, user_id, source, difficulty, experience, attendance, body, tags, term)
  values
    (upper(btrim(p_code)), nullif(btrim(coalesce(p_instructor, '')), ''), auth.uid(), 'student',
     p_difficulty, p_experience, nullif(p_attendance, ''), nullif(btrim(coalesce(p_body, '')), ''),
     coalesce(p_tags, '{}'), nullif(btrim(coalesce(p_term, '')), ''))
  on conflict (user_id, course_code) where user_id is not null
  do update set instructor = excluded.instructor,
                difficulty = excluded.difficulty,
                experience = excluded.experience,
                attendance = excluded.attendance,
                body       = excluded.body,
                tags       = excluded.tags,
                term       = excluded.term,
                created_at = now()
  returning id into rid;
  return rid;
end; $$;
grant execute on function public.save_course_review(text, text, smallint, smallint, text, text, text[], text) to authenticated;
