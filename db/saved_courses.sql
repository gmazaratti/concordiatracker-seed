-- ============================================================================
-- Saved courses: a shortlist you build while deciding what to take.
-- RUN IN: Supabase SQL Editor. Safe to re-run.
--
-- Deliberately keyed by course CODE rather than by the catalogue's id. A saved
-- course is a note about "COMP 352", and it should survive the catalogue being
-- re-synced, a course being renumbered internally, or the mirror being rebuilt
-- from scratch. Nothing here should break because an upstream id moved.
-- ============================================================================

create table if not exists public.saved_courses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  code         text not null,
  title        text,
  /** Free text: why you saved it, what you heard about it, who teaches it. */
  note         text,
  /** Which term you intend to take it. Free text so "Fall 2027" and "eventually"
   *  are both allowed - a planning note is not a database key. */
  planned_term text,
  created_at   timestamptz not null default now(),
  -- One row per course per student. Saving twice is the same intent.
  unique (user_id, code)
);

create index if not exists saved_courses_user_idx on public.saved_courses (user_id);

alter table public.saved_courses enable row level security;

drop policy if exists "saved_select_own" on public.saved_courses;
drop policy if exists "saved_insert_own" on public.saved_courses;
drop policy if exists "saved_update_own" on public.saved_courses;
drop policy if exists "saved_delete_own" on public.saved_courses;

-- A shortlist is private. There is no read-others policy and no aggregate over
-- this table: what someone is considering taking is more revealing than what
-- they are taking, and nothing in the product needs it.
create policy "saved_select_own" on public.saved_courses for select using (auth.uid() = user_id);
create policy "saved_insert_own" on public.saved_courses for insert with check (auth.uid() = user_id);
create policy "saved_update_own" on public.saved_courses for update using (auth.uid() = user_id);
create policy "saved_delete_own" on public.saved_courses for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.saved_courses to authenticated;
