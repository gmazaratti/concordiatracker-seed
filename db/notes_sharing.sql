-- ============================================================================
-- Notes, the redesign: classes ARE folders, folders nest, and folders and notes
-- can be shared with people (viewer or editor) or by link.
--
-- ONE KIND OF CONTAINER. A class used to be a second, parallel way of filing a
-- note. Now every class gets a real note_folders row (course_id set), so the
-- home screen is one grid, a class can be dragged into a folder (parent_id),
-- and sharing a class is just sharing a folder. notes.course_id stays: it is
-- what the course page, week grouping and auto-linking read.
--
-- SHARING IS NEVER INFERRED. Access is the owner, or a row in note_shares for
-- that note, or for its folder or ANY folder above it. Every write goes
-- through a SECURITY DEFINER function that checks the caller owns the target;
-- note_shares has no insert/update/delete policy at all.
--
-- Safe to re-run.
-- ============================================================================

-- ── Folders: classes, icons, colours, pinning, nesting ───────────────────────
alter table public.note_folders add column if not exists course_id text references public.courses(id) on delete cascade;
alter table public.note_folders add column if not exists icon text not null default 'folder';
alter table public.note_folders add column if not exists color text not null default 'slate';
alter table public.note_folders add column if not exists pinned boolean not null default false;
alter table public.note_folders drop constraint if exists note_folders_icon_ck;
alter table public.note_folders add constraint note_folders_icon_ck check (char_length(icon) <= 30 and char_length(color) <= 20);
create unique index if not exists note_folders_one_per_course on public.note_folders (user_id, course_id) where course_id is not null;

-- A folder may only sit inside one of YOUR folders, and never inside itself
-- or one of its own descendants (which would make it unreachable).
create or replace function public.ct_note_folder_guard()
returns trigger language plpgsql set search_path = public as $$
declare cur uuid := new.parent_id; depth int := 0;
begin
  if new.parent_id is null then return new; end if;
  if not exists (select 1 from public.note_folders f where f.id = new.parent_id and f.user_id = new.user_id) then
    raise exception 'That folder is not yours.' using errcode = '42501';
  end if;
  while cur is not null loop
    if cur = new.id then raise exception 'A folder cannot go inside itself.' using errcode = '22023'; end if;
    depth := depth + 1;
    if depth > 20 then raise exception 'Folders can only nest 20 deep.' using errcode = '22023'; end if;
    select parent_id into cur from public.note_folders where id = cur;
  end loop;
  return new;
end $$;
drop trigger if exists note_folders_guard on public.note_folders;
create trigger note_folders_guard before insert or update of parent_id on public.note_folders
  for each row execute function public.ct_note_folder_guard();

-- The first few lines of a note, for cards. Generated, so it can never drift.
alter table public.notes add column if not exists excerpt text generated always as (left(body_text, 180)) stored;

-- Give every class that already has notes its folder, and file those notes in it.
insert into public.note_folders (user_id, name, course_id, icon, color)
select distinct n.user_id, coalesce(nullif(c.code, ''), 'Class'), c.id, 'graduation-cap', coalesce(c.color, 'blue')
  from public.notes n join public.courses c on c.id = n.course_id
 where not exists (select 1 from public.note_folders f where f.user_id = n.user_id and f.course_id = c.id);
update public.notes n set folder_id = f.id
  from public.note_folders f
 where n.folder_id is null and n.course_id is not null and f.user_id = n.user_id and f.course_id = n.course_id;

-- A folder for each of the caller's current classes. Called when Notes opens,
-- so a class added yesterday is already there. Returns how many it made.
create or replace function public.ensure_class_folders()
returns int language plpgsql security invoker set search_path = public as $$
declare made int;
begin
  insert into public.note_folders (user_id, name, course_id, icon, color)
  select auth.uid(), coalesce(nullif(c.code, ''), 'Class'), c.id, 'graduation-cap', coalesce(c.color, 'blue')
    from public.courses c
   where c.user_id = auth.uid() and coalesce(c.archived, false) = false
     and not exists (select 1 from public.note_folders f where f.user_id = auth.uid() and f.course_id = c.id)
  on conflict do nothing;
  get diagnostics made = row_count;
  return made;
end $$;
grant execute on function public.ensure_class_folders() to authenticated;

-- ── Shares ──────────────────────────────────────────────────────────────────
create table if not exists public.note_shares (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  note_id    uuid references public.notes(id) on delete cascade,
  folder_id  uuid references public.note_folders(id) on delete cascade,
  -- A person, or (user_id null) a link anyone signed in can open.
  user_id    uuid references auth.users(id) on delete cascade,
  link_token text unique,
  role       text not null check (role in ('viewer', 'editor')),
  via_link   boolean not null default false,
  created_at timestamptz not null default now(),
  check (num_nonnulls(note_id, folder_id) = 1),
  check ((user_id is null) <> (link_token is null))
);
create unique index if not exists note_shares_note_user on public.note_shares (note_id, user_id) where note_id is not null and user_id is not null;
create unique index if not exists note_shares_folder_user on public.note_shares (folder_id, user_id) where folder_id is not null and user_id is not null;
create unique index if not exists note_shares_note_link on public.note_shares (note_id) where note_id is not null and link_token is not null;
create unique index if not exists note_shares_folder_link on public.note_shares (folder_id) where folder_id is not null and link_token is not null;
create index if not exists note_shares_user_idx on public.note_shares (user_id);
alter table public.note_shares enable row level security;
drop policy if exists note_shares_read on public.note_shares;
create policy note_shares_read on public.note_shares for select using (owner_id = auth.uid() or user_id = auth.uid());

