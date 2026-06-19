-- ============================================================================
-- Phase 9 (cont.) — persist a teacher's OWN managed courses + draft outlines, so
-- the teacher portal becomes a real, persistent account for the logged-in user
-- (no more in-memory demo that resets on reload).
-- RUN THIS IN YOUR concordiatracker-dev PROJECT ONLY (SQL Editor → paste → Run).
--
-- Private: a teacher only ever sees/edits their OWN courses (own-row RLS). When a
-- course is published, its `blueprint_id` points at the verified `shared_blueprints`
-- row (so re-publishing updates that row instead of duplicating).
-- ============================================================================
create table if not exists public.teacher_courses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  code         text not null default '',
  title        text not null default '',
  section      text not null default '',
  outline      jsonb not null default '[]'::jsonb,   -- OutlineItem[] {id,kind,title,due,weight}
  published    boolean not null default false,
  blueprint_id uuid,                                  -- the published shared_blueprints row
  created_at   timestamptz not null default now()
);
alter table public.teacher_courses enable row level security;

drop policy if exists "teacher_courses_own" on public.teacher_courses;
create policy "teacher_courses_own" on public.teacher_courses for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists teacher_courses_user_idx on public.teacher_courses (user_id);
