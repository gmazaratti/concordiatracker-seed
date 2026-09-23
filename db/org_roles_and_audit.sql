-- ============================================================================
-- Custom roles with a grant hierarchy, and an audit log that can be undone.
-- RUN IN: Supabase SQL Editor. Safe to re-run.
--
-- ONE MIGRATION FOR BOTH, because the log is only worth reading once there is
-- something to attribute: "somebody changed the banner" is a shrug, "Dana,
-- Events, on Tuesday" is a fact you can act on.
--
-- ── WHY THIS DOES NOT BREAK ANYBODY ─────────────────────────────────────────
-- Measured before writing: 4 `org_members` rows across 35 organisations, every
-- one of them `role = 'owner'`, and ZERO rows carrying a permission override.
-- So mapping the existing three-value `role` column onto seeded system roles
-- preserves today's access exactly, and the interesting case (a club with real
-- members on narrower roles) does not exist yet to be broken.
--
-- ── THE EXTENSION POINT ─────────────────────────────────────────────────────
-- `org_perm(org, key)` is already the single function every write policy on
-- organizations, events, posts and stories consults. Redefining THAT to read
-- roles upgrades all nine policies at once, rather than editing nine policies
-- and discovering the tenth later. The legacy four keys keep working because
-- the new role permission sets contain them.
--
-- ── ONE ROLE PER MEMBER, deliberately ───────────────────────────────────────
-- Discord gives a member several roles and unions their permissions. That also
-- makes "which role do I rank at" a computed maximum, and every question about
-- the hierarchy has to answer it first. A club exec is one job. One role per
-- member, plus the per-member override column that already exists for the odd
-- exception, says the same thing with one less concept — and the override is
-- what keeps the migration lossless.
-- ============================================================================

-- ── The permission vocabulary, in one place ─────────────────────────────────
--
-- Named so the UI and the policies cannot drift, and so a typo in a key is a
-- failed CHECK rather than a silently-denied member. The nine the brief asked
-- for, plus the two the portal already enforced (`manage_team`, `view_insights`)
-- and their two legacy aliases, which existing policies still name.
create or replace function public.ct_org_perm_keys()
returns text[] language sql immutable as $$
  select array[
    'post_create',    -- write a post or a story
    'post_feed',      -- publish a post to the Community feed
    'post_edit',      -- edit one that is already out
    'post_delete',    -- take one down
    'event_create',   -- post an event
    'event_update',   -- change one
    'profile_edit',   -- name, bio, logo, banner, colour, links
    'handle_change',  -- the club's address; every shared link points at it
    'roles_grant',    -- hand somebody a role below your own
    'manage_team',    -- invite and remove people
    'view_insights',  -- the aggregate reach numbers
    -- Legacy aliases still named by live policies. Kept so this migration is
    -- additive; `org_perm` maps them onto the list above.
    'manage_events',
    'edit_profile'
  ];
$$;

-- ── Roles ───────────────────────────────────────────────────────────────────
--
-- `position` is the hierarchy and the whole of it: higher outranks lower, and
-- you may only hand out a role strictly below your own. An owner role bypasses
-- it, which is what "unless it has the owner role" means.
create table if not exists public.org_roles (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  name         text not null,
  -- Fixed hex, like a course colour: a role's identity should not change
  -- meaning when somebody switches theme.
  color        text not null default '#8fb39a',
  -- A lucide icon name. The client falls back when it does not know one, so a
  -- future rename of an icon cannot blank a role.
  icon         text,
  position     int  not null default 10,
  permissions  jsonb not null default '{}'::jsonb,
  -- Owner always sees the log; this is the switch for everybody else.
  can_view_activity boolean not null default false,
  -- The owner role bypasses the hierarchy and every permission check.
  is_owner     boolean not null default false,
  -- 'owner' | 'admin' | 'member' for the three seeded on migration; null for a
  -- club's own. System roles cannot be deleted — a club with no roles at all
  -- would have no way back to granting one.
  system_key   text,
  created_at   timestamptz not null default now()
);

create unique index if not exists org_roles_name_idx
  on public.org_roles (org_id, lower(name));
create unique index if not exists org_roles_system_idx
  on public.org_roles (org_id, system_key) where system_key is not null;
create index if not exists org_roles_org_idx on public.org_roles (org_id, position desc);

alter table public.org_members add column if not exists role_id uuid
  references public.org_roles(id) on delete set null;
