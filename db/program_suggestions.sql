-- What other students in your programme actually took.
--
-- THE GAP THIS FILLS. A rule-only group ("24 credits of major requirements",
-- "chosen from 300-level or above") shows the calendar's wording and counts
-- zero, on purpose: those rules are prose with exclusion pairs and a
-- confidently wrong tick is the worst thing this screen could do. But it left
-- a student reading a paragraph with no idea what to actually register in.
--
-- WHY NOT SUGGEST FROM THE RULE TEXT. Measured before building: of the 25
-- seeded groups, exactly ONE names any course codes in its rule — and they
-- are "cannot receive credit for both COMP 339 and MATH 339", an EXCLUSION.
-- Extracting codes would have produced nothing for 24 groups and the wrong
-- advice for the 25th.
--
-- SO: A FACT, NOT AN INTERPRETATION. "31 Computer Science students have this
-- course" is something we know. It is not advice, it does not claim the
-- course satisfies the rule, and the UI says so. Same stance as the blueprint
-- votes and the peer date corrections: show the crowd, never pretend it is
-- authority.
--
-- PRIVACY, the same contract as course_tracking: this returns COUNTS AND
-- COURSE CODES AND NOTHING ELSE. No user ids, no names, ever — a future
-- version that returns one is a different function and should be refused in
-- review. SECURITY DEFINER only because `public.courses` is select-own.
-- A floor of 3 hides the cases where a count would say more about the two or
-- three people in it than about the programme.

create or replace function public.program_course_picks(
  p_program_id text,
  p_limit int default 12
)
returns table (code text, title text, credits numeric, takers int)
language sql security definer set search_path = public as $$
  -- QUALIFY EVERY COLUMN: the OUT parameter names above shadow the tables'
  -- own, which is the 42702 that took support tickets down for weeks.
  select
    ct_norm_code(c.code)                       as code,
    (array_agg(c.name order by c.name))[1]     as title,
    max(c.credits)                             as credits,
    count(distinct c.user_id)::int             as takers
  from public.courses c
  join public.user_profile p on p.user_id = c.user_id
  where p.program_id = p_program_id
    and coalesce(p.is_internal, false) = false
    and c.code is not null and length(trim(c.code)) > 0
  group by ct_norm_code(c.code)
  having count(distinct c.user_id) >= 3
  order by count(distinct c.user_id) desc, ct_norm_code(c.code)
  limit greatest(1, least(p_limit, 50));
$$;

revoke all on function public.program_course_picks(text, int) from public;
grant execute on function public.program_course_picks(text, int) to authenticated;

comment on function public.program_course_picks(text, int) is
  'Courses held by 3+ students in a programme: code, title, credits, count. Never returns a user id.';
