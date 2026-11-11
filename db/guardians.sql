-- Family access (2026-11-10): a student lets a parent or guardian SEE their
-- courses and deadlines. The student starts it, chooses what is shared, and
-- can end it at any time. Nothing here lets anyone edit the student's data,
-- and nothing social is ever shared.
--
--   guardian_links   one row per invite. `guardian` is null until accepted.
--   can_see_grades   off by default: a grade is the student's to share.
--   can_see_schedule saved schedules from the schedule builder.
--
-- RLS: select for the student and the linked guardian only. NO write policies:
-- every change is a function below that checks who is asking.

create table if not exists public.guardian_links (
  id               uuid primary key default gen_random_uuid(),
  student          uuid not null references auth.users(id) on delete cascade,
  guardian         uuid references auth.users(id) on delete cascade,
  invite_email     text,
  label            text,
  token            text not null unique,
  status           text not null default 'pending' check (status in ('pending', 'active', 'revoked')),
  can_see_grades   boolean not null default false,
  can_see_schedule boolean not null default false,
  created_at       timestamptz not null default now(),
  accepted_at      timestamptz,
  expires_at       timestamptz not null default now() + interval '14 days'
);
create index if not exists guardian_links_student_idx on public.guardian_links (student);
create index if not exists guardian_links_guardian_idx on public.guardian_links (guardian);

alter table public.guardian_links enable row level security;
drop policy if exists guardian_links_read on public.guardian_links;
create policy guardian_links_read on public.guardian_links
  for select using (student = auth.uid() or guardian = auth.uid());

-- The student invites. At most 4 open links; returns the token for the link.
create or replace function public.invite_guardian(p_email text, p_label text default null)
returns table (id uuid, token text)
language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  if v_uid is null then raise exception 'Sign in first.'; end if;
  if (select count(*) from public.guardian_links g where g.student = v_uid and g.status <> 'revoked') >= 4 then
    raise exception 'You can have up to 4 people with family access. Remove one first.';
  end if;
  return query
    insert into public.guardian_links (student, invite_email, label, token)
    values (v_uid, nullif(lower(trim(p_email)), ''), nullif(trim(p_label), ''), v_token)
    returning guardian_links.id, guardian_links.token;
end $$;

-- What an invite link is, before accepting it (shown on the join page).
create or replace function public.guardian_invite_info(p_token text)
returns table (student_name text, status text, expired boolean, mine boolean)
language sql security definer set search_path to 'public' stable as $$
  select coalesce(p.name, 'A student'), g.status, g.expires_at < now(), g.student = auth.uid()
    from public.guardian_links g
    left join public.user_profile p on p.user_id = g.student
   where g.token = p_token
$$;

create or replace function public.accept_guardian_invite(p_token text)
returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  v_link public.guardian_links%rowtype;
begin
  if v_uid is null then raise exception 'Sign in first.'; end if;
  select * into v_link from public.guardian_links where token = p_token for update;
  if not found then raise exception 'That invite link is not valid.'; end if;
  if v_link.student = v_uid then raise exception 'This is your own invite. Send the link to your parent.'; end if;
  if v_link.status = 'revoked' then raise exception 'That invite was cancelled.'; end if;
  if v_link.status = 'active' and v_link.guardian <> v_uid then raise exception 'That invite was already used.'; end if;
  if v_link.status = 'pending' and v_link.expires_at < now() then raise exception 'That invite has expired. Ask for a new one.'; end if;
  update public.guardian_links set guardian = v_uid, status = 'active', accepted_at = coalesce(accepted_at, now())
   where id = v_link.id;
  perform public.ct_notify(array[v_link.student], 'guardian_joined', 'Family access is on',
    'Someone you invited can now see your courses and deadlines. Manage it in Settings, Family.',
    '/app?settings=family', null, 'ConcordiaTracker');
  return v_link.student;
end $$;