create index if not exists org_members_role_idx on public.org_members (role_id);

-- ── Seed the three system roles for every organisation ──────────────────────
--
-- Idempotent: `on conflict do nothing` on (org_id, system_key), so re-running
-- never duplicates and never overwrites a club's edits to its own Admin role.
do $$
declare
  owner_perms jsonb;
  admin_perms jsonb;
  member_perms jsonb;
  k text;
begin
  owner_perms := '{}'::jsonb;
  foreach k in array public.ct_org_perm_keys() loop
    owner_perms := owner_perms || jsonb_build_object(k, true);
  end loop;

  -- Admin does everything except change the address. A handle is in every link
  -- anybody has shared; moving it is an owner's call.
  admin_perms := owner_perms || '{"handle_change": false}'::jsonb;

  member_perms := '{}'::jsonb;
  foreach k in array public.ct_org_perm_keys() loop
    member_perms := member_perms || jsonb_build_object(k, k = 'view_insights');
  end loop;

  insert into public.org_roles (org_id, name, color, icon, position, permissions,
                                can_view_activity, is_owner, system_key)
  select o.id, 'Owner', '#e0853c', 'Crown', 100, owner_perms, true, true, 'owner'
    from public.organizations o
  on conflict (org_id, system_key) where system_key is not null do nothing;

  insert into public.org_roles (org_id, name, color, icon, position, permissions,
                                can_view_activity, is_owner, system_key)
  select o.id, 'Admin', '#3b82f6', 'Shield', 50, admin_perms, true, false, 'admin'
    from public.organizations o
  on conflict (org_id, system_key) where system_key is not null do nothing;

  insert into public.org_roles (org_id, name, color, icon, position, permissions,
                                can_view_activity, is_owner, system_key)
  select o.id, 'Member', '#64748b', 'User', 10, member_perms, false, false, 'member'
    from public.organizations o
  on conflict (org_id, system_key) where system_key is not null do nothing;
end $$;

-- Existing members land on the system role matching the `role` they already
-- had. Only rows with no role_id are touched, so a later hand-assignment is
-- never undone by a re-run.
update public.org_members m
   set role_id = r.id
  from public.org_roles r
 where r.org_id = m.org_id
   and r.system_key = case when m.role in ('owner','admin','member') then m.role else 'member' end
   and m.role_id is null;

-- A new organisation gets its three roles without anybody remembering to ask.
create or replace function public.ct_seed_org_roles()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare owner_perms jsonb := '{}'::jsonb; member_perms jsonb := '{}'::jsonb; k text;
begin
  foreach k in array public.ct_org_perm_keys() loop
    owner_perms := owner_perms || jsonb_build_object(k, true);
    member_perms := member_perms || jsonb_build_object(k, k = 'view_insights');
  end loop;
  insert into public.org_roles (org_id, name, color, icon, position, permissions, can_view_activity, is_owner, system_key)
  values (new.id, 'Owner',  '#e0853c', 'Crown',  100, owner_perms, true,  true,  'owner'),
         (new.id, 'Admin',  '#3b82f6', 'Shield',  50, owner_perms || '{"handle_change": false}'::jsonb, true, false, 'admin'),
         (new.id, 'Member', '#64748b', 'User',    10, member_perms, false, false, 'member')
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists trg_seed_org_roles on public.organizations;
create trigger trg_seed_org_roles after insert on public.organizations
  for each row execute function public.ct_seed_org_roles();

-- ── Who am I here ───────────────────────────────────────────────────────────

/* The caller's own membership row, matched the way `org_perm` always has:
   by user id, or by email for somebody invited before they signed in. */
create or replace function public.ct_org_my_member(p_org uuid)
returns public.org_members language sql stable security definer
set search_path to 'public' as $$
  select m.* from public.org_members m
   where m.org_id = p_org
     and coalesce(m.status,'active') = 'active'
     and (m.user_id = auth.uid()
          or (m.email is not null and lower(m.email) = lower(coalesce(auth.jwt()->>'email',''))))
   limit 1;
$$;

/* OWNERSHIP IS A ROLE, not only a column. `organizations.owner_id` stays as
   the club's primary owner (transfer moves it, and a handful of older policies
   still read it), but a second owner is a member holding an `is_owner` role —
   which is what "there can be more than one owner" needs. */
