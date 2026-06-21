-- ============================================================================
-- Scheduled reminders — one row per assignment/event a user wants a push for.
--
-- Denormalized (title/body/url/fire_at stored at set-time) so the scheduler
-- never has to look up the source object — this also covers static/seed events
-- that don't live in the DB. Per-user RLS for the client; the scheduler
-- (api/run-reminders) reads across all users with the service-role key.
-- ============================================================================

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('assignment', 'event')),
  ref_id text not null,
  fire_at timestamptz not null,
  offset_minutes int not null default 0,
  title text not null,
  body text not null default '',
  url text not null default '/app',
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, kind, ref_id)
);

alter table public.reminders enable row level security;

drop policy if exists "reminders own select" on public.reminders;
create policy "reminders own select" on public.reminders
  for select using (auth.uid() = user_id);
drop policy if exists "reminders own insert" on public.reminders;
create policy "reminders own insert" on public.reminders
  for insert with check (auth.uid() = user_id);
drop policy if exists "reminders own update" on public.reminders;
create policy "reminders own update" on public.reminders
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "reminders own delete" on public.reminders;
create policy "reminders own delete" on public.reminders
  for delete using (auth.uid() = user_id);

-- The scheduler scans for un-sent, now-due rows.
create index if not exists reminders_due_idx
  on public.reminders (fire_at) where sent_at is null;

-- ============================================================================
-- pg_cron: every 15 minutes, ping the send endpoint, which fires any due
-- reminders. REPLACE __CRON_SECRET__ below with the same random string you set
-- as CRON_SECRET in Vercel. (Adjust the URL if your domain differs.)
-- ============================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Idempotent: drop a previous copy so re-running this file doesn't duplicate it.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'ct-run-reminders') then
    perform cron.unschedule('ct-run-reminders');
  end if;
end $$;

select cron.schedule(
  'ct-run-reminders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://concordiatracker.com/api/run-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer __CRON_SECRET__'
    ),
    body := '{}'::jsonb
  );
  $$
);
