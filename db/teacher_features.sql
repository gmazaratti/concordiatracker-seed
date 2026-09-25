-- Teacher features, database half. Idempotent; safe to re-run.
--
--   1. A published outline stays LINKED to the copies students imported, and
--      a republish updates them (and tells them).
--   2. Posting an announcement notifies the students taking that course.
--   3. TAs: a professor adds a TA by email; the TA can edit the draft outline
--      (the professor still publishes).
--   4. A teacher whose Google account is verified @concordia.ca is approved on
--      sight; everyone else waits, and the admins are told somebody is waiting.

-- ── 1. Imported items remember where they came from ─────────────────────
alter table public.assignments add column if not exists source_blueprint uuid;
alter table public.assignments add column if not exists source_item text;
-- What the teacher changed, as it was BEFORE the change, until the student
-- acknowledges it ({due, title, weight}, only the keys that changed).
alter table public.assignments add column if not exists teacher_prev jsonb;
alter table public.assignments add column if not exists teacher_changed_at timestamptz;
create index if not exists assignments_source_idx
  on public.assignments (source_blueprint, source_item) where source_blueprint is not null;

-- The teacher's outline is the official source, so a republish is applied,
-- not suggested: the student's copy moves, and `teacher_prev` keeps the old
-- value for the "your teacher moved this" card. The FIRST old value is kept
-- if it changes twice before the student looks, because that is what they
-- last saw. Grades, status and notes are never touched.
create or replace function public.ct_propagate_blueprint()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  it jsonb;
  nd timestamptz;
  nt text;
  nw real;
  touched uuid[] := '{}';
  users uuid[];
begin
  if not new.verified or new.items is not distinct from old.items then
    return new;
  end if;
  for it in select * from jsonb_array_elements(coalesce(new.items, '[]'::jsonb)) loop
    continue when coalesce(it->>'id', '') = '';
    nd := nullif(it->>'due', '')::timestamptz;
    nt := coalesce(it->>'title', it->>'name');
    nw := nullif(it->>'weight', '')::real;
    with upd as (
      update public.assignments a set
        teacher_prev = coalesce(a.teacher_prev, '{}'::jsonb)
          || case when a.date is distinct from nd and not (coalesce(a.teacher_prev, '{}'::jsonb) ? 'due')
                  then jsonb_build_object('due', a.date) else '{}'::jsonb end
          || case when nt is not null and a.title is distinct from nt and not (coalesce(a.teacher_prev, '{}'::jsonb) ? 'title')
                  then jsonb_build_object('title', a.title) else '{}'::jsonb end
          || case when nw is not null and a.weight is distinct from nw and not (coalesce(a.teacher_prev, '{}'::jsonb) ? 'weight')
                  then jsonb_build_object('weight', a.weight) else '{}'::jsonb end,
        date = nd,
        title = coalesce(nt, a.title),
        weight = coalesce(nw, a.weight),
        teacher_changed_at = now()
      where a.source_blueprint = new.id
        and a.source_item = it->>'id'
        and not coalesce(a.deleted, false)
        and (a.date is distinct from nd
             or (nt is not null and a.title is distinct from nt)
             or (nw is not null and a.weight is distinct from nw))
      returning a.user_id
    )
    select touched || coalesce(array_agg(user_id), '{}') into touched from upd;
  end loop;

  select array_agg(distinct u) into users from unnest(touched) u;
  if users is not null then
    perform public.ct_notify(
      users, 'teacher_outline',
      new.course_code || ': your teacher updated the outline',
      'Dates or weights changed. Open the course to see what moved.',
      '/app/courses', null, nullif(new.author, ''));
  end if;
  return new;
end $$;

drop trigger if exists ct_propagate_blueprint on public.shared_blueprints;
create trigger ct_propagate_blueprint
  after update of items on public.shared_blueprints
  for each row execute function public.ct_propagate_blueprint();

-- ── 2. Announcements reach the students taking the course ────────────────
create or replace function public.ct_on_announcement()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  users uuid[];
begin
  select array_agg(distinct c.user_id) into users
  from public.courses c
  where public.ct_norm_code(c.code) = public.ct_norm_code(new.course_code)
    and not coalesce(c.archived, false)
    and c.user_id is distinct from new.author_id;
  if users is not null then
    perform public.ct_notify(
      users, 'announcement',
      new.course_code || ': ' || new.title,
      left(coalesce(new.body, ''), 160),
      '/app', null, nullif(new.author_name, ''));
  end if;
  return new;
end $$;