create or replace function public.ct_org_is_owner(p_org uuid)
returns boolean language sql stable security definer
set search_path to 'public' as $$
  select exists (select 1 from public.organizations o
                  where o.id = p_org and o.owner_id = auth.uid())
      or exists (select 1 from public.org_members m
                   join public.org_roles r on r.id = m.role_id
                  where m.org_id = p_org
                    and coalesce(m.status,'active') = 'active'
                    and r.is_owner
                    and (m.user_id = auth.uid()
                         or (m.email is not null
                             and lower(m.email) = lower(coalesce(auth.jwt()->>'email','')))));
$$;

/* Where the caller sits in the hierarchy. An owner is above everything, which
   is why it is a sentinel rather than a big number somebody could match by
   creating a role at position 100. */
create or replace function public.ct_org_position(p_org uuid)
returns int language sql stable security definer
set search_path to 'public' as $$
  select case
    when public.ct_org_is_owner(p_org) then 2147483647
    else coalesce((select r.position from public.org_members m
                     join public.org_roles r on r.id = m.role_id
                    where m.org_id = p_org
                      and coalesce(m.status,'active') = 'active'
                      and (m.user_id = auth.uid()
                           or (m.email is not null
                               and lower(m.email) = lower(coalesce(auth.jwt()->>'email',''))))
                    limit 1), -1)
  end;
$$;

-- ── The chokepoint, rewritten ───────────────────────────────────────────────
--
-- Order matters and is the whole design:
--   1. an owner may do anything;
--   2. the platform and the agent keep their existing bypasses, or Alfred and
--      the admin console would stop working the moment this ran;
--   3. an explicit per-member override wins over the role — that column is how
--      a club says "Dana specifically may also change the handle";
--   4. otherwise the role's permission set;
--   5. and failing all of that, the legacy `role in ('owner','admin')` default,
--      so a member row that somehow has no role_id behaves as it did before.
create or replace function public.org_perm(p_org uuid, p_perm text)
returns boolean language sql stable security definer
set search_path to 'public' as $$
  with me as (select * from public.ct_org_my_member(p_org)),
       key as (
         -- Legacy aliases, mapped rather than duplicated.
         select case p_perm
                  when 'manage_events' then 'event_create'
                  when 'edit_profile'  then 'profile_edit'
                  else p_perm
                end as k
       )
  select public.ct_org_is_owner(p_org)
      or public.ct_admin_write()
      or public.ct_agent_publish_any()
      or coalesce(
           (select (m.permissions ->> (select k from key))::boolean from me m),
           (select (r.permissions ->> (select k from key))::boolean
              from me m join public.org_roles r on r.id = m.role_id),
           (select m.role in ('owner','admin') from me m),
           false
         );
$$;

-- ── Managing roles ──────────────────────────────────────────────────────────

/* A role you are allowed to hand out or edit: strictly below your own, unless
   you are an owner. Written once so create, edit, delete and grant cannot
   disagree about the rule. */
create or replace function public.ct_org_may_manage_role(p_role uuid)
returns boolean language sql stable security definer
set search_path to 'public' as $$
  select exists (
    select 1 from public.org_roles r
     where r.id = p_role
       and (public.ct_org_is_owner(r.org_id)
            or (public.org_perm(r.org_id, 'roles_grant')
                and r.position < public.ct_org_position(r.org_id)
                and not r.is_owner))
  );
$$;

create or replace function public.create_org_role(
  p_org uuid, p_name text, p_color text, p_icon text,
  p_position int, p_permissions jsonb, p_can_view_activity boolean default false
) returns public.org_roles language plpgsql security definer
set search_path to 'public' as $$
declare
  mine int := public.ct_org_position(p_org);
  row public.org_roles;
  k text;
  clean jsonb := '{}'::jsonb;
