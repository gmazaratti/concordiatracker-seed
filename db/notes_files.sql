-- Files in Notes folders: PDFs, slides, documents and pictures kept beside notes.
--
-- A syllabus uploaded while creating a course is NOT copied in here. It already
-- lives in `course_files`, linked to its course, and the class folder shows it
-- straight from there: one row, one stored file, so deleting it in one place
-- cannot leave a stale copy in the other.
--
-- Access follows the folder. You always see files you uploaded; anybody a folder
-- is shared with (directly or through a folder above it) can read its files,
-- through the same ct_folder_role the notes themselves use. Editors of a shared
-- folder may add files to it; only the person who uploaded a file, or the
-- folder's owner, may rename, move or delete it.
--
-- Re-runnable.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('folder-files', 'folder-files', false, 26214400, array[
  'application/pdf',
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword', 'application/vnd.ms-powerpoint', 'application/vnd.ms-excel',
  'text/plain', 'text/csv'
])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.folder_files (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- null = the General folder. A deleted folder drops its files into General
  -- rather than deleting them: a folder is a label, the file is the work.
  folder_id  uuid references public.note_folders(id) on delete set null,
  name       text not null check (char_length(name) between 1 and 200),
  path       text not null unique,
  mime       text,
  size_bytes bigint check (size_bytes is null or size_bytes between 0 and 26214400),
  created_at timestamptz not null default now()
);
create index if not exists folder_files_folder_idx on public.folder_files (folder_id);
create index if not exists folder_files_user_idx on public.folder_files (user_id);
alter table public.folder_files enable row level security;

drop policy if exists folder_files_read on public.folder_files;
drop policy if exists folder_files_insert on public.folder_files;
drop policy if exists folder_files_update on public.folder_files;
drop policy if exists folder_files_delete on public.folder_files;

create policy folder_files_read on public.folder_files for select using (
  user_id = auth.uid()
  or (folder_id is not null and public.ct_folder_role(folder_id) is not null)
);

-- The stored object must be in YOUR folder of the bucket, and the target folder
-- one you own or edit. Without the path check a row could point at somebody
-- else's upload and expose it through the folder's share.
create policy folder_files_insert on public.folder_files for insert with check (
  user_id = auth.uid()
  and split_part(path, '/', 1) = auth.uid()::text
  and (folder_id is null or public.ct_folder_role(folder_id) in ('owner', 'editor'))
);

create policy folder_files_update on public.folder_files for update
  using (
    user_id = auth.uid()
    or (folder_id is not null and public.ct_folder_role(folder_id) = 'owner')
  )
  with check (
    split_part(path, '/', 1) = user_id::text
    and (folder_id is null or public.ct_folder_role(folder_id) in ('owner', 'editor'))
  );

create policy folder_files_delete on public.folder_files for delete using (
  user_id = auth.uid()
  or (folder_id is not null and public.ct_folder_role(folder_id) = 'owner')
);

-- The path is fixed once written: moving a file is a folder change, never a
-- repointing at a different stored object.
create or replace function public.ct_folder_file_guard()
returns trigger language plpgsql as $$
begin
  if new.path is distinct from old.path or new.user_id is distinct from old.user_id then
    raise exception 'A file''s storage path and owner cannot change.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists folder_files_guard on public.folder_files;
create trigger folder_files_guard before update on public.folder_files
  for each row execute function public.ct_folder_file_guard();

-- Storage. Reading goes through the table row, so the folder share decides;
-- writing and deleting are confined to your own top-level folder.
create or replace function public.ct_can_read_folder_file(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.folder_files f
     where f.path = p_name
       and (f.user_id = auth.uid()
            or (f.folder_id is not null and public.ct_folder_role(f.folder_id) is not null))
  )
$$;
revoke all on function public.ct_can_read_folder_file(text) from public;
grant execute on function public.ct_can_read_folder_file(text) to authenticated;

drop policy if exists folder_files_obj_read on storage.objects;
drop policy if exists folder_files_obj_write on storage.objects;
drop policy if exists folder_files_obj_delete on storage.objects;

create policy folder_files_obj_read on storage.objects for select to authenticated using (
  bucket_id = 'folder-files'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.ct_can_read_folder_file(name))
);
create policy folder_files_obj_write on storage.objects for insert to authenticated with check (
  bucket_id = 'folder-files' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy folder_files_obj_delete on storage.objects for delete to authenticated using (
  bucket_id = 'folder-files' and (storage.foldername(name))[1] = auth.uid()::text
);
