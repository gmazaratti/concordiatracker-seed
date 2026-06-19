-- ============================================================================
-- Admin console — schema + admin-access layer. DEV PROJECT ONLY.
-- RUN IN: concordiatracker-dev → SQL Editor → paste → Run.  (NOT production.)
--
-- WHY THIS EXISTS: every app table has per-user RLS ("own rows only"), and the
-- client has no service-role key (correctly). So the admin console reads/writes
-- across users ONLY through SECURITY DEFINER functions gated on is_admin(). The
-- portals keep their own-rows RLS untouched and never call these → their privacy
-- walls stay intact by construction.
--
-- Sections: (1) admin layer  (2) user_profile columns + vanity  (3) vanity
-- generator  (4) blueprint-permission RLS  (5) access_requests  (6) org_members
-- (7) bug_reports  (8) admin RPCs  (9) grants.
-- ============================================================================

-- ── 1. Admin layer ───────────────────────────────────────────────────────────
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
drop policy if exists "admins_read_own" on public.admins;
create policy "admins_read_own" on public.admins for select using (auth.uid() = user_id);

-- Seed YOU as the platform admin (looked up by email — robust to uid changes).
insert into public.admins (user_id)
select id from auth.users where email = 'alexxdegryse@gmail.com'
on conflict (user_id) do nothing;

-- Used inside every admin function (and callable by the app to gate the UI).
create or replace function public.is_admin() returns boolean
  language sql security definer stable set search_path = public as $$
    select exists (select 1 from public.admins where user_id = auth.uid());
  $$;

-- ── 2. user_profile: admin columns + vanity ─────────────────────────────────
alter table public.user_profile
  add column if not exists admin_notes            text,
  add column if not exists can_upload_blueprints  boolean not null default true,
  add column if not exists plan_expires_at         timestamptz,
  add column if not exists vanity_code             text,
  add column if not exists referred_by_code        text;   -- signup attribution

-- One profile row per user. Older sign-in races left duplicate rows (user_id was
-- never unique), which breaks the per-user vanity assignment. Keep the most
-- recent row per user, delete the rest, then enforce uniqueness going forward.
delete from public.user_profile a using public.user_profile b
  where a.user_id = b.user_id and (a.created_at, a.id) < (b.created_at, b.id);
create unique index if not exists user_profile_user_id_uidx on public.user_profile (user_id);

create unique index if not exists user_profile_vanity_uidx
  on public.user_profile (vanity_code) where vanity_code is not null;

-- ── 3. Vanity code generator (unambiguous alphabet + blocklist + uniqueness) ──
-- Alphabet excludes lookalikes 0/O, 1/I/L. Blocklist filters OUR OWN output so a
-- generated code never spells something offensive (regenerate if it does).
create or replace function public.gen_vanity_code(p_len int default 7) returns text
  language plpgsql volatile as $$
  declare
    alphabet  text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    blocklist text[] := array['FUC','FUK','SHT','SHI','CNT','CUM','SEX','ASS','FAG',
                              'NIG','DIE','KKK','XXX','POO','PEE','TIT','DCK','PRN','RAP'];
    code text; i int; bl text; bad boolean;
  begin
    loop
      code := '';
      for i in 1..p_len loop
        code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
      end loop;
      bad := false;
      foreach bl in array blocklist loop
        if position(bl in code) > 0 then bad := true; exit; end if;
      end loop;
      if not bad then return code; end if;
    end loop;
  end;
  $$;

-- Assign a unique code to a user — BULLETPROOF: targets ONE row by primary key
-- (immune to duplicate profile rows), pre-checks for a free code (never relies on
-- catching a unique violation), and grows the length if the space is ever crowded.
create or replace function public.ensure_vanity_code(p_uid uuid) returns text
  language plpgsql security definer set search_path = public as $$
  declare target_id uuid; c text; len int := 7; attempts int := 0;
  begin
    select id, vanity_code into target_id, c
      from public.user_profile where user_id = p_uid order by created_at desc limit 1;
    if target_id is null then return null; end if;
    if c is not null then return c; end if;
    loop
      c := public.gen_vanity_code(len);
      if not exists (select 1 from public.user_profile where vanity_code = c) then
        update public.user_profile set vanity_code = c where id = target_id;
        return c;
      end if;
      attempts := attempts + 1;
      if attempts % 25 = 0 then len := len + 1; end if;
      if attempts > 500 then raise exception 'could not allocate a vanity code'; end if;
    end loop;
  end;
  $$;