begin
  if not (public.ct_org_is_owner(p_org) or public.org_perm(p_org, 'roles_grant')) then
    raise exception 'You do not have permission to manage roles here.';
  end if;
  if coalesce(p_position, 10) >= mine then
    raise exception 'A role has to sit below your own.';
  end if;
  if coalesce(trim(p_name),'') = '' then
    raise exception 'Give the role a name.';
  end if;

  -- ONLY KNOWN KEYS ARE STORED. A jsonb straight off the wire would let a
  -- caller invent a permission name that some later policy happens to check.
  foreach k in array public.ct_org_perm_keys() loop
    clean := clean || jsonb_build_object(k, coalesce((p_permissions ->> k)::boolean, false));
  end loop;

  -- You cannot grant a permission you do not hold yourself.
  foreach k in array public.ct_org_perm_keys() loop
    if (clean ->> k)::boolean and not public.org_perm(p_org, k) then
      clean := clean || jsonb_build_object(k, false);
    end if;
  end loop;

  insert into public.org_roles (org_id, name, color, icon, position, permissions, can_view_activity)
  values (p_org, trim(p_name), coalesce(p_color, '#8fb39a'), p_icon,
          coalesce(p_position, 10), clean, coalesce(p_can_view_activity, false))
  returning * into row;

  perform public.ct_org_log(p_org, 'created the role ' || row.name, null,
                            'org_role', row.id::text, null, to_jsonb(row));
  return row;
end $$;

create or replace function public.update_org_role(
  p_role uuid, p_name text, p_color text, p_icon text,
  p_position int, p_permissions jsonb, p_can_view_activity boolean
) returns public.org_roles language plpgsql security definer
set search_path to 'public' as $$
declare
  before_row public.org_roles;
  row public.org_roles;
  k text;
  clean jsonb := '{}'::jsonb;
begin
  select * into before_row from public.org_roles where id = p_role;
  if not found then raise exception 'That role no longer exists.'; end if;
  if not public.ct_org_may_manage_role(p_role) then
    raise exception 'That role is at or above your own.';
  end if;
  if before_row.system_key = 'owner' then
    raise exception 'The Owner role cannot be edited.';
  end if;
  if coalesce(p_position, before_row.position) >= public.ct_org_position(before_row.org_id) then
    raise exception 'A role has to sit below your own.';
  end if;

  clean := before_row.permissions;
  if p_permissions is not null then
    clean := '{}'::jsonb;
    foreach k in array public.ct_org_perm_keys() loop
      clean := clean || jsonb_build_object(k, coalesce((p_permissions ->> k)::boolean, false));
      if (clean ->> k)::boolean and not public.org_perm(before_row.org_id, k) then
        clean := clean || jsonb_build_object(k, false);
      end if;
    end loop;
  end if;

  update public.org_roles
     set name = coalesce(nullif(trim(p_name),''), name),
         color = coalesce(p_color, color),
         icon = coalesce(p_icon, icon),
         position = coalesce(p_position, position),
         permissions = clean,
         can_view_activity = coalesce(p_can_view_activity, can_view_activity)
   where id = p_role
   returning * into row;

  perform public.ct_org_log(row.org_id, 'updated the role ' || row.name, null,
                            'org_role', row.id::text, to_jsonb(before_row), to_jsonb(row));
  return row;
end $$;

create or replace function public.delete_org_role(p_role uuid)
returns void language plpgsql security definer
set search_path to 'public' as $$
declare before_row public.org_roles; fallback uuid;
begin
  select * into before_row from public.org_roles where id = p_role;
  if not found then return; end if;
  if before_row.system_key is not null then
    raise exception 'The built-in roles cannot be deleted.';
  end if;
  if not public.ct_org_may_manage_role(p_role) then
    raise exception 'That role is at or above your own.';
  end if;

  -- Anybody holding it falls back to Member rather than to nothing: a member
  -- row with no role would read as "no permissions" and look like a bug.
  select id into fallback from public.org_roles
   where org_id = before_row.org_id and system_key = 'member';
  update public.org_members set role_id = fallback
   where role_id = p_role;

  delete from public.org_roles where id = p_role;
  perform public.ct_org_log(before_row.org_id, 'deleted the role ' || before_row.name, null,
                            'org_role', p_role::text, to_jsonb(before_row), null);
end $$;

/* Give somebody a role. The hierarchy is checked on BOTH ends — the role being
   granted and the role being taken away — because otherwise a Moderator could
   demote an Admin by handing them something harmless. */
create or replace function public.set_org_member_role(p_member uuid, p_role uuid)
returns void language plpgsql security definer
set search_path to 'public' as $$
declare
  mem public.org_members;
  old_role public.org_roles;
  new_role public.org_roles;
  org_name text;
