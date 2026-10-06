-- ============================================================================
-- Notes, phase 1: notes, folders, version history, custom templates, search,
-- the attachment table later phases fill in, and stored syllabus files.
--
-- PRIVATE BY DEFAULT. Every policy here is own-rows only. Sharing (classmates,
-- whole course) arrives in phase 3 and will WIDEN the select policy on notes
-- deliberately, in its own migration, rather than being half-present now.
--
-- courses.id IS TEXT (a manual course is "manual-course-1"), so note.course_id
-- is text too; assignments.id is uuid. A deleted course leaves its notes behind
-- as general notes (on delete set null) rather than deleting someone's writing.
--
-- Safe to re-run.
-- ============================================================================

-- ── Folders ─────────────────────────────────────────────────────────────────
create table if not exists public.note_folders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 80),
  parent_id  uuid references public.note_folders(id) on delete cascade,
  position   int  not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists note_folders_user_idx on public.note_folders (user_id);
alter table public.note_folders enable row level security;
drop policy if exists note_folders_own on public.note_folders;
create policy note_folders_own on public.note_folders
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Notes ───────────────────────────────────────────────────────────────────
create table if not exists public.notes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title          text not null default '' check (char_length(title) <= 200),
  -- The editor's document (TipTap JSON). The source of truth for display.
  content        jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  -- The same document as plain text, written by the client on save. Only
  -- search reads it; it is never shown, so a stale copy costs a search hit,
  -- not a wrong note.
  body_text      text not null default '' check (char_length(body_text) <= 200000),
  folder_id      uuid references public.note_folders(id) on delete set null,
  course_id      text references public.courses(id) on delete set null,
  -- "Week 5 FINA 210": the week of term the note belongs to, and the class
  -- date when it was written during a scheduled class. Both editable.
  week           int check (week between 1 and 30),
  lecture_date   date,
  assignment_ids uuid[] not null default '{}',
  pinned         boolean not null default false,
  deleted_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  search         tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(body_text, '')), 'B')
  ) stored
);
create index if not exists notes_user_updated_idx on public.notes (user_id, updated_at desc);
create index if not exists notes_course_idx on public.notes (course_id) where course_id is not null;
create index if not exists notes_search_idx on public.notes using gin (search);

alter table public.notes enable row level security;
drop policy if exists notes_own_select on public.notes;
drop policy if exists notes_own_insert on public.notes;
drop policy if exists notes_own_update on public.notes;
drop policy if exists notes_own_delete on public.notes;
create policy notes_own_select on public.notes for select using (user_id = auth.uid());
-- A note can only be filed under a course and a folder that are YOURS:
-- otherwise a crafted write could attach a note to someone else's course and
-- surface it on their course page once sharing reads those links.
create policy notes_own_insert on public.notes for insert with check (
  user_id = auth.uid()
  and (course_id is null or exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid()))
  and (folder_id is null or exists (select 1 from public.note_folders f where f.id = folder_id and f.user_id = auth.uid()))
);
create policy notes_own_update on public.notes for update using (user_id = auth.uid()) with check (
  user_id = auth.uid()
  and (course_id is null or exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid()))
  and (folder_id is null or exists (select 1 from public.note_folders f where f.id = folder_id and f.user_id = auth.uid()))
);
create policy notes_own_delete on public.notes for delete using (user_id = auth.uid());