-- Auto-assign on new profile insert (same free-code-then-grow strategy).
create or replace function public.set_vanity_on_insert() returns trigger
  language plpgsql security definer set search_path = public as $$
  declare len int := 7; attempts int := 0;
  begin
    if new.vanity_code is null then
      loop
        new.vanity_code := public.gen_vanity_code(len);
        exit when not exists (select 1 from public.user_profile where vanity_code = new.vanity_code);
        attempts := attempts + 1;
        if attempts % 25 = 0 then len := len + 1; end if;
        exit when attempts > 200;
      end loop;
    end if;
    return new;
  end;
  $$;
drop trigger if exists user_profile_vanity on public.user_profile;
create trigger user_profile_vanity before insert on public.user_profile
  for each row execute function public.set_vanity_on_insert();

-- Backfill every existing user — skip-and-continue so one bad row can't abort it.
do $$ declare r record; begin
  for r in select distinct user_id from public.user_profile where vanity_code is null loop
    begin
      perform public.ensure_vanity_code(r.user_id);
    exception when others then
      raise notice 'vanity skip for %: %', r.user_id, sqlerrm;
    end;
  end loop;
end $$;

-- ── 4. Blueprint-upload permission → enforce in shared_blueprints RLS ─────────
-- Revoking can_upload_blueprints actually blocks that user's inserts.
drop policy if exists "blueprints_insert_own" on public.shared_blueprints;
create policy "blueprints_insert_own" on public.shared_blueprints for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.user_profile p
                where p.user_id = auth.uid() and coalesce(p.can_upload_blueprints, true))
  );

-- ── 5. access_requests (self-serve teacher/organizer applications) ───────────
create sequence if not exists access_request_case_seq start 1044;
create table if not exists public.access_requests (
  id         uuid primary key default gen_random_uuid(),
  case_id    text unique not null default ('REQ-' || nextval('access_request_case_seq')),
  user_id    uuid references auth.users(id) on delete set null,
  role       text not null,                       -- teacher | organizer
  name       text not null,
  email      text not null,
  message    text default '',
  status     text not null default 'pending',     -- pending | accepted | denied
  created_at timestamptz not null default now()
);
alter table public.access_requests enable row level security;
drop policy if exists "req_insert"   on public.access_requests;
drop policy if exists "req_read_own" on public.access_requests;
create policy "req_insert"   on public.access_requests for insert with check (true);
create policy "req_read_own" on public.access_requests for select using (auth.uid() = user_id);
-- (admins read/manage ALL via the RPCs below.)

insert into public.access_requests (role, name, email, message, status)
select v.role, v.name, v.email, v.message, v.status from (values
  ('teacher',   'Dr. Lila Moreau', 'lila.moreau@concordia.ca', 'I teach COMP 352 and want to publish my outline.', 'pending'),
  ('organizer', 'Robotics Club',   'team@conurobotics.ca',     'Student robotics club — we run weekly builds + a comp.', 'pending')
) as v(role, name, email, message, status)
where not exists (select 1 from public.access_requests ar where ar.email = v.email);

-- ── 6. org_members (real team membership — backs the organizer Team feature) ─
create table if not exists public.org_members (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete set null,
  name         text,
  email        text,
  role         text not null default 'member',    -- owner | admin | member
  status       text not null default 'active',    -- active | invited
  invite_token text unique,
  joined_at    timestamptz,
  created_at   timestamptz not null default now()
);
alter table public.org_members enable row level security;
drop policy if exists "org_members_read"  on public.org_members;
drop policy if exists "org_members_write" on public.org_members;
-- The org owner manages their team; an invite token can be read to accept it.
create policy "org_members_read" on public.org_members for select using (
  invite_token is not null
  or exists (select 1 from public.organizations o where o.id = org_id and o.owner_id = auth.uid())
);
create policy "org_members_write" on public.org_members for all using (
  exists (select 1 from public.organizations o where o.id = org_id and o.owner_id = auth.uid())
) with check (
  exists (select 1 from public.organizations o where o.id = org_id and o.owner_id = auth.uid())
);

