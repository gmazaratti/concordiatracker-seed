-- ============================================================================
-- Phase 4 — personal calendar tasks (the `todos` table).
-- RUN THIS IN YOUR concordiatracker-dev PROJECT ONLY (SQL Editor → paste → Run).
-- Safe: creates one empty table with per-user Row Level Security from the start
-- (unlike the old production `todos`, which was wide open).
-- ============================================================================
create table if not exists public.todos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title      text not null,
  due        timestamptz,                 -- the day/time the task is pinned to
  note       text,
  done       boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.todos enable row level security;
create policy "todos_select_own" on public.todos for select using (auth.uid() = user_id);
create policy "todos_insert_own" on public.todos for insert with check (auth.uid() = user_id);
create policy "todos_update_own" on public.todos for update using (auth.uid() = user_id);
create policy "todos_delete_own" on public.todos for delete using (auth.uid() = user_id);