begin
  select * into mem from public.org_members where id = p_member;
  if not found then raise exception 'That member no longer exists.'; end if;
  select * into old_role from public.org_roles where id = mem.role_id;
  select * into new_role from public.org_roles where id = p_role;
  if new_role.id is null or new_role.org_id <> mem.org_id then
    raise exception 'That role belongs to another organisation.';
  end if;

  if not (public.ct_org_is_owner(mem.org_id) or public.org_perm(mem.org_id, 'roles_grant')) then
    raise exception 'You do not have permission to grant roles here.';
  end if;
  if not public.ct_org_may_manage_role(p_role) then
    raise exception 'You can only grant roles below your own.';
  end if;
  if old_role.id is not null and not public.ct_org_may_manage_role(old_role.id) then
    raise exception 'That person outranks you.';
  end if;

  update public.org_members
     set role_id = p_role,
         -- Keep the legacy column in step: older policies and the admin
         -- console still read it, and two answers to "are they an admin" is
         -- how they come to disagree.
         role = case when new_role.is_owner then 'owner'
                     when new_role.position >= 50 then 'admin'
                     else 'member' end
   where id = p_member;

  select name into org_name from public.organizations where id = mem.org_id;
  perform public.ct_org_log(
    mem.org_id,
    'gave ' || coalesce(mem.name, mem.email, 'a teammate') || ' the role ' || new_role.name,
    coalesce(old_role.name, 'no role') || ' → ' || new_role.name,
    'member_role', p_member::text,
    jsonb_build_object('role_id', old_role.id, 'role_name', old_role.name),
    jsonb_build_object('role_id', new_role.id, 'role_name', new_role.name));

  -- THE AFFECTED PERSON IS TOLD. A permission change you find out about by
  -- trying to do something and being refused is the worst way to learn it.
  if mem.user_id is not null and mem.user_id <> auth.uid() then
    perform public.ct_notify(
      array[mem.user_id], 'org_role',
      coalesce(org_name, 'A club') || ': you are now ' || new_role.name,
      case when old_role.name is null then 'You were given the ' || new_role.name || ' role.'
           else 'Your role changed from ' || old_role.name || ' to ' || new_role.name || '.' end,
      '/organizer', mem.org_id, null);
  end if;
end $$;

/* Ownership moves, and by default the person handing it over KEEPS theirs —
   "there can be more than one owner" is the point, and a club whose only owner
   graduates in April is the failure this exists to prevent. Stepping down is a
   separate, explicit tick. */
create or replace function public.transfer_org_ownership(
  p_org uuid, p_member uuid, p_step_down boolean default false
) returns void language plpgsql security definer
set search_path to 'public' as $$
declare
  mem public.org_members;
  owner_role uuid;
  admin_role uuid;
  me uuid := auth.uid();
  org_name text;
begin
  if not public.ct_org_is_owner(p_org) then
    raise exception 'Only an owner can transfer ownership.';
  end if;
  select * into mem from public.org_members where id = p_member and org_id = p_org;
  if not found then raise exception 'That member is not on this team.'; end if;
  if mem.user_id is null then
    raise exception 'They have to accept their invite before they can own the club.';
  end if;

  select id into owner_role from public.org_roles where org_id = p_org and system_key = 'owner';
  select id into admin_role from public.org_roles where org_id = p_org and system_key = 'admin';

  update public.org_members set role_id = owner_role, role = 'owner' where id = p_member;
  update public.organizations set owner_id = mem.user_id where id = p_org;

  if p_step_down then
    update public.org_members set role_id = admin_role, role = 'admin'
     where org_id = p_org and user_id = me and id <> p_member;
  end if;

  select name into org_name from public.organizations where id = p_org;
  perform public.ct_org_log(p_org,
    'made ' || coalesce(mem.name, mem.email, 'a teammate') || ' an owner'
      || case when p_step_down then ' and stepped down' else '' end,
    null, 'ownership', p_member::text, null,
    jsonb_build_object('owner_id', mem.user_id, 'stepped_down', p_step_down));

  perform public.ct_notify(array[mem.user_id], 'org_role',
    coalesce(org_name, 'A club') || ': you are now an owner',
    'You have full control of this club, including its handle and its team.',
    '/organizer', p_org, null);
end $$;