-- ── 7. bug_reports ───────────────────────────────────────────────────────────
create table if not exists public.bug_reports (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  user_email  text,
  title       text not null,
  description text default '',
  page        text,
  status      text not null default 'open',        -- open | in-progress | resolved | wont-fix
  admin_notes text,
  created_at  timestamptz not null default now()
);
alter table public.bug_reports enable row level security;
drop policy if exists "bugs_insert"   on public.bug_reports;
drop policy if exists "bugs_read_own"  on public.bug_reports;
create policy "bugs_insert"   on public.bug_reports for insert with check (true);
create policy "bugs_read_own" on public.bug_reports for select using (auth.uid() = user_id);
-- (admins read/manage ALL via the RPCs below.)

insert into public.bug_reports (user_email, title, description, page, status)
select v.user_email, v.title, v.description, v.page, v.status from (values
  ('senjifps@gmail.com', 'Calendar week view scrolls oddly on mobile', 'On a narrow screen the week columns overflow before snapping back.', '/app/calendar', 'open'),
  ('alexxdegryse@gmail.com', 'Blueprint import dates off by a day', 'A few imported assignments landed one day earlier than the syllabus.', '/app/courses/blueprints', 'in-progress')
) as v(user_email, title, description, page, status)
where not exists (select 1 from public.bug_reports b where b.title = v.title);

-- ── 8. Admin RPCs (all gated on is_admin()) ──────────────────────────────────
-- USERS -----------------------------------------------------------------------
create or replace function public.admin_list_users()
returns table (
  user_id uuid, name text, email text, created_at timestamptz, role text,
  plan_status text, plan_expires_at timestamptz, admin_notes text,
  can_upload_blueprints boolean, vanity_code text, referred_by_code text,
  course_count bigint, assignment_count bigint, following_count bigint, signups_attributed bigint
) language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return query
    select p.user_id, p.name, p.email, p.created_at, p.role,
           p.plan_status, p.plan_expires_at, p.admin_notes,
           coalesce(p.can_upload_blueprints, true), p.vanity_code, p.referred_by_code,
           (select count(*) from public.courses c where c.user_id = p.user_id),
           (select count(*) from public.assignments a where a.user_id = p.user_id and coalesce(a.deleted,false) = false),
           (select count(*) from public.org_follows f where f.user_id = p.user_id),
           (select count(*) from public.user_profile r where r.referred_by_code is not null and r.referred_by_code = p.vanity_code)
    from public.user_profile p
    order by p.created_at desc;
end; $$;

