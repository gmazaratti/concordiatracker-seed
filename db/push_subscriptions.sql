-- ============================================================================
-- Web Push subscriptions — one row per browser/device a user opts in on.
--
-- Per-user RLS: you can only see / add / change / remove your OWN subscriptions.
-- The send function (api/send-push) reads them with the caller's own JWT, so the
-- self-test needs no service-role key. Server-initiated sends (deadline reminders,
-- added later) will use the service role to read across users.
-- ============================================================================

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push own select" on public.push_subscriptions;
create policy "push own select" on public.push_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "push own insert" on public.push_subscriptions;
create policy "push own insert" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);

drop policy if exists "push own update" on public.push_subscriptions;
create policy "push own update" on public.push_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "push own delete" on public.push_subscriptions;
create policy "push own delete" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);