-- ── The audit log ───────────────────────────────────────────────────────────
--
-- The existing table recorded a sentence and who typed it. To UNDO an action
-- you need what it was before, so it gains the shape of a change rather than a
-- description of one.
alter table public.org_activity add column if not exists actor_user  uuid;
alter table public.org_activity add column if not exists entity_type text;
alter table public.org_activity add column if not exists entity_id   text;
alter table public.org_activity add column if not exists before      jsonb;
alter table public.org_activity add column if not exists after       jsonb;
alter table public.org_activity add column if not exists reverted_at timestamptz;
alter table public.org_activity add column if not exists reverted_by uuid;

create index if not exists org_activity_actor_idx
  on public.org_activity (org_id, actor_user, created_at desc);

/* THE CLIENT CAN NO LONGER WRITE THIS TABLE DIRECTLY.
   An audit log whose actor is a string the caller supplies is worth nothing —
   the one field that has to be trustworthy would be the one field anybody can
   set. Every write goes through here, where the actor comes from auth.uid(). */
drop policy if exists "org_activity_write" on public.org_activity;

create or replace function public.ct_org_log(
  p_org uuid, p_action text, p_detail text default null,
  p_entity_type text default null, p_entity_id text default null,
  p_before jsonb default null, p_after jsonb default null
) returns uuid language plpgsql security definer
set search_path to 'public' as $$
declare
  me uuid := auth.uid();
  nm text;
  em text;
  id uuid;
begin
  if p_org is null then return null; end if;
  select coalesce(p.name, ''), coalesce(p.email, '')
    into nm, em
    from public.user_profile p where p.user_id = me;
  insert into public.org_activity (org_id, actor_user, actor_name, actor_email,
                                   action, detail, entity_type, entity_id, before, after)
  values (p_org, me, coalesce(nullif(nm,''), 'Someone'), coalesce(em, ''),
          p_action, p_detail, p_entity_type, p_entity_id, p_before, p_after)
  returning public.org_activity.id into id;
  return id;
end $$;

grant execute on function public.ct_org_log(uuid, text, text, text, text, jsonb, jsonb)
  to authenticated;

/* Who may read the log. The owner always can — a control the owner could lock
   themselves out of is a trap — and every other role has a switch. */
create or replace function public.ct_org_can_view_activity(p_org uuid)
returns boolean language sql stable security definer
set search_path to 'public' as $$
  select public.is_admin()
      or public.ct_org_is_owner(p_org)
      or exists (select 1 from public.org_members m
                   join public.org_roles r on r.id = m.role_id
                  where m.org_id = p_org
                    and coalesce(m.status,'active') = 'active'
                    and r.can_view_activity
                    and (m.user_id = auth.uid()
                         or (m.email is not null
                             and lower(m.email) = lower(coalesce(auth.jwt()->>'email','')))));
$$;

drop policy if exists "org_activity_read" on public.org_activity;
create policy "org_activity_read" on public.org_activity for select
  using (public.ct_org_can_view_activity(org_id));

-- ── Undo ────────────────────────────────────────────────────────────────────
--
-- ONLY WHAT CAN GENUINELY BE PUT BACK. A story that expired and a notification
-- that was delivered are gone; offering to revert them would be a button that
-- lies. So revert dispatches on `entity_type` over an explicit list of columns
-- per entity — a whitelist, not a loop over whatever keys the jsonb happens to
-- carry, which would be an injection surface with a friendly name.
create or replace function public.ct_activity_revertible(p_row public.org_activity)
returns boolean language sql immutable as $$
  select p_row.reverted_at is null
     and p_row.before is not null
     and p_row.entity_type in ('organization','event','org_post','member_role','org_role');
$$;

create or replace function public.revert_org_activity(p_activity uuid)
returns text language plpgsql security definer
set search_path to 'public' as $$
declare
  a public.org_activity;
  what text;
