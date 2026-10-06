-- ============================================================================
-- Notes: live co-editing, comments, inline images, page setup.
--
-- LIVE CO-EDITING (Yjs). A note's text is a CRDT document. Every change is
-- appended to note_doc_updates (base64 Yjs updates) and broadcast to whoever
-- has the note open; a snapshot in notes.ydoc compacts the log. Because Yjs
-- merges any set of updates in any order to the same result, two people
-- typing at once both keep their words — the log is the source of truth and
-- nothing is ever "the last save wins".
--
-- THE LIVE CHANNEL IS PRIVATE. A realtime channel is open to anyone who knows
-- its name unless realtime.messages has policies. Here: anyone with access to
-- a note may join `note:<id>` and send presence and cursor positions; only the
-- owner and editors may send document updates. Without this, anyone who learnt
-- a note's id could type into everyone's open copy.
--
-- Safe to re-run.
-- ============================================================================

alter table public.notes add column if not exists ydoc text;
alter table public.notes add column if not exists ydoc_upto bigint not null default 0;
alter table public.notes add column if not exists page jsonb not null default '{}'::jsonb;
alter table public.notes drop constraint if exists notes_ydoc_size;
alter table public.notes add constraint notes_ydoc_size check (ydoc is null or char_length(ydoc) <= 8000000);

-- 'owner' | 'editor' | 'viewer' | null for a note id given as text (a topic or
-- a storage path), never raising on something that is not a uuid.
create or replace function public.ct_note_role_text(p text)
returns text language plpgsql stable security definer set search_path = public as $$
begin
  return public.ct_note_role(p::uuid);
exception when others then
  return null;
end $$;