drop trigger if exists ct_on_announcement on public.announcements;
create trigger ct_on_announcement
  after insert on public.announcements
  for each row execute function public.ct_on_announcement();

-- ── 3. TAs ───────────────────────────────────────────────────────────────
create table if not exists public.teacher_course_tas (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.teacher_courses (id) on delete cascade,
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  user_id uuid references auth.users (id) on delete set null,
  added_at timestamptz not null default now()
);
create unique index if not exists teacher_course_tas_one
  on public.teacher_course_tas (course_id, lower(email));

alter table public.teacher_course_tas enable row level security;
drop policy if exists tas_owner_all on public.teacher_course_tas;
create policy tas_owner_all on public.teacher_course_tas for all to authenticated
  using (exists (select 1 from public.teacher_courses t where t.id = course_id and t.user_id = auth.uid()))
  with check (exists (select 1 from public.teacher_courses t where t.id = course_id and t.user_id = auth.uid()));
drop policy if exists tas_self_read on public.teacher_course_tas;
create policy tas_self_read on public.teacher_course_tas for select to authenticated
  using (user_id = auth.uid());

-- The courses you help with. Claims any invitation addressed to your
-- account's email first, so a TA only has to sign in.
create or replace function public.my_ta_courses()
returns table (id uuid, code text, title text, section text, outline jsonb, published boolean, owner_name text)
language plpgsql security definer set search_path = public, auth as $$
declare
  me uuid := auth.uid();
  my_email text;
begin
  if me is null then return; end if;
  select lower(u.email) into my_email from auth.users u where u.id = me;
  if my_email is not null then
    update public.teacher_course_tas set user_id = me
    where user_id is null and lower(email) = my_email;
  end if;
  return query
    select t.id, t.code, t.title, t.section, coalesce(t.outline, '[]'::jsonb), coalesce(t.published, false),
           coalesce(ta.name, '')
    from public.teacher_course_tas x
    join public.teacher_courses t on t.id = x.course_id
    left join public.teacher_accounts ta on ta.user_id = t.user_id
    where x.user_id = me and t.user_id <> me
    order by t.code;
end $$;

-- A TA edits the draft. Publishing stays with the professor, whose name the
-- verified outline carries.
create or replace function public.ta_update_outline(p_course uuid, p_outline jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.teacher_course_tas where course_id = p_course and user_id = auth.uid()) then
    raise exception 'You are not a TA on this course.';
  end if;
  if jsonb_typeof(p_outline) <> 'array' then raise exception 'Outline must be a list.'; end if;
  update public.teacher_courses set outline = p_outline where id = p_course;
  return true;
end $$;

grant execute on function public.my_ta_courses() to authenticated;
grant execute on function public.ta_update_outline(uuid, jsonb) to authenticated;

-- ── 4. Approval: verified @concordia.ca Google accounts on sight ─────────
-- Only a GOOGLE identity whose email Google has verified, on exactly
-- concordia.ca. Not an email/password account (sign-up does not verify the
-- address here), not student addresses (@live.concordia.ca), not other
-- subdomains. Everyone else is reviewed by an admin as before.
create or replace function public.ct_trusted_concordia_teacher(p_user uuid)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1 from auth.identities i
    where i.user_id = p_user
      and i.provider = 'google'
      and split_part(lower(i.identity_data->>'email'), '@', 2) = 'concordia.ca'
      and coalesce((i.identity_data->>'email_verified')::boolean, false)
  )
$$;

create or replace function public.ct_guard_teacher_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := case when public.ct_trusted_concordia_teacher(new.user_id) then 'approved' else 'pending' end;
  else
    new.status := old.status;
    new.user_id := old.user_id;
  end if;
  return new;
end $$;

-- Tell the (human) admins somebody is waiting.
create or replace function public.ct_on_teacher_pending()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  admins_ uuid[];
begin
  if new.status <> 'pending' then return new; end if;
  select array_agg(a.user_id) into admins_ from public.admins a
  where not exists (select 1 from public.agent_accounts g where g.user_id = a.user_id);
  if admins_ is not null then
    perform public.ct_notify(
      admins_, 'teacher_pending',
      'A teacher is waiting for approval',
      coalesce(nullif(new.name, ''), 'Someone') || ' (' || coalesce(new.email, 'no email') || ')',
      '/admin?tab=portals', null, null);
  end if;
  return new;
end $$;

drop trigger if exists ct_on_teacher_pending on public.teacher_accounts;
create trigger ct_on_teacher_pending
  after insert on public.teacher_accounts
  for each row execute function public.ct_on_teacher_pending();
