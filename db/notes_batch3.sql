-- ============================================================================
-- Notes batch 3 + images in DMs.
--
--   1. Version history says WHO: notes.updated_by is stamped by the database
--      on every save, and each version records who wrote the state it keeps.
--   2. Tasks can be notes: todos.note_id links a calendar task to a document.
--   3. Files and voice notes in notes: a private bucket of their own, so the
--      image bucket keeps its 8 MB image-only limits.
--   4. @mentions in a note notify the person, if the note is shared with them.
--   5. Images in DMs: a private bucket, and a trigger that checks every image
--      attachment (shape, owner, the file really exists, daily cap, and no
--      images to somebody who has never written back).
--
-- Idempotent. Safe to re-run.
-- ============================================================================

-- ── 1. Who edited ───────────────────────────────────────────────────────────
alter table public.notes add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.note_versions add column if not exists edited_by uuid references auth.users(id) on delete set null;

create or replace function public.ct_note_version()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  -- The database says who saved, never the client.
  if auth.uid() is not null then new.updated_by := auth.uid(); end if;
  if new.content is distinct from old.content or new.title is distinct from old.title then
    if not exists (
      select 1 from public.note_versions v
       where v.note_id = old.id and v.created_at > now() - interval '10 minutes'
    ) and jsonb_array_length(coalesce(old.content->'content', '[]'::jsonb)) > 0 then
      -- The kept state was written by whoever saved it last.
      insert into public.note_versions (note_id, user_id, title, content, edited_by)
      values (old.id, old.user_id, old.title, old.content, coalesce(old.updated_by, old.user_id));
      delete from public.note_versions
       where note_id = old.id
         and id not in (select id from public.note_versions where note_id = old.id order by created_at desc limit 50);
    end if;
  end if;
  return new;
end $$;

-- Versions with the editor's name and face. user_profile is select-own, so
-- the names come through here, and only for a note the caller can read.
create or replace function public.note_version_list(p_note uuid)
returns table (id uuid, title text, content jsonb, created_at timestamptz,
               edited_by uuid, editor_name text, editor_handle text, editor_avatar text)
language sql stable security definer set search_path = public as $$
  select v.id, v.title, v.content, v.created_at, v.edited_by,
         p.name, p.handle, p.avatar_url
    from public.note_versions v
    left join public.user_profile p on p.user_id = v.edited_by
   where v.note_id = p_note and public.ct_note_role(p_note) is not null
   order by v.created_at desc
$$;
grant execute on function public.note_version_list(uuid) to authenticated;

-- ── 2. Tasks that are notes ─────────────────────────────────────────────────
alter table public.todos add column if not exists note_id uuid references public.notes(id) on delete set null;
create index if not exists todos_note_idx on public.todos (note_id) where note_id is not null;

-- ── 3. Files and voice notes in notes ───────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('note-files', 'note-files', false, 26214400, array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
  'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav'
])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists note_files_read on storage.objects;
drop policy if exists note_files_write on storage.objects;
create policy note_files_read on storage.objects for select
  using (bucket_id = 'note-files' and public.ct_note_role_text((storage.foldername(name))[1]) is not null);
create policy note_files_write on storage.objects for insert
  with check (bucket_id = 'note-files' and public.ct_note_role_text((storage.foldername(name))[1]) in ('owner', 'editor'));

-- ── 4. @mentions ────────────────────────────────────────────────────────────
-- ct_note_role, for somebody other than the caller.
create or replace function public.ct_note_role_for(p_note uuid, p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when n.user_id = p_user then 'owner'
    else (select case when bool_or(s.role = 'editor') then 'editor' when count(*) > 0 then 'viewer' end
            from public.note_shares s
           where s.user_id = p_user
             and (s.note_id = n.id
                  or (n.folder_id is not null and s.folder_id in (select public.ct_folder_chain(n.folder_id)))))
  end
  from public.notes n where n.id = p_note and n.deleted_at is null
$$;
revoke all on function public.ct_note_role_for(uuid, uuid) from public, anon, authenticated;

-- Tell someone they were mentioned. Only an owner or editor (the people who can
-- write the mention) may call it, only somebody who can open the note hears
-- about it, never yourself, and at most once per note per ten minutes, so
-- typing and deleting a mention cannot be used to spam.
create or replace function public.note_mention(p_note uuid, p_user uuid)
returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); t text; who text;
begin
  if me is null then return 'signed_out'; end if;
  if public.ct_note_role(p_note) not in ('owner', 'editor') then return 'not_editor'; end if;
  if p_user = me then return 'self'; end if;
  if public.ct_note_role_for(p_note, p_user) is null then return 'no_access'; end if;
  if exists (select 1 from public.notifications
              where user_id = p_user and kind = 'note_mention' and subject_id = p_note
                and created_at > now() - interval '10 minutes') then
    return 'recent';
  end if;
  select coalesce(nullif(title, ''), 'a note') into t from public.notes where id = p_note;
  select coalesce(nullif(name, ''), handle, 'Someone') into who from public.user_profile where user_id = me;
  perform public.ct_notify(array[p_user], 'note_mention', who || ' mentioned you in ' || t,
    'Open the note to see where.', '/app/notes/n/' || p_note, p_note, who);
  return 'sent';