-- ── Version history ─────────────────────────────────────────────────────────
-- Written by a TRIGGER, not the client: autosave fires every second or two,
-- and a history the client has to remember to write is one that has gaps.
-- A version keeps the state BEFORE an edit, at most one per ten minutes of
-- editing, and the newest 50 per note.
create table if not exists public.note_versions (
  id         uuid primary key default gen_random_uuid(),
  note_id    uuid not null references public.notes(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null default '',
  content    jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists note_versions_note_idx on public.note_versions (note_id, created_at desc);
alter table public.note_versions enable row level security;
drop policy if exists note_versions_own on public.note_versions;
-- Read-only to the owner; only the trigger writes, so no history can be forged.
create policy note_versions_own on public.note_versions for select using (user_id = auth.uid());

create or replace function public.ct_note_version()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if new.content is distinct from old.content or new.title is distinct from old.title then
    if not exists (
      select 1 from public.note_versions v
       where v.note_id = old.id and v.created_at > now() - interval '10 minutes'
    ) and jsonb_array_length(coalesce(old.content->'content', '[]'::jsonb)) > 0 then
      insert into public.note_versions (note_id, user_id, title, content)
      values (old.id, old.user_id, old.title, old.content);
      delete from public.note_versions
       where note_id = old.id
         and id not in (select id from public.note_versions where note_id = old.id order by created_at desc limit 50);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists notes_version on public.notes;
create trigger notes_version before update on public.notes
  for each row execute function public.ct_note_version();

-- ── Custom templates ────────────────────────────────────────────────────────
-- The three built-in templates live in code; these are the ones a student saves.
create table if not exists public.note_templates (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 80),
  content    jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.note_templates enable row level security;
drop policy if exists note_templates_own on public.note_templates;
create policy note_templates_own on public.note_templates
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Attachments (phase 2 fills these in) ────────────────────────────────────
-- Images, files, voice notes, slides and — later — lecture RECORDINGS. The
-- recording columns exist now so phase 2's transcription can attach to notes
-- without a migration that rewrites this table.
create table if not exists public.note_attachments (
  id          uuid primary key default gen_random_uuid(),
  note_id     uuid not null references public.notes(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('image', 'file', 'voice', 'slides', 'recording', 'drawing')),
  path        text,
  url         text,
  name        text check (char_length(name) <= 200),
  mime        text,
  size_bytes  bigint,
  duration_ms int,
  transcript  text,
  created_at  timestamptz not null default now()
);
create index if not exists note_attachments_note_idx on public.note_attachments (note_id);
alter table public.note_attachments enable row level security;
drop policy if exists note_attachments_own on public.note_attachments;
create policy note_attachments_own on public.note_attachments
  for all using (user_id = auth.uid()) with check (
    user_id = auth.uid() and exists (select 1 from public.notes n where n.id = note_id and n.user_id = auth.uid())
  );

-- ── Search ──────────────────────────────────────────────────────────────────
-- SECURITY INVOKER: it runs under the caller's RLS, so it can only ever find
-- the caller's own notes. Every word is matched as a prefix, so typing "dscr"
-- finds "DSCR" and "amort" finds "amortization" as you type.
create or replace function public.search_notes(p_q text, p_limit int default 30)
returns table (id uuid, title text, snippet text, course_id text, updated_at timestamptz, rank real)
language sql stable security invoker set search_path = public as $$
  with q as (
    select string_agg(t || ':*', ' & ') as tsq
      from regexp_split_to_table(lower(coalesce(p_q, '')), '[^[:alnum:]]+') t
     where t <> ''
  )
  select n.id, n.title,
         ts_headline('simple', n.body_text, to_tsquery('simple', q.tsq),
                     'MaxWords=18, MinWords=6, StartSel=<<, StopSel=>>, MaxFragments=1'),
         n.course_id, n.updated_at,
         ts_rank(n.search, to_tsquery('simple', q.tsq))
    from public.notes n, q
   where q.tsq is not null
     and n.deleted_at is null
     and n.search @@ to_tsquery('simple', q.tsq)
   order by 6 desc, n.updated_at desc
   limit least(greatest(coalesce(p_limit, 30), 1), 100)
$$;
grant execute on function public.search_notes(text, int) to authenticated;

-- ── Syllabus files ──────────────────────────────────────────────────────────
-- The outline a student uploaded, kept so it can be opened from the course
-- page. Until now only FAILED uploads were kept (for 30 days, to retry them).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('course-files', 'course-files', false, 10485760,
        array['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists course_files_own_read on storage.objects;
drop policy if exists course_files_own_write on storage.objects;
drop policy if exists course_files_own_delete on storage.objects;
-- Your own folder only: <user id>/<course id>/<file>.
create policy course_files_own_read on storage.objects for select
  using (bucket_id = 'course-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy course_files_own_write on storage.objects for insert
  with check (bucket_id = 'course-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy course_files_own_delete on storage.objects for delete
  using (bucket_id = 'course-files' and (storage.foldername(name))[1] = auth.uid()::text);

create table if not exists public.course_files (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id  text not null references public.courses(id) on delete cascade,
  kind       text not null default 'syllabus' check (kind in ('syllabus', 'slides', 'other')),
  path       text not null,
  name       text not null check (char_length(name) <= 200),
  mime       text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);
create index if not exists course_files_course_idx on public.course_files (course_id);
alter table public.course_files enable row level security;
drop policy if exists course_files_own on public.course_files;
create policy course_files_own on public.course_files
  for all using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid())
    and split_part(path, '/', 1) = auth.uid()::text
  );
