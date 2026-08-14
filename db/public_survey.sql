-- ── Public market-research survey (/survey) ──────────────────────────────────
-- Aimed at students who have NOT used ConcordiaTracker — it asks about how they
-- currently cope with deadlines, so it must work with no account and no sign-in.
-- Distinct from survey_response, which is product feedback from existing users.
--
-- RUN in the Supabase SQL editor. Safe to re-run.

create table if not exists public.public_survey (
  id          uuid primary key default gen_random_uuid(),
  -- Ratings and open answers as jsonb, so questions can change without a migration.
  ratings     jsonb not null default '{}'::jsonb,
  answers     jsonb not null default '{}'::jsonb,
  -- Optional: only if they volunteer it for early access.
  email       text,
  -- Where the link was shared (?src=instagram), for comparing channels.
  source      text,
  created_at  timestamptz not null default now()
);

create index if not exists public_survey_created_idx on public.public_survey (created_at desc);

alter table public.public_survey enable row level security;

-- Anyone may submit (that's the point — respondents have no account).
-- Nobody may read back: results come from the admin rollup below.
drop policy if exists "public_survey insert" on public.public_survey;
create policy "public_survey insert" on public.public_survey
  for insert to anon, authenticated with check (true);

grant insert on public.public_survey to anon, authenticated;

-- ── Admin rollup ─────────────────────────────────────────────────────────────
create or replace function public.admin_public_survey()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  select jsonb_build_object(
    'responses', (select count(*) from public_survey),
    'emails',    (select count(*) from public_survey where coalesce(email,'') <> ''),
    'sources', (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select coalesce(nullif(source,''),'direct') as source, count(*) as n
        from public_survey group by 1 order by 2 desc limit 12
      ) x
    ),
    -- Average of every rating key present, so new questions appear automatically.
    'averages', (
      select coalesce(jsonb_object_agg(k, round(avg(v::numeric), 2)), '{}'::jsonb)
      from public_survey s, jsonb_each_text(s.ratings) as e(k, v)
      where v ~ '^[0-9]+$'
    ),
    'rows', (
      select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
        select id, ratings, answers, email, source, created_at
        from public_survey order by created_at desc limit 200
      ) x
    )
  ) into r;
  return r;
end $$;
grant execute on function public.admin_public_survey() to authenticated;
