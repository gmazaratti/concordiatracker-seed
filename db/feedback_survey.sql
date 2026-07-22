-- ── In-app feedback survey ───────────────────────────────────────────────────
-- One row per user. The user manages their own row (upsert on submit); an admin
-- can read every response for aggregation. Ratings + open-ended answers are
-- stored as jsonb so the question set can grow without a migration; `recommend`
-- is a typed column because it gates the referral reward and is the key metric.
--
-- RUN AFTER the matching app deploy. Safe to re-run (idempotent).

create table if not exists public.survey_response (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  ratings    jsonb   not null default '{}'::jsonb,
  recommend  boolean,
  answers    jsonb   not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.survey_response enable row level security;

-- Own row: full self-management.
drop policy if exists "survey own select" on public.survey_response;
create policy "survey own select" on public.survey_response
  for select using (auth.uid() = user_id);

drop policy if exists "survey own insert" on public.survey_response;
create policy "survey own insert" on public.survey_response
  for insert with check (auth.uid() = user_id);

drop policy if exists "survey own update" on public.survey_response;
create policy "survey own update" on public.survey_response
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Admin: read everything (for aggregation / a future admin dashboard).
drop policy if exists "survey admin select" on public.survey_response;
create policy "survey admin select" on public.survey_response
  for select using (public.is_admin());

grant select, insert, update on public.survey_response to authenticated;

-- Optional: a quick admin-only rollup for the console (averages + recommend rate).
create or replace function public.survey_summary()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  select jsonb_build_object(
    'responses', count(*),
    'recommend_rate', round(avg((recommend)::int)::numeric, 3),
    'avg_onboarding', round(avg((ratings ->> 'onboarding')::numeric), 2),
    'avg_ease',       round(avg((ratings ->> 'ease')::numeric), 2),
    'avg_convenience',round(avg((ratings ->> 'convenience')::numeric), 2),
    'avg_uniqueness', round(avg((ratings ->> 'uniqueness')::numeric), 2),
    'avg_price',      round(avg((ratings ->> 'price')::numeric), 2),
    'avg_keep_using', round(avg((ratings ->> 'keep_using')::numeric), 2)
  )
  into result
  from public.survey_response;
  return coalesce(result, '{}'::jsonb);
end $$;
grant execute on function public.survey_summary() to authenticated;
