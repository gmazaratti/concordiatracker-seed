-- Syllabus uploads: every one kept for 30 days, and an admin can deliver a
-- parse by hand. db/parse_uploads.sql. Idempotent.
--
-- 1. finish_parse now keeps the stored file's path on SUCCESS too (it used to
--    drop it on purpose), under the same rule fail_parse enforces: the file
--    must live in the caller's own folder. The daily cleanup already deletes
--    any upload older than 30 days, successful or not.
-- 2. admin_deliver_parse: an admin reads a student's upload, enters or fixes
--    the assessments, and puts them straight into that student's course
--    (created if they do not have it that term), then the student is told.

create or replace function public.finish_parse(p_event uuid, p_meta jsonb default null::jsonb)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  update public.parse_events set success = true, finished_at = now()
   where id = p_event and user_id = auth.uid() and success is null;
  if found then
    -- A stored file must live under the caller's own folder: the path is the
    -- only thing tying the file to them, and an admin reads it.
    if p_meta ? 'file_path' and (p_meta->>'file_path') not like auth.uid()::text || '/%' then
      p_meta := p_meta - 'file_path';
    end if;
    perform public.ct_parse_meta(p_event, p_meta);
  end if;
end $$;

create or replace function public.admin_deliver_parse(
  p_event uuid,
  p_code text,
  p_title text,
  p_term text,
  p_items jsonb
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_term text := public.ct_normalize_term(btrim(coalesce(p_term, '')));
  v_course text;
  v_created boolean := false;
  v_credits real;
  v_title text;
  v_n int := 0;
  v_palette text[] := array['blue','teal','green','amber','orange','rose','purple','slate'];
  it jsonb;
  v_it_title text;
begin
  if not public.ct_admin_write() then
    raise exception 'Only a human admin can deliver a parse.' using errcode = '42501';
  end if;
  select user_id into v_user from public.parse_events where id = p_event;
  if v_user is null then raise exception 'No parse with that id.' using errcode = 'P0002'; end if;
  if v_code = '' then raise exception 'Give the course code.' using errcode = '22023'; end if;
  if v_term is null or v_term = '' then raise exception 'Give the term.' using errcode = '22023'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one assessment.' using errcode = '22023';
  end if;

  -- The course they already have for that code and term, else a new one.
  select c.id into v_course from public.courses c
  where c.user_id = v_user and not c.archived
    and public.ct_norm_code(c.code) = public.ct_norm_code(v_code)
    and public.ct_normalize_term(coalesce(c.term, '')) = v_term
  limit 1;

  if v_course is null then
    select cc.class_unit, cc.title into v_credits, v_title from public.course_catalog cc
    where public.ct_norm_code(cc.subject || cc.catalog) = public.ct_norm_code(v_code)
    limit 1;
    insert into public.courses (user_id, code, name, term, credits, color, origin, source)
    values (
      v_user, v_code,
      coalesce(nullif(btrim(p_title), ''), v_title, v_code),
      v_term, coalesce(v_credits, 3),
      v_palette[1 + (select count(*) from public.courses where user_id = v_user) % 8],
      'manual', 'syllabus')
    returning id into v_course;
    v_created := true;
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    v_it_title := btrim(coalesce(it->>'title', ''));
    continue when v_it_title = '';
    -- Already on their list (same title in this course): not added twice.
    continue when exists (
      select 1 from public.assignments a
      where a.course_id = v_course and a.user_id = v_user and not coalesce(a.deleted, false)
        and lower(btrim(a.title)) = lower(v_it_title));
    insert into public.assignments (user_id, course_id, title, date, type, weight, notes, provenance_status, provenance_confirmations)
    values (
      v_user, v_course, left(v_it_title, 200),
      nullif(it->>'due', '')::timestamptz,
      coalesce(nullif(it->>'kind', ''), 'assignment'),
      greatest(0, least(100, coalesce(nullif(it->>'weight', '')::real, 0))),
      '', 'unverified', 0);
    v_n := v_n + 1;
  end loop;

  update public.parse_events
     set retry_status = 'delivered', retried_at = now(), retried_by = auth.uid(), retry_error = null
   where id = p_event;

  perform public.ct_notify(
    array[v_user], 'parse_delivered',
    v_code || ': your syllabus is in',
    v_n || ' assessment' || case when v_n = 1 then '' else 's' end
      || ' from the syllabus you uploaded ' || case when v_created then 'are in a new course.' else 'were added.' end
      || ' Check the dates and weights.',
    '/app/courses/' || v_course, null, 'ConcordiaTracker');

  perform public.log_admin_action('parse.deliver', v_user, 'Manual parse delivered: ' || v_code, null,
    jsonb_build_object('course_id', v_course, 'added', v_n, 'created_course', v_created, 'parse_event', p_event));

  return jsonb_build_object('course_id', v_course, 'added', v_n, 'created_course', v_created);
end $$;
grant execute on function public.admin_deliver_parse(uuid, text, text, text, jsonb) to authenticated;

-- What an admin Retry read, to pre-fill the manual editor. Admin-only.
create or replace function public.admin_parse_retry_result(p_event uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then (select retry_result from public.parse_events where id = p_event) end
$$;
grant execute on function public.admin_parse_retry_result(uuid) to authenticated;