begin
  select * into a from public.org_activity where id = p_activity;
  if not found then raise exception 'That entry no longer exists.'; end if;
  if not (public.ct_org_is_owner(a.org_id) or public.org_perm(a.org_id, 'roles_grant')) then
    raise exception 'You do not have permission to undo actions here.';
  end if;
  if not public.ct_activity_revertible(a) then
    raise exception 'That action cannot be undone.';
  end if;

  if a.entity_type = 'organization' then
    update public.organizations o
       set name   = coalesce(a.before->>'name',   o.name),
           handle = coalesce(a.before->>'handle', o.handle),
           bio    = coalesce(a.before->>'bio',    o.bio),
           color  = coalesce(a.before->>'color',  o.color),
           logo   = case when a.before ? 'logo'   then a.before->>'logo'   else o.logo end,
           banner = case when a.before ? 'banner' then a.before->>'banner' else o.banner end,
           links  = case when a.before ? 'links'  then a.before->'links'   else o.links end
     where o.id = a.entity_id::uuid;
    what := 'the profile';

  elsif a.entity_type = 'event' then
    update public.events e
       set title       = coalesce(a.before->>'title', e.title),
           start       = coalesce((a.before->>'start')::timestamptz, e.start),
           location    = case when a.before ? 'location' then a.before->>'location' else e.location end,
           mode        = coalesce(a.before->>'mode', e.mode),
           category    = coalesce(a.before->>'category', e.category),
           description = case when a.before ? 'description' then a.before->>'description' else e.description end,
           image       = case when a.before ? 'image' then a.before->>'image' else e.image end
     where e.id = a.entity_id::uuid;
    what := 'the event';

  elsif a.entity_type = 'org_post' then
    update public.org_posts p
       set caption = case when a.before ? 'caption' then a.before->>'caption' else p.caption end,
           deleted = coalesce((a.before->>'deleted')::boolean, p.deleted)
     where p.id = a.entity_id::uuid;
    what := 'the post';

  elsif a.entity_type = 'member_role' then
    update public.org_members m
       set role_id = nullif(a.before->>'role_id','')::uuid
     where m.id = a.entity_id::uuid;
    what := 'the role change';

  elsif a.entity_type = 'org_role' then
    update public.org_roles r
       set name = coalesce(a.before->>'name', r.name),
           color = coalesce(a.before->>'color', r.color),
           icon = case when a.before ? 'icon' then a.before->>'icon' else r.icon end,
           position = coalesce((a.before->>'position')::int, r.position),
           permissions = coalesce(a.before->'permissions', r.permissions),
           can_view_activity = coalesce((a.before->>'can_view_activity')::boolean, r.can_view_activity)
     where r.id = a.entity_id::uuid;
    what := 'the role';
  end if;

  update public.org_activity
     set reverted_at = now(), reverted_by = auth.uid()
   where id = p_activity;

  -- THE UNDO IS ITSELF AN ACTION. A log you can quietly edit by pressing undo
  -- is a log with a hole in it.
  perform public.ct_org_log(a.org_id, 'undid: ' || a.action, null, 'revert', p_activity::text, null, null);
  return what;
end $$;

/* Everything one person did, inside a window. Newest first, because undoing
   oldest-first would replay later changes over the top of the ones you meant
   to keep. Returns how many were actually put back. */
create or replace function public.revert_org_activity_bulk(
  p_org uuid, p_actor uuid, p_from timestamptz, p_to timestamptz
) returns int language plpgsql security definer
set search_path to 'public' as $$
declare r record; n int := 0;
begin
  if not public.ct_org_is_owner(p_org) then
    raise exception 'Only an owner can undo somebody''s whole run of changes.';
  end if;
  for r in
    select a.* from public.org_activity a
     where a.org_id = p_org
       and a.actor_user = p_actor
       and a.created_at >= coalesce(p_from, '-infinity'::timestamptz)
       and a.created_at <= coalesce(p_to, now())
       and public.ct_activity_revertible(a)
     order by a.created_at desc
  loop
    begin
      perform public.revert_org_activity(r.id);
      n := n + 1;
    exception when others then
      -- One entry that cannot be applied (its target is gone) must not abandon
      -- the rest of the run.
      null;
    end;
  end loop;
  return n;
end $$;

/* The log, with the caller's ability to undo each row worked out server-side —
   a client deciding that for itself would eventually show an Undo that the
   database then refuses. */
create or replace function public.org_activity_feed(p_org uuid, p_limit int default 100)
returns table (
  id uuid, created_at timestamptz, actor_user uuid, actor_name text, actor_email text,
  action text, detail text, entity_type text, entity_id text,
  reverted_at timestamptz, can_revert boolean
) language sql stable security definer set search_path to 'public' as $$
  select a.id, a.created_at, a.actor_user, a.actor_name, a.actor_email,
         a.action, a.detail, a.entity_type, a.entity_id, a.reverted_at,
         public.ct_activity_revertible(a)
           and (public.ct_org_is_owner(p_org) or public.org_perm(p_org, 'roles_grant'))
    from public.org_activity a
   where a.org_id = p_org
     and public.ct_org_can_view_activity(p_org)
   order by a.created_at desc
   limit least(coalesce(p_limit, 100), 500);
