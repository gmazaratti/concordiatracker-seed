-- Failed-syllabus review queue. db/parse_review.sql. Idempotent.
--
-- Every failed upload whose file was kept is QUEUED for review, automatically.
-- A retry of the same file (same SHA-256) supersedes the older entry, and a
-- later successful upload of the same file resolves it, so one syllabus is one
-- queue entry. The student may say "leave it for review" (review_requested_at),
-- which marks them as waiting. A reviewer (a human admin, or the assistant
-- identity through the API) previews, delivers into THAT student's course,
-- can undo a wrong delivery, or resolves it with a note; the student is told.
--
-- FILE ACCESS is narrowed here too. Stored uploads were readable by the owner
-- or ANY admin, and the assistant identity is an admin, so it could read every
-- upload. Now: the owner's own folder, a HUMAN admin (ct_admin_write), or the
-- assistant ONLY for a failed upload that is still queued.

alter table public.parse_events add column if not exists file_hash text;
alter table public.parse_events add column if not exists review_status text;
alter table public.parse_events add column if not exists review_requested_at timestamptz;
alter table public.parse_events add column if not exists resolved_at timestamptz;
alter table public.parse_events add column if not exists resolved_by uuid;
alter table public.parse_events add column if not exists resolution_note text;
alter table public.parse_events add column if not exists delivery jsonb;
alter table public.parse_events drop constraint if exists parse_events_review_status_ck;
alter table public.parse_events add constraint parse_events_review_status_ck
  check (review_status is null or review_status in ('queued', 'superseded', 'delivered', 'resolved'));
create index if not exists parse_events_review_idx on public.parse_events (review_status, created_at desc)
  where review_status is not null;

-- The meta writer learns the file's fingerprint.
create or replace function public.ct_parse_meta(p_event uuid, p_meta jsonb)
returns void language sql security definer set search_path to 'public' as $$
  update public.parse_events e set
    file_name   = coalesce(left(p_meta->>'file_name', 200), e.file_name),
    bytes       = coalesce((p_meta->>'bytes')::int, e.bytes),
    path        = coalesce(left(p_meta->>'path', 60), e.path),
    items       = coalesce((p_meta->>'items')::int, e.items),
    course_code = coalesce(left(p_meta->>'course_code', 20), e.course_code),
    duration_ms = coalesce((p_meta->>'duration_ms')::int, e.duration_ms),
    file_path   = coalesce(left(p_meta->>'file_path', 300), e.file_path),
    file_hash   = coalesce(left(p_meta->>'file_hash', 64), e.file_hash),
    source      = coalesce(left(p_meta->>'source', 20), e.source)
  where e.id = p_event and p_meta is not null;
$$;

-- ── The queue maintains itself ───────────────────────────────────────────
create or replace function public.ct_parse_review_queue()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- A failure with its file kept: queued, and it supersedes an older entry for
  -- the same file from the same student.
  if new.success is false and new.file_path is not null and new.review_status is null then
    new.review_status := 'queued';
    if new.file_hash is not null then
      update public.parse_events set review_status = 'superseded'
      where user_id = new.user_id and file_hash = new.file_hash and id <> new.id and review_status = 'queued';
    end if;
  end if;
  -- The same file later parsed fine: the old entries are done.
  if new.success is true and new.file_hash is not null then
    update public.parse_events
       set review_status = 'resolved', resolved_at = now(),
           resolution_note = 'The student uploaded it again and it worked.'
     where user_id = new.user_id and file_hash = new.file_hash and id <> new.id and review_status = 'queued';
  end if;
  return new;
end $$;

drop trigger if exists ct_parse_review_queue on public.parse_events;
create trigger ct_parse_review_queue
  before update of success, file_path, file_hash on public.parse_events
  for each row execute function public.ct_parse_review_queue();

-- Backfill: what is already failed with a file is queued, unless a retry
-- already handled it.
update public.parse_events set review_status = case
    when retry_status in ('succeeded', 'delivered') then 'resolved' else 'queued' end
where success is false and file_path is not null and review_status is null;

