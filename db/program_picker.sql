-- ============================================================================
-- Structured program selection.
-- 1. `program_id` on the profile stores the CANONICAL program id (from
--    src/data/programs.ts), e.g. 'computer-science-bcompsc', or 'other'.
--    The existing `program` text column keeps the human-readable display name
--    (or the free-typed text for "Other").
-- 2. `program_suggestions` is an append-only log of every "Other" entry so you
--    can review what's missing and grow the list. Insert-own via RLS; reading
--    is admin-only (no SELECT policy → query it from the SQL editor).
--
-- Run this before the app reads program data. The app writes program_id
-- defensively (retries without it if the column is missing) and the suggestion
-- insert is fire-and-forget, so a missing piece never blocks onboarding.
-- ============================================================================

alter table public.user_profile
  add column if not exists program_id text;

create table if not exists public.program_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

alter table public.program_suggestions enable row level security;

drop policy if exists program_suggestions_insert_own on public.program_suggestions;
create policy program_suggestions_insert_own
  on public.program_suggestions
  for insert
  to authenticated
  with check (auth.uid() = user_id);
