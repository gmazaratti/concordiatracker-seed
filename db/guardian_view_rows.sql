-- guardian_view, v2 (2026-11-11): return the student's courses and
-- assignments in the SAME row shape the app reads (courses.*, assignments.*),
-- so the family view runs them through the app's own adapters and grade maths
-- and a parent can never see a different number from the student.
--
-- What is removed, always: the student's private per-assessment notes, and
-- the reminder settings. What is removed unless the student turned grades on:
-- every grade field, on assignments and on finished courses.
-- Archived (finished) courses are included now, so the GPA can be computed
-- the same way it is for the student.

create or replace function public.guardian_view(p_student uuid)
returns jsonb
language plpgsql security definer set search_path to 'public' stable as $$
declare
  v_link public.guardian_links%rowtype;
  hide_grades text[] := array['score', 'raw_score', 'raw_total'];
begin
  select * into v_link from public.guardian_links
   where student = p_student and guardian = auth.uid() and status = 'active';
  if not found then raise exception 'You do not have access to this student.'; end if;
  return jsonb_build_object(
    'name', (select coalesce(name, 'Student') from public.user_profile where user_id = p_student),
    'avatar', (select avatar_url from public.user_profile where user_id = p_student),
    'grades', v_link.can_see_grades,
    'schedule', v_link.can_see_schedule,
    'course_rows', (select coalesce(jsonb_agg(
        case when v_link.can_see_grades then to_jsonb(c)
             else to_jsonb(c) - 'final_percent' - 'final_letter' end
        - 'user_id'
      order by c.archived, c.code), '[]'::jsonb)
      from public.courses c where c.user_id = p_student),
    'assignment_rows', (select coalesce(jsonb_agg(
        case when v_link.can_see_grades then to_jsonb(a)
             else to_jsonb(a) - hide_grades end
        - 'notes' - 'reminders' - 'user_id'
      order by a.date nulls last), '[]'::jsonb)
      from public.assignments a where a.user_id = p_student and not a.deleted),
    'schedules', case when v_link.can_see_schedule then (select coalesce(jsonb_agg(jsonb_build_object(
        'name', s.name, 'term_code', s.term_code, 'sections', s.sections
      ) order by s.updated_at desc), '[]'::jsonb) from public.saved_schedules s where s.user_id = p_student)
      else '[]'::jsonb end
  );
end $$;

revoke all on function public.guardian_view(uuid) from public, anon;
grant execute on function public.guardian_view(uuid) to authenticated;