-- ── Who may review ───────────────────────────────────────────────────────
create or replace function public.ct_can_review_parse(p_event uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.ct_admin_write()
      or (public.ct_is_assistant() and exists (
            select 1 from public.parse_events e
            where e.id = p_event and e.success is false and e.review_status in ('queued', 'delivered')))
$$;

-- ── The student: "leave it for review" ───────────────────────────────────
create or replace function public.request_parse_review(p_event uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e record;
begin
  select id, user_id, success, file_path, review_status into e from public.parse_events where id = p_event;
  if e.id is null or e.user_id is distinct from auth.uid() then
    raise exception 'That upload was not found.' using errcode = 'P0002';
  end if;
  if e.file_path is null then
    return jsonb_build_object('queued', false);
  end if;
  update public.parse_events set review_requested_at = coalesce(review_requested_at, now())
  where id = p_event;
  return jsonb_build_object('queued', true);
end $$;
grant execute on function public.request_parse_review(uuid) to authenticated;

-- ── The queue, for reviewers ─────────────────────────────────────────────
create or replace function public.admin_parse_queue(p_status text default 'queued')
returns table (
  id uuid, created_at timestamptz, user_id uuid, name text, email text, handle text,
  file_name text, has_file boolean, error text, course_code text, review_status text,
  review_requested_at timestamptz, attempts int, resolved_at timestamptz, resolution_note text, delivery jsonb
)
language sql stable security definer set search_path = public, auth as $$
  select e.id, e.created_at, e.user_id, p.name, u.email::text, p.handle,
         e.file_name, e.file_path is not null, left(e.error, 300), e.course_code, e.review_status,
         e.review_requested_at,
         (select count(*)::int from public.parse_events x where x.user_id = e.user_id
            and x.file_hash is not null and x.file_hash = e.file_hash),
         e.resolved_at, e.resolution_note, e.delivery
  from public.parse_events e
  left join public.user_profile p on p.user_id = e.user_id
  left join auth.users u on u.id = e.user_id
  where (public.ct_admin_write() or public.ct_is_assistant())
    and e.review_status is not null
    and (p_status is null or e.review_status = p_status)
  order by (e.review_requested_at is not null) desc, e.created_at desc
  limit 200
$$;
grant execute on function public.admin_parse_queue(text) to authenticated;

-- ── Preview (read-only) ──────────────────────────────────────────────────
create or replace function public.parse_delivery_preview(p_event uuid, p_code text, p_term text, p_items jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_user uuid; v_course text; v_title text; v_credits real;
  v_add jsonb := '[]'; v_dup jsonb := '[]'; v_weight real := 0; v_undated int := 0;
  it jsonb; t text;
  v_term text := public.ct_normalize_term(btrim(coalesce(p_term, '')));
begin
  if not public.ct_can_review_parse(p_event) then raise exception 'Not authorized.' using errcode = '42501'; end if;
  select user_id into v_user from public.parse_events where id = p_event;
  select c.id, c.name into v_course, v_title from public.courses c
  where c.user_id = v_user and not c.archived
    and public.ct_norm_code(c.code) = public.ct_norm_code(p_code)
    and public.ct_normalize_term(coalesce(c.term, '')) = v_term limit 1;
  if v_course is null then
    select cc.title, cc.class_unit into v_title, v_credits from public.course_catalog cc
    where public.ct_norm_code(cc.subject || cc.catalog) = public.ct_norm_code(p_code) limit 1;
  end if;
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]')) loop
    t := btrim(coalesce(it->>'title', ''));
    continue when t = '';
    v_weight := v_weight + coalesce(nullif(it->>'weight', '')::real, 0);
    if coalesce(it->>'due', '') = '' then v_undated := v_undated + 1; end if;
    if v_course is not null and exists (select 1 from public.assignments a where a.course_id = v_course
        and a.user_id = v_user and not coalesce(a.deleted, false) and lower(btrim(a.title)) = lower(t)) then
      v_dup := v_dup || to_jsonb(t);
    else
      v_add := v_add || to_jsonb(t);
    end if;
  end loop;
  return jsonb_build_object('course_exists', v_course is not null, 'course_id', v_course,
    'course_title', v_title, 'credits', v_credits, 'term', v_term,
    'will_add', v_add, 'duplicates_skipped', v_dup, 'weight_total', v_weight, 'undated', v_undated);
end $$;
grant execute on function public.parse_delivery_preview(uuid, text, text, jsonb) to authenticated;

-- ── Delivery: one core, two doors ────────────────────────────────────────
create or replace function public.ct_deliver_parse_core(
  p_event uuid, p_code text, p_title text, p_term text, p_items jsonb, p_actor_kind text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid; v_status text;
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_term text := public.ct_normalize_term(btrim(coalesce(p_term, '')));
  v_course text; v_created boolean := false; v_credits real; v_title text;
  v_ids uuid[] := '{}'; v_id uuid; v_n int := 0;
  v_palette text[] := array['blue','teal','green','amber','orange','rose','purple','slate'];
  it jsonb; v_it text;
begin
  select user_id, review_status into v_user, v_status from public.parse_events where id = p_event;
  if v_user is null then raise exception 'No parse with that id.' using errcode = 'P0002'; end if;
  if v_status = 'delivered' then
    raise exception 'This syllabus was already added. Undo that delivery first to change it.' using errcode = '23505';
  end if;
  if v_code = '' then raise exception 'Give the course code.' using errcode = '22023'; end if;
  if v_term = '' then raise exception 'Give the term.' using errcode = '22023'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one assessment.' using errcode = '22023';
  end if;

  select c.id into v_course from public.courses c
  where c.user_id = v_user and not c.archived
    and public.ct_norm_code(c.code) = public.ct_norm_code(v_code)
    and public.ct_normalize_term(coalesce(c.term, '')) = v_term limit 1;
  if v_course is null then
    select cc.class_unit, cc.title into v_credits, v_title from public.course_catalog cc
    where public.ct_norm_code(cc.subject || cc.catalog) = public.ct_norm_code(v_code) limit 1;
    insert into public.courses (user_id, code, name, term, credits, color, origin, source)
    values (v_user, v_code, coalesce(nullif(btrim(p_title), ''), v_title, v_code), v_term,
            coalesce(v_credits, 3), v_palette[1 + (select count(*) from public.courses where user_id = v_user) % 8],
            'manual', 'syllabus')
    returning id into v_course;
    v_created := true;
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    v_it := btrim(coalesce(it->>'title', ''));
    continue when v_it = '';
    continue when exists (select 1 from public.assignments a where a.course_id = v_course and a.user_id = v_user
      and not coalesce(a.deleted, false) and lower(btrim(a.title)) = lower(v_it));
    insert into public.assignments (user_id, course_id, title, date, type, weight, notes, provenance_status, provenance_confirmations)
    values (v_user, v_course, left(v_it, 200), nullif(it->>'due', '')::timestamptz,
            coalesce(nullif(it->>'kind', ''), 'assignment'),
            greatest(0, least(100, coalesce(nullif(it->>'weight', '')::real, 0))), '', 'unverified', 0)
    returning id into v_id;
    v_ids := v_ids || v_id;
    v_n := v_n + 1;
  end loop;

  update public.parse_events set
    review_status = 'delivered', retry_status = 'delivered', resolved_at = now(), resolved_by = auth.uid(),
    retried_at = now(), retried_by = auth.uid(), retry_error = null,
    delivery = jsonb_build_object('course_id', v_course, 'assignment_ids', to_jsonb(v_ids), 'created_course', v_created, 'code', v_code)
  where id = p_event;

  perform public.ct_notify(array[v_user], 'parse_delivered', v_code || ': your syllabus is in',
    v_n || ' assessment' || case when v_n = 1 then '' else 's' end || ' from the syllabus you uploaded '
      || case when v_created then 'are in a new course.' else 'were added.' end || ' Check the dates and weights.',
    '/app/courses/' || v_course, null, 'ConcordiaTracker');

  insert into public.admin_audit_log (actor_id, actor_email, action, target_id, new_value, reason)
  values (auth.uid(), (select email from auth.users where id = auth.uid()),
          case when p_actor_kind = 'assistant' then 'assistant.parse.deliver' else 'parse.deliver' end,
          v_user, jsonb_build_object('parse_event', p_event, 'course_id', v_course, 'added', v_n, 'created_course', v_created),
          'Manual parse delivered: ' || v_code);

  return jsonb_build_object('course_id', v_course, 'added', v_n, 'created_course', v_created);
end $$;
revoke all on function public.ct_deliver_parse_core(uuid, text, text, text, jsonb, text) from public, anon, authenticated;

create or replace function public.admin_deliver_parse(p_event uuid, p_code text, p_title text, p_term text, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.ct_admin_write() then
    raise exception 'Only a human admin can deliver a parse.' using errcode = '42501';
  end if;
  return public.ct_deliver_parse_core(p_event, p_code, p_title, p_term, p_items, 'admin');
end $$;

create or replace function public.assistant_deliver_parse(p_event uuid, p_code text, p_title text, p_term text, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not (public.ct_is_assistant() and exists (select 1 from public.parse_events
          where id = p_event and success is false and review_status = 'queued')) then
    raise exception 'The assistant can only deliver failed uploads that are waiting for review.' using errcode = '42501';
  end if;
  return public.ct_deliver_parse_core(p_event, p_code, p_title, p_term, p_items, 'assistant');
end $$;
grant execute on function public.admin_deliver_parse(uuid, text, text, text, jsonb) to authenticated;
grant execute on function public.assistant_deliver_parse(uuid, text, text, text, jsonb) to authenticated;

-- ── Undo a wrong delivery, and resolve without one ───────────────────────
create or replace function public.undo_parse_delivery(p_event uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e record; v_removed int; v_course_gone boolean := false;
begin
  if not public.ct_can_review_parse(p_event) then raise exception 'Not authorized.' using errcode = '42501'; end if;
  select user_id, delivery, review_status into e from public.parse_events where id = p_event;
  if e.review_status is distinct from 'delivered' or e.delivery is null then
    raise exception 'There is no delivery to undo.' using errcode = '22023';
  end if;
  update public.assignments set deleted = true, deleted_at = now()
  where user_id = e.user_id
    and id in (select (jsonb_array_elements_text(e.delivery->'assignment_ids'))::uuid)
    and not coalesce(deleted, false);
  get diagnostics v_removed = row_count;
  if coalesce((e.delivery->>'created_course')::boolean, false) and not exists (
       select 1 from public.assignments a where a.course_id = e.delivery->>'course_id' and not coalesce(a.deleted, false)) then
    delete from public.courses where id = e.delivery->>'course_id' and user_id = e.user_id;
    v_course_gone := true;
  end if;
  update public.parse_events set review_status = 'queued', delivery = null, resolved_at = null, resolved_by = null,
    retry_status = null where id = p_event;
  insert into public.admin_audit_log (actor_id, actor_email, action, target_id, new_value, reason)
  values (auth.uid(), (select email from auth.users where id = auth.uid()),
          case when public.ct_is_assistant() then 'assistant.parse.undo' else 'parse.undo' end,
          e.user_id, jsonb_build_object('parse_event', p_event, 'removed', v_removed, 'course_removed', v_course_gone),
          'Manual parse delivery undone');
  return jsonb_build_object('removed', v_removed, 'course_removed', v_course_gone);
end $$;
grant execute on function public.undo_parse_delivery(uuid) to authenticated;

create or replace function public.resolve_parse_review(p_event uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_note text := left(btrim(coalesce(p_note, '')), 300);
begin
  if not public.ct_can_review_parse(p_event) then raise exception 'Not authorized.' using errcode = '42501'; end if;
  if v_note = '' then raise exception 'Say what happened, for the student.' using errcode = '22023'; end if;
  update public.parse_events set review_status = 'resolved', resolved_at = now(), resolved_by = auth.uid(),
    resolution_note = v_note where id = p_event and review_status = 'queued'
  returning user_id into v_user;
  if v_user is null then raise exception 'That upload is not waiting for review.' using errcode = '22023'; end if;
  perform public.ct_notify(array[v_user], 'parse_reviewed', 'We looked at your syllabus', v_note,
    '/app/courses', null, 'ConcordiaTracker');
  insert into public.admin_audit_log (actor_id, actor_email, action, target_id, new_value, reason)
  values (auth.uid(), (select email from auth.users where id = auth.uid()),
          case when public.ct_is_assistant() then 'assistant.parse.resolve' else 'parse.resolve' end,
          v_user, jsonb_build_object('parse_event', p_event), v_note);
end $$;
grant execute on function public.resolve_parse_review(uuid, text) to authenticated;

-- ── Stored files: least privilege ────────────────────────────────────────
-- A SECURITY DEFINER helper, because a storage policy runs as the caller, who
-- cannot see other students' parse_events rows.
create or replace function public.ct_assistant_may_read_upload(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.ct_is_assistant() and exists (
    select 1 from public.parse_events e
    where e.file_path = p_name and e.success is false and e.review_status = 'queued')
$$;
grant execute on function public.ct_assistant_may_read_upload(text) to authenticated;

drop policy if exists parse_failures_read on storage.objects;
create policy parse_failures_read on storage.objects for select to authenticated using (
  bucket_id = 'parse-failures' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.ct_admin_write()
    or public.ct_assistant_may_read_upload(name)
  )
);
