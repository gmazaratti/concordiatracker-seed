-- ============================================================================
-- ConcordiaTracker — DEV sandbox bootstrap (Phase 0 → the core loop)
--
-- RUN THIS IN YOUR `concordiatracker-dev` PROJECT ONLY.
--   Supabase dashboard → (the DEV project) → SQL Editor → New query → paste → Run.
--
-- It is SAFE: the dev project is brand-new and empty, so this only CREATES
-- structure (empty tables) — it touches no real data and never runs against
-- your live site. It mirrors the live columns we confirmed (query A1), adds the
-- new columns the seed needs, and uses the SAME per-user Row Level Security your
-- live `courses`/`assignments` already use (`auth.uid() = user_id`).
--
-- We start with just the three core tables (identity + courses + assignments).
-- Other tables (todos, blueprints, community, portals) get added in later phases.
-- ============================================================================

-- ── 1. user_profile : identity + plan/billing state ─────────────────────────
create table if not exists public.user_profile (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  name                   text,
  email                  text,
  program                text,
  school                 text,
  role                   text default 'student',       -- 'student' | 'teacher' | 'ta'
  avatar_url             text,
  plan_status            text default 'free',           -- 'free' | 'pro'
  stripe_customer_id     text,
  plan_price_id          text,
  stripe_subscription_id text,
  referral_source        text,
  created_at             timestamptz not null default now()
);
alter table public.user_profile enable row level security;
create policy "profile_select_own" on public.user_profile for select using (auth.uid() = user_id);
create policy "profile_insert_own" on public.user_profile for insert with check (auth.uid() = user_id);
create policy "profile_update_own" on public.user_profile for update using (auth.uid() = user_id);

-- ── 2. courses ──────────────────────────────────────────────────────────────
--   id is TEXT (the live shape) so the app can use ids like 'comm216' or
--   'manual-course-1'. user_id auto-stamps the owner via auth.uid().
create table if not exists public.courses (
  id           text primary key default gen_random_uuid()::text,
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  code         text not null,
  name         text not null,
  location     text default '',
  time         text default '',
  professor    text default '',
  prof_email   text default '',
  ta_name      text,
  ta_email     text default '',
  color        text default 'from-purple-500 to-indigo-500',
  credits      numeric default 3,
  -- new columns the seed needs (not in the live DB yet):
  section      text,
  office_hours text,
  syllabus_url text,
  term         text,
  origin       text default 'catalog'                  -- 'catalog' | 'manual'
);
alter table public.courses enable row level security;
create policy "courses_select_own" on public.courses for select using (auth.uid() = user_id);
create policy "courses_insert_own" on public.courses for insert with check (auth.uid() = user_id);
create policy "courses_update_own" on public.courses for update using (auth.uid() = user_id);
create policy "courses_delete_own" on public.courses for delete using (auth.uid() = user_id);

-- ── 3. assignments ──────────────────────────────────────────────────────────
--   id is UUID (database-generated). course_id is TEXT → references courses(id).
create table if not exists public.assignments (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id                text references public.courses(id) on delete cascade,  -- null for custom events
  title                    text not null,
  date                     timestamptz not null,
  type                     text not null default 'Assignment',
  weight                   real,
  score                    real,
  raw_score                numeric,
  raw_total                numeric,
  done                     boolean default false,
  missed                   boolean default false,
  awaiting_grade           boolean not null default false,
  extension_granted        boolean not null default false,
  submitted_date           text,
  submitted_on_time        boolean,
  notes                    text,
  is_custom_event          boolean default false,
  custom_course_code       text,
  custom_course_color      text,
  deleted                  boolean default false,
  deleted_at               timestamptz,
  -- new columns the seed needs (not in the live DB yet):
  status                   text,                        -- not-started|in-progress|done|late|missed|extension|awaiting-grade
  provenance_status        text default 'unverified',   -- official|confirmed|unverified
  provenance_confirmations int  default 0
);
alter table public.assignments enable row level security;
create policy "assign_select_own" on public.assignments for select using (auth.uid() = user_id);
create policy "assign_insert_own" on public.assignments for insert with check (auth.uid() = user_id);
create policy "assign_update_own" on public.assignments for update using (auth.uid() = user_id);
create policy "assign_delete_own" on public.assignments for delete using (auth.uid() = user_id);

-- ── Done. You now have an empty, per-user-locked sandbox for the core loop. ──
-- Note: don't INSERT rows by hand in the SQL editor — `auth.uid()` is empty
-- there, so user_id would be null. Let the app create rows while signed in as a
-- test user; that's what we'll do in Phase 1+.