-- The student changes what is shared. Either side can end the link.
create or replace function public.set_guardian_access(p_id uuid, p_grades boolean, p_schedule boolean)
returns void language sql security definer set search_path to 'public' as $$
  update public.guardian_links set can_see_grades = p_grades, can_see_schedule = p_schedule
   where id = p_id and student = auth.uid()
$$;

create or replace function public.end_guardian_link(p_id uuid)
returns void language sql security definer set search_path to 'public' as $$
  update public.guardian_links set status = 'revoked'
   where id = p_id and (student = auth.uid() or guardian = auth.uid())
$$;

-- The guardian's list of students.
create or replace function public.my_guarded_students()
returns table (student uuid, name text, can_see_grades boolean, can_see_schedule boolean)
language sql security definer set search_path to 'public' stable as $$
  select g.student, coalesce(p.name, 'Student'), g.can_see_grades, g.can_see_schedule
    from public.guardian_links g
    left join public.user_profile p on p.user_id = g.student
   where g.guardian = auth.uid() and g.status = 'active'
$$;

-- Everything a guardian may see, in one read, only through an active link.
-- Grades and saved schedules only when the student switched them on.
create or replace function public.guardian_view(p_student uuid)
returns jsonb
language plpgsql security definer set search_path to 'public' stable as $$
declare
  v_link public.guardian_links%rowtype;
begin
  select * into v_link from public.guardian_links
   where student = p_student and guardian = auth.uid() and status = 'active';
  if not found then raise exception 'You do not have access to this student.'; end if;
  return jsonb_build_object(
    'name', (select coalesce(name, 'Student') from public.user_profile where user_id = p_student),
    'grades', v_link.can_see_grades,
    'schedule', v_link.can_see_schedule,
    'courses', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'code', c.code, 'name', c.name, 'term', c.term, 'credits', c.credits,
        'time', c.time, 'location', c.location, 'color', c.color,
        'final', case when v_link.can_see_grades then c.final_percent end,
        'archived', c.archived
      ) order by c.archived, c.code), '[]'::jsonb)
      from public.courses c where c.user_id = p_student),
    'assessments', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id, 'course', a.course_id, 'title', a.title, 'kind', a.type,
        'weight', a.weight, 'due', a.date, 'status', a.status, 'no_date', a.no_date,
        'score', case when v_link.can_see_grades then a.score end,
        'raw_score', case when v_link.can_see_grades then a.raw_score end,
        'raw_total', case when v_link.can_see_grades then a.raw_total end
      ) order by a.date nulls last), '[]'::jsonb)
      from public.assignments a
      join public.courses c on c.id = a.course_id and not c.archived
     where a.user_id = p_student and not a.deleted),
    'schedules', case when v_link.can_see_schedule then (select coalesce(jsonb_agg(jsonb_build_object(
        'name', s.name, 'term_code', s.term_code, 'sections', s.sections
      ) order by s.updated_at desc), '[]'::jsonb) from public.saved_schedules s where s.user_id = p_student)
      else '[]'::jsonb end
  );
end $$;

revoke all on function public.invite_guardian(text, text) from public, anon;
revoke all on function public.guardian_invite_info(text) from public;
revoke all on function public.accept_guardian_invite(text) from public, anon;
revoke all on function public.set_guardian_access(uuid, boolean, boolean) from public, anon;
revoke all on function public.end_guardian_link(uuid) from public, anon;
revoke all on function public.my_guarded_students() from public, anon;
revoke all on function public.guardian_view(uuid) from public, anon;
grant execute on function public.invite_guardian(text, text) to authenticated;
grant execute on function public.guardian_invite_info(text) to anon, authenticated;
grant execute on function public.accept_guardian_invite(text) to authenticated;
grant execute on function public.set_guardian_access(uuid, boolean, boolean) to authenticated;
grant execute on function public.end_guardian_link(uuid) to authenticated;
grant execute on function public.my_guarded_students() to authenticated;
grant execute on function public.guardian_view(uuid) to authenticated;