-- The folder and every folder above it.
create or replace function public.ct_folder_chain(p_folder uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  with recursive up(id, parent_id, depth) as (
    select id, parent_id, 0 from public.note_folders where id = p_folder
    union all
    select f.id, f.parent_id, up.depth + 1 from public.note_folders f join up on f.id = up.parent_id where up.depth < 25
  )
  select id from up
$$;

-- 'owner' | 'editor' | 'viewer' | null, for the CALLER.
create or replace function public.ct_folder_role(p_folder uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from public.note_folders f where f.id = p_folder and f.user_id = auth.uid()) then 'owner'
    else (select case when bool_or(s.role = 'editor') then 'editor' when count(*) > 0 then 'viewer' end
            from public.note_shares s
           where s.user_id = auth.uid() and s.folder_id in (select public.ct_folder_chain(p_folder)))
  end
$$;

create or replace function public.ct_note_role(p_note uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when n.user_id = auth.uid() then 'owner'
    else (select case when bool_or(s.role = 'editor') then 'editor' when count(*) > 0 then 'viewer' end
            from public.note_shares s
           where s.user_id = auth.uid()
             and (s.note_id = n.id
                  or (n.folder_id is not null and s.folder_id in (select public.ct_folder_chain(n.folder_id)))))
  end
  from public.notes n where n.id = p_note and n.deleted_at is null
$$;
grant execute on function public.ct_note_role(uuid) to authenticated;
grant execute on function public.ct_folder_role(uuid) to authenticated;

-- Shared notes and folders become readable; shared-as-editor notes editable.
drop policy if exists notes_shared_select on public.notes;
create policy notes_shared_select on public.notes for select using (public.ct_note_role(id) in ('editor', 'viewer'));
drop policy if exists notes_shared_update on public.notes;
create policy notes_shared_update on public.notes for update
  using (public.ct_note_role(id) = 'editor') with check (public.ct_note_role(id) = 'editor');
drop policy if exists note_folders_shared_select on public.note_folders;
create policy note_folders_shared_select on public.note_folders for select using (public.ct_folder_role(id) in ('editor', 'viewer'));
drop policy if exists note_versions_shared on public.note_versions;
create policy note_versions_shared on public.note_versions for select using (public.ct_note_role(note_id) is not null);

-- An editor writes the NOTE, not the owner's filing of it: where it lives,
-- which class and week, pins, linked assignments and trash stay the owner's.
create or replace function public.ct_note_editor_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is distinct from old.user_id and current_user in ('authenticated', 'anon') then
    if new.user_id is distinct from old.user_id or new.folder_id is distinct from old.folder_id
       or new.course_id is distinct from old.course_id or new.week is distinct from old.week
       or new.lecture_date is distinct from old.lecture_date or new.pinned is distinct from old.pinned
       or new.assignment_ids is distinct from old.assignment_ids or new.deleted_at is distinct from old.deleted_at then
      raise exception 'Only the owner can change where this note is filed.' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists notes_editor_guard on public.notes;
create trigger notes_editor_guard before update on public.notes
  for each row execute function public.ct_note_editor_guard();

-- ── Who has looked at and edited a note ─────────────────────────────────────
create table if not exists public.note_activity (
  note_id        uuid not null references public.notes(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  last_viewed_at timestamptz,
  last_edited_at timestamptz,
  primary key (note_id, user_id)
);
alter table public.note_activity enable row level security;
-- Read through note_people(); written only by note_touch().

create or replace function public.note_touch(p_note uuid, p_edited boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.ct_note_role(p_note) is null then return; end if;
  insert into public.note_activity (note_id, user_id, last_viewed_at, last_edited_at)
  values (p_note, auth.uid(), now(), case when p_edited then now() end)
  on conflict (note_id, user_id) do update
    set last_viewed_at = now(),
        last_edited_at = case when p_edited then now() else note_activity.last_edited_at end;
end $$;
grant execute on function public.note_touch(uuid, boolean) to authenticated;

-- Deleting a folder must not delete the folders inside it (a class folder can
-- live inside one). They move up to the top level; their notes are untouched.
alter table public.note_folders drop constraint if exists note_folders_parent_id_fkey;
alter table public.note_folders add constraint note_folders_parent_id_fkey
  foreign key (parent_id) references public.note_folders(id) on delete set null;