-- ── The update log ──────────────────────────────────────────────────────────
create table if not exists public.note_doc_updates (
  id         bigserial primary key,
  note_id    uuid not null references public.notes(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data       text not null check (char_length(data) <= 2000000),
  created_at timestamptz not null default now()
);
create index if not exists note_doc_updates_note_idx on public.note_doc_updates (note_id, id);
alter table public.note_doc_updates enable row level security;
drop policy if exists note_doc_updates_read on public.note_doc_updates;
drop policy if exists note_doc_updates_write on public.note_doc_updates;
create policy note_doc_updates_read on public.note_doc_updates for select using (public.ct_note_role(note_id) is not null);
create policy note_doc_updates_write on public.note_doc_updates for insert
  with check (user_id = auth.uid() and public.ct_note_role(note_id) in ('owner', 'editor'));

-- First load of a note written before co-editing existed: the first client to
-- open it converts the old text into the CRDT and stores it. Two clients doing
-- that at once would each insert the whole text — so this takes a row lock and
-- only seeds an EMPTY log. The loser is told to load what the winner wrote.
create or replace function public.note_seed_ydoc(p_note uuid, p_state text)
returns boolean language plpgsql security definer set search_path = public as $$
declare n public.notes;
begin
  if public.ct_note_role(p_note) not in ('owner', 'editor') then
    raise exception 'You cannot edit this note.' using errcode = '42501';
  end if;
  select * into n from public.notes where id = p_note for update;
  if n.ydoc is not null or exists (select 1 from public.note_doc_updates u where u.note_id = p_note) then
    return false;
  end if;
  insert into public.note_doc_updates (note_id, user_id, data) values (p_note, auth.uid(), p_state);
  return true;
end $$;

-- Fold the log into the snapshot. The client sends the state it built from the
-- snapshot plus every update up to p_upto; the log below that is deleted.
create or replace function public.note_compact(p_note uuid, p_state text, p_upto bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.ct_note_role(p_note) not in ('owner', 'editor') then
    raise exception 'You cannot edit this note.' using errcode = '42501';
  end if;
  update public.notes set ydoc = p_state, ydoc_upto = p_upto
   where id = p_note and p_upto > ydoc_upto;
  if found then
    delete from public.note_doc_updates where note_id = p_note and id <= p_upto;
  end if;
end $$;
grant execute on function public.note_seed_ydoc(uuid, text) to authenticated;
grant execute on function public.note_compact(uuid, text, bigint) to authenticated;

-- ── Private live channel: note:<id> ─────────────────────────────────────────
do $$ begin
  alter table realtime.messages enable row level security;
exception when others then
  raise notice 'realtime.messages RLS left as is: %', sqlerrm;
end $$;
drop policy if exists notes_live_read on realtime.messages;
drop policy if exists notes_live_send on realtime.messages;
-- Two topics, because Realtime evaluates these policies ONCE, when a client
-- joins, with no event name yet; a rule on `event` therefore refused every
-- send and the server dropped them silently (it still acknowledges "ok").
--   note:<id>   room: names, cursors, comment pings, sync requests.
--               Anyone who can see the note may read and send.
--   noted:<id>  document updates. Everyone on the note reads; only owners and
--               editors may send, so a viewer's edits never reach anyone.
-- 'note:%' cannot match 'noted:…' (its fifth character is 'd', not ':').
create policy notes_live_read on realtime.messages for select to authenticated using (
  (realtime.messages.topic like 'note:%'
    and public.ct_note_role_text(substring(realtime.messages.topic from 6)) is not null)
  or (realtime.messages.topic like 'noted:%'
    and public.ct_note_role_text(substring(realtime.messages.topic from 7)) is not null)
);
create policy notes_live_send on realtime.messages for insert to authenticated with check (
  (realtime.messages.topic like 'note:%'
    and public.ct_note_role_text(substring(realtime.messages.topic from 6)) is not null)
  or (realtime.messages.topic like 'noted:%' and realtime.messages.extension = 'broadcast'
    and public.ct_note_role_text(substring(realtime.messages.topic from 7)) in ('owner', 'editor'))
);

-- ── Comments ────────────────────────────────────────────────────────────────
-- A thread is anchored to text by a mark in the document carrying thread_id;
-- the words live here. Anyone who can see the note can comment (a viewer
-- reviewing a classmate's notes is the normal case).
create table if not exists public.note_comments (
  id         uuid primary key default gen_random_uuid(),
  note_id    uuid not null references public.notes(id) on delete cascade,
  thread_id  uuid not null,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 4000),
  quote      text check (char_length(quote) <= 500),
  resolved   boolean not null default false,
  created_at timestamptz not null default now(),
  edited_at  timestamptz
);
create index if not exists note_comments_note_idx on public.note_comments (note_id, created_at);
alter table public.note_comments enable row level security;
drop policy if exists note_comments_read on public.note_comments;
drop policy if exists note_comments_insert on public.note_comments;
drop policy if exists note_comments_update on public.note_comments;
drop policy if exists note_comments_delete on public.note_comments;
create policy note_comments_read on public.note_comments for select using (public.ct_note_role(note_id) is not null);
create policy note_comments_insert on public.note_comments for insert
  with check (user_id = auth.uid() and public.ct_note_role(note_id) is not null);
-- Your own words, or (owner/editors) resolving a thread.
create policy note_comments_update on public.note_comments for update
  using (user_id = auth.uid() or public.ct_note_role(note_id) in ('owner', 'editor'))
  with check (user_id = auth.uid() or public.ct_note_role(note_id) in ('owner', 'editor'));
create policy note_comments_delete on public.note_comments for delete
  using (user_id = auth.uid() or public.ct_note_role(note_id) = 'owner');

-- Only the author may change the words; anyone allowed may only flip resolved.
create or replace function public.ct_note_comment_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.user_id is distinct from auth.uid() and current_user in ('authenticated', 'anon') then
    if new.body is distinct from old.body or new.quote is distinct from old.quote
       or new.user_id is distinct from old.user_id or new.thread_id is distinct from old.thread_id then
      raise exception 'Only the author can change a comment.' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists note_comments_guard on public.note_comments;
create trigger note_comments_guard before update on public.note_comments
  for each row execute function public.ct_note_comment_guard();

-- ── Images in notes ─────────────────────────────────────────────────────────
-- Private, at <note id>/<file>. Readable by anyone who can read the note,
-- writable by its owner and editors.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('note-media', 'note-media', false, 8388608, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;
drop policy if exists note_media_read on storage.objects;
drop policy if exists note_media_write on storage.objects;
create policy note_media_read on storage.objects for select
  using (bucket_id = 'note-media' and public.ct_note_role_text((storage.foldername(name))[1]) is not null);
create policy note_media_write on storage.objects for insert
  with check (bucket_id = 'note-media' and public.ct_note_role_text((storage.foldername(name))[1]) in ('owner', 'editor'));

-- A comment's place in the text: two Yjs relative positions (start, end) that
-- follow the words through everyone's edits, so the highlight stays on what
-- was commented on — and a viewer can comment without editing the document.
alter table public.note_comments add column if not exists anchor jsonb;
