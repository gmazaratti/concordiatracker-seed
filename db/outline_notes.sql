-- ─────────────────────────────────────────────────────────────────────────────
-- Conditions move out of item TITLES and into a `note`.
-- RUN IN: Supabase SQL Editor. Safe to re-run. Requires the outline seeds.
--
-- Several outlines carry a rule the weight cannot express:
--
--   PHYS 204/205  flexible grading — sit the midterm and the final is 50%,
--                 or skip it and the final is 70% (205: 75%)
--   COMM 214/216  a PASS FLOOR — you can average 60 overall and still fail the
--                 course by scoring 49 on the final
--   ENGR 391      both a pass floor and an R-grade rule
--   COMM 309      40% required on the common final
--
-- These were written into the title, which made the title long and still read
-- as a claim about the item rather than a condition on it. `note` shows on its
-- own line in the outline preview AND is carried into the assessment's own
-- notes on import — so the student meets it on their list in week ten, not
-- only in the browser in week one.
--
-- The titles are shortened back to what the outline actually calls the item.
-- ─────────────────────────────────────────────────────────────────────────────

/**
 * Set the note on one item of one blueprint, matched by title prefix.
 *
 * jsonb_set needs an index and these arrays are short, so the whole array is
 * rebuilt. Matching on a PREFIX rather than the exact string means the title
 * can be shortened in the same pass without the two steps having to agree on
 * an intermediate value.
 */
create or replace function pg_temp.set_item_note(
  p_code text, p_term text, p_title_like text, p_new_title text, p_note text
) returns void language sql as $$
  update public.shared_blueprints b
     set items = (
       select jsonb_agg(
         case when i->>'title' like p_title_like
              then i || jsonb_build_object('title', p_new_title, 'note', p_note)
              else i end
         order by ord
       )
       from jsonb_array_elements(b.items) with ordinality t(i, ord)
     )
   where b.course_code = p_code
     and b.term = p_term
     and b.author = 'Course outline';
$$;

select pg_temp.set_item_note('PHYS 204', 'Fall 2026', 'Final exam%',
  'Final exam',
  'Flexible grading: sit the midterm and this is worth 50%. Eligible students may skip it, and then this exam is worth 70%.');

select pg_temp.set_item_note('PHYS 205', 'Fall 2026', 'Final exam%',
  'Final exam',
  'Flexible grading: sit the midterm and this is worth 50%. Skip it and this exam is worth 75%.');

select pg_temp.set_item_note('COMM 214', 'Fall 2026', 'Final examination%',
  'Final examination',
  'You must score at least 50% on this exam to pass the course, whatever your overall average.');

select pg_temp.set_item_note('COMM 216', 'Fall 2026', 'Final exam%',
  'Final exam (in person)',
  'You must score at least 50% on this exam to pass the course, whatever your overall average.');

select pg_temp.set_item_note('COMM 226', 'Fall 2026', 'Final examination%',
  'Final examination (comprehensive)',
  'The outline contradicts itself on this weight — the evaluation table says 45% and the paragraph under it says 50%. The table is used here because it is the one that totals 100. Check with the instructor if it matters to your planning.');

select pg_temp.set_item_note('ENGR 391', 'Fall 2026', 'Final exam%',
  'Final exam',
  'Both your cumulative score and this exam must be above 50% to pass. Score under 40% before the final and skip it, and you receive an R grade, which cannot be deferred.');

select pg_temp.set_item_note('COMM 309', 'Fall 2026', 'Final Common Exam%',
  'Final Common Exam',
  'You must score at least 40% on this exam to pass the course.');

select pg_temp.set_item_note('COMM 305', 'Fall 2026', 'Midterm exam%',
  'Midterm exam',
  'On campus, in person, on paper. Covers meetings 1-5 and chapters 1-6. There is no make-up; with a valid reason your grade for it is taken from the final.');

-- Check: the notes are set and every scheme still totals 100.
--   select course_code,
--          (select sum((i->>'weight')::numeric) from jsonb_array_elements(items) i) total,
--          (select count(*) from jsonb_array_elements(items) i where i ? 'note') notes
--     from public.shared_blueprints
--    where term = 'Fall 2026' and author = 'Course outline'
--    order by course_code;
