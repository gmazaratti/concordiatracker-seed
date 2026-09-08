-- ─────────────────────────────────────────────────────────────────────────────
-- The survey results page has NEVER worked. Two bugs in one expression.
--
--   'averages', (
--     select coalesce(jsonb_object_agg(k, round(avg(v::numeric), 2)), '{}')
--     from public_survey s, jsonb_each_text(s.ratings) as e(k, v)
--     where v ~ '^[0-9]+$'
--   )
--
--   1. jsonb_object_agg(...) wrapping avg(...) is a NESTED AGGREGATE, which
--      Postgres rejects outright — "aggregate function calls cannot be nested".
--      That error aborts the whole function, so the page showed nothing at all,
--      not just a missing averages block. Every response was in the table the
--      entire time; only the reader was broken.
--   2. Even unnested it was wrong: no GROUP BY, so avg() would have collapsed
--      every question into one number.
--
-- Fixed by averaging per key in a subquery, then aggregating that.
--
-- Also adds the conversion numbers, which is the question the survey exists to
-- answer: how many of the people who filled it in actually became users.
--
-- Run in the Supabase SQL editor (project qagtygymiivnyfwrtmzl). Re-runnable.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.admin_public_survey()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;

  select jsonb_build_object(
    'responses', (select count(*) from public_survey),
    'emails',    (select count(*) from public_survey where coalesce(email,'') <> ''),

    -- ── Conversion ────────────────────────────────────────────────────────
    -- `claimed` is the honest denominator: only responses that were ISSUED a
    -- trial link can convert through one, and rows created before that feature
    -- existed never had the chance. Counting them as failures would understate
    -- the rate for no reason.
    'claimable', (select count(*) from public_survey where reward_code is not null),
    'converted', (select count(*) from public_survey where redeemed_at is not null),
    'with_outline', (
      select count(*) from public_survey
       where coalesce(jsonb_array_length(outline_files), 0) > 0
    ),
    'outline_files', (
      select coalesce(sum(coalesce(jsonb_array_length(outline_files), 0)), 0)
      from public_survey
    ),

    'sources', (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select coalesce(nullif(source,''),'direct') as source, count(*) as n
        from public_survey group by 1 order by 2 desc limit 12
      ) x
    ),

    -- Averaged per question in the subquery, THEN aggregated. The shape the
    -- client reads is unchanged.
    'averages', (
      select coalesce(jsonb_object_agg(t.k, t.a), '{}'::jsonb)
      from (
        select e.k as k, round(avg(e.v::numeric), 2) as a
        from public_survey s, jsonb_each_text(s.ratings) as e(k, v)
        where e.v ~ '^[0-9]+$'
        group by e.k
      ) t
    ),

    -- Per-question option tallies for the choice questions, so "would you
    -- support us seeking Concordia funding" is readable as counts rather than
    -- by eye down 200 rows. Multi-selects store "a|b", so they are split.
    'choices', (
      select coalesce(jsonb_object_agg(q.k, q.opts), '{}'::jsonb)
      from (
        select k, jsonb_object_agg(opt, n) as opts
        from (
          select e.k as k, trim(o) as opt, count(*) as n
          from public_survey s,
               jsonb_each_text(s.answers) as e(k, v),
               unnest(string_to_array(e.v, '|')) as o
          where trim(o) <> '' and length(trim(o)) <= 60
          group by e.k, trim(o)
        ) inner_q
        group by k
      ) q
    ),

    'rows', (
      select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
        select id, ratings, answers, email, source, created_at,
               coalesce(outline_files, '[]'::jsonb) as outline_files,
               (redeemed_at is not null) as converted
        from public_survey order by created_at desc limit 200
      ) x
    )
  ) into r;

  return r;
end $$;

grant execute on function public.admin_public_survey() to authenticated;

-- Sanity check after running — this is the number that was invisible:
--   select count(*) as responses,
--          count(*) filter (where email is not null and email <> '') as with_email,
--          count(*) filter (where redeemed_at is not null) as converted
--     from public.public_survey;