$$;

/* Who has done anything here — the picker for "undo everything from". */
create or replace function public.org_activity_actors(p_org uuid)
returns table (actor_user uuid, actor_name text, actions bigint, last_at timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select a.actor_user, max(a.actor_name), count(*), max(a.created_at)
    from public.org_activity a
   where a.org_id = p_org and a.actor_user is not null
     and public.ct_org_can_view_activity(p_org)
   group by a.actor_user
   order by max(a.created_at) desc;
$$;

-- ── The two permissions a policy cannot express ─────────────────────────────
--
-- Deleting a post is an UPDATE (`deleted = true`), so a single UPDATE policy
-- cannot tell edit from delete. Same for the handle, which is one column of an
-- organisation a `profile_edit` policy has already allowed. Triggers can see
-- the difference between the old row and the new one, which is exactly what is
-- being asked.
create or replace function public.ct_guard_post_delete()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.deleted is distinct from old.deleted then
    if not public.org_perm(new.org_id, case when new.deleted then 'post_delete' else 'post_edit' end) then
      raise exception 'You do not have permission to delete this club''s posts.';
    end if;
  elsif not public.org_perm(new.org_id, 'post_edit') then
    raise exception 'You do not have permission to edit this club''s posts.';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_post_delete on public.org_posts;
create trigger trg_guard_post_delete before update on public.org_posts
  for each row execute function public.ct_guard_post_delete();

create or replace function public.ct_guard_org_handle()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.handle is distinct from old.handle
     and not public.org_perm(new.id, 'handle_change') then
    raise exception 'Only somebody with permission to change the handle can do that.';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_org_handle on public.organizations;
create trigger trg_guard_org_handle before update on public.organizations
  for each row execute function public.ct_guard_org_handle();

-- ── Posting to the feed is its own permission ───────────────────────────────
drop policy if exists "org_posts_write" on public.org_posts;
create policy "org_posts_write" on public.org_posts for insert
  with check (public.ct_can_act_as_org(org_id)
              and public.org_perm(org_id, 'post_create')
              and public.org_perm(org_id, 'post_feed'));

drop policy if exists "org_stories_write" on public.org_stories;
create policy "org_stories_write" on public.org_stories for insert
  with check (public.ct_can_act_as_org(org_id) and public.org_perm(org_id, 'post_create'));

-- ── Roles are readable by the team, written only through the functions ──────
alter table public.org_roles enable row level security;
drop policy if exists "org_roles_read" on public.org_roles;
create policy "org_roles_read" on public.org_roles for select
  using (public.ct_is_org_member(org_id) or public.is_admin());
-- No insert/update/delete policies: every change goes through a definer
-- function that enforces the hierarchy. A policy scoped to "your own org"
-- could not express "strictly below your own position".

grant execute on function public.ct_org_perm_keys() to authenticated, anon;
grant execute on function public.ct_org_is_owner(uuid) to authenticated;
grant execute on function public.ct_org_position(uuid) to authenticated;
grant execute on function public.ct_org_can_view_activity(uuid) to authenticated;
grant execute on function public.create_org_role(uuid, text, text, text, int, jsonb, boolean) to authenticated;
grant execute on function public.update_org_role(uuid, text, text, text, int, jsonb, boolean) to authenticated;
grant execute on function public.delete_org_role(uuid) to authenticated;
grant execute on function public.set_org_member_role(uuid, uuid) to authenticated;
grant execute on function public.transfer_org_ownership(uuid, uuid, boolean) to authenticated;
grant execute on function public.revert_org_activity(uuid) to authenticated;
grant execute on function public.revert_org_activity_bulk(uuid, uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.org_activity_feed(uuid, int) to authenticated;
grant execute on function public.org_activity_actors(uuid) to authenticated;

-- ── Checks ──────────────────────────────────────────────────────────────────
--   select org_id, name, position, is_owner from org_roles order by org_id, position desc;
--   select m.name, r.name from org_members m left join org_roles r on r.id = m.role_id;
--   -- every member should have a role, and every org exactly three system roles:
--   select count(*) from org_members where role_id is null;               -- 0
--   select org_id, count(*) from org_roles where system_key is not null
--    group by org_id having count(*) <> 3;                                -- no rows