end $$;
grant execute on function public.note_mention(uuid, uuid) to authenticated;

-- ── 5. Images in DMs ────────────────────────────────────────────────────────
-- At dm-media/<sender id>/<uuid>.<ext>. The browser re-encodes every photo
-- before upload; the bucket only takes these types and 5 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dm-media', 'dm-media', false, 5242880, array['image/webp', 'image/jpeg', 'image/png', 'image/gif'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Readable by its sender, and by whoever a message carrying it was sent to.
create or replace function public.ct_can_read_dm_media(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select (storage.foldername(p_name))[1] = auth.uid()::text
      or exists (
        select 1 from public.messages m
         where m.attachment->>'kind' = 'image' and m.attachment->>'path' = p_name
           and (m.recipient = auth.uid() or m.sender = auth.uid()
                or (m.recipient_org is not null and public.ct_is_org_member(m.recipient_org))
                or (m.sender_org is not null and public.ct_is_org_member(m.sender_org))))
$$;
grant execute on function public.ct_can_read_dm_media(text) to authenticated;

drop policy if exists dm_media_read on storage.objects;
drop policy if exists dm_media_write on storage.objects;
drop policy if exists dm_media_delete on storage.objects;
create policy dm_media_read on storage.objects for select to authenticated
  using (bucket_id = 'dm-media' and public.ct_can_read_dm_media(name));
create policy dm_media_write on storage.objects for insert to authenticated
  with check (bucket_id = 'dm-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy dm_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'dm-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- Every image attachment is checked and REBUILT from its validated fields, so
-- nothing else a client puts in the JSON reaches the other person.
create or replace function public.ct_check_image_attachment()
returns trigger language plpgsql security definer set search_path = public as $$
declare p text; w int; h int; n int;
begin
  if new.attachment is null or new.attachment->>'kind' is distinct from 'image' then return new; end if;
  p := new.attachment->>'path';
  if p is null or p !~ ('^' || new.sender::text || '/[0-9a-f-]{36}\.(webp|jpg|png|gif)$') then
    raise exception 'That image could not be sent.' using errcode = '22023';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'dm-media' and o.name = p) then
    raise exception 'That image has not finished uploading.' using errcode = '22023';
  end if;
  w := least(greatest(coalesce((new.attachment->>'w')::int, 0), 0), 10000);
  h := least(greatest(coalesce((new.attachment->>'h')::int, 0), 0), 10000);
  select count(*) into n from public.messages
   where sender = new.sender and attachment->>'kind' = 'image' and created_at > now() - interval '1 day';
  if n >= 40 then
    raise exception 'You have sent a lot of images today. Try again tomorrow.' using errcode = '42501';
  end if;
  -- No pictures to a stranger who has never answered: a first message stays text.
  if new.recipient is not null and new.sender_org is null
     and not public.ct_is_mutual(new.sender, new.recipient)
     and not exists (select 1 from public.messages r where r.sender = new.recipient and r.recipient = new.sender) then
    raise exception 'You can send images once they have replied.' using errcode = '42501';
  end if;
  new.attachment := jsonb_build_object('kind', 'image', 'path', p, 'w', w, 'h', h);
  return new;
end $$;
drop trigger if exists trg_check_image_attachment on public.messages;
create trigger trg_check_image_attachment before insert on public.messages
  for each row execute function public.ct_check_image_attachment();