create or replace function public.admin_set_user_notes(p_uid uuid, p_notes text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.user_profile set admin_notes = p_notes where user_id = p_uid;
end; $$;

create or replace function public.admin_set_blueprint_permission(p_uid uuid, p_allowed boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.user_profile set can_upload_blueprints = p_allowed where user_id = p_uid;
end; $$;

create or replace function public.admin_set_plan(p_uid uuid, p_plan text, p_expires timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.user_profile set plan_status = p_plan, plan_expires_at = p_expires where user_id = p_uid;
end; $$;

-- APPLICATIONS ----------------------------------------------------------------
create or replace function public.admin_list_applications()
returns table (kind text, ref_id text, role text, name text, email text, detail text, status text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return query
    select 'request'::text, ar.case_id, ar.role, ar.name, ar.email, ar.message, ar.status, ar.created_at
      from public.access_requests ar
    union all
    select 'organization'::text, o.id::text, 'organizer'::text, o.name, coalesce(up.email,''), o.handle, o.status, o.created_at
      from public.organizations o left join public.user_profile up on up.user_id = o.owner_id
      where o.status = 'pending'
    union all
    select 'teacher'::text, t.id::text, 'teacher'::text, t.name, t.email, ''::text, t.status, t.created_at
      from public.teacher_accounts t where t.status = 'pending'
    order by created_at desc;
end; $$;

create or replace function public.admin_resolve_application(p_kind text, p_ref_id text, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if p_kind = 'request' then
    update public.access_requests set status = case when p_accept then 'accepted' else 'denied' end where case_id = p_ref_id;
  elsif p_kind = 'organization' then
    if p_accept then update public.organizations set status = 'approved', verified = true where id = p_ref_id::uuid;
    else delete from public.organizations where id = p_ref_id::uuid; end if;
  elsif p_kind = 'teacher' then
    if p_accept then update public.teacher_accounts set status = 'approved' where id = p_ref_id::uuid;
    else delete from public.teacher_accounts where id = p_ref_id::uuid; end if;
  end if;
end; $$;

-- PORTALS ---------------------------------------------------------------------
create or replace function public.admin_list_portal_teachers()
returns table (id uuid, user_id uuid, name text, email text, status text, blueprint_count bigint, announcement_count bigint)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return query
    select t.id, t.user_id, t.name, t.email, t.status,
           (select count(*) from public.shared_blueprints b where b.user_id = t.user_id),
           (select count(*) from public.announcements a where a.author_id = t.user_id)
    from public.teacher_accounts t order by t.created_at desc;
end; $$;

create or replace function public.admin_list_portal_orgs()
returns table (id uuid, name text, handle text, status text, verified boolean, owner_email text, event_count bigint, follower_count bigint, member_count bigint)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return query
    select o.id, o.name, o.handle, o.status, o.verified, coalesce(up.email,''),
           (select count(*) from public.events e where e.org_id = o.id),
           (select count(*) from public.org_follows f where f.org_id = o.id),
           (select count(*) from public.org_members m where m.org_id = o.id)
    from public.organizations o left join public.user_profile up on up.user_id = o.owner_id
    order by o.created_at desc;
end; $$;

create or replace function public.admin_list_org_members(p_org_id uuid)
returns table (id uuid, name text, email text, role text, status text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return query select m.id, m.name, m.email, m.role, m.status
    from public.org_members m where m.org_id = p_org_id order by m.created_at;
end; $$;

create or replace function public.admin_set_org_status(p_org_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.organizations set status = p_status where id = p_org_id;   -- 'approved' | 'banned'
end; $$;

create or replace function public.admin_delete_org(p_org_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  delete from public.organizations where id = p_org_id;   -- cascades events/members
end; $$;

create or replace function public.admin_remove_org_member(p_member_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  delete from public.org_members where id = p_member_id;
end; $$;

create or replace function public.admin_remove_teacher(p_teacher_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  delete from public.teacher_accounts where id = p_teacher_id;
end; $$;

-- VANITY ----------------------------------------------------------------------
create or replace function public.admin_set_vanity(p_uid uuid, p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare c text := upper(trim(p_code));
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if c = '' or c !~ '^[A-Z0-9]{3,20}$' then raise exception 'invalid code'; end if;
  if exists (select 1 from public.user_profile where vanity_code = c and user_id <> p_uid) then
    raise exception 'code already taken';
  end if;
  update public.user_profile set vanity_code = c where user_id = p_uid;
  return c;
end; $$;

-- BUG REPORTS -----------------------------------------------------------------
create or replace function public.admin_list_bug_reports()
returns table (id uuid, user_email text, title text, description text, page text, status text, admin_notes text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return query select b.id, b.user_email, b.title, b.description, b.page, b.status, b.admin_notes, b.created_at
    from public.bug_reports b order by b.created_at desc;
end; $$;

create or replace function public.admin_update_bug_report(p_id uuid, p_status text, p_notes text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.bug_reports set status = p_status, admin_notes = p_notes where id = p_id;
end; $$;

-- ── 9. Grants (RLS / is_admin() still gate everything) ───────────────────────
grant execute on function
  public.is_admin(),
  public.admin_list_users(),
  public.admin_set_user_notes(uuid, text),
  public.admin_set_blueprint_permission(uuid, boolean),
  public.admin_set_plan(uuid, text, timestamptz),
  public.admin_list_applications(),
  public.admin_resolve_application(text, text, boolean),
  public.admin_list_portal_teachers(),
  public.admin_list_portal_orgs(),
  public.admin_list_org_members(uuid),
  public.admin_set_org_status(uuid, text),
  public.admin_delete_org(uuid),
  public.admin_remove_org_member(uuid),
  public.admin_remove_teacher(uuid),
  public.admin_set_vanity(uuid, text),
  public.admin_list_bug_reports(),
  public.admin_update_bug_report(uuid, text, text)
to authenticated;
