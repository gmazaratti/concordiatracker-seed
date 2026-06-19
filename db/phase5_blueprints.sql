-- ============================================================================
-- Phase 5 — Blueprint marketplace (shared_blueprints + blueprint_votes + RPCs).
-- RUN THIS IN YOUR concordiatracker-dev PROJECT ONLY (SQL Editor → paste → Run).
--
-- What it creates:
--   • shared_blueprints — importable syllabus outlines, keyed by COURSE CODE
--     ("COMM 217") so any student who adds that course sees them.
--   • blueprint_votes   — one vote per (blueprint, user); persists your up/down.
--   • RPCs              — increment/decrement the denormalized vote/import counts
--     (SECURITY DEFINER so any signed-in user can bump a count without owning the
--     row, but still can't edit anyone else's blueprint).
--   • Hardened RLS      — shared read (it's public content), write-your-own only.
--     (The OLD production table had UPDATE USING(true) — anyone could edit any
--     blueprint. This is locked from the start.)
--   • Seed content      — ONLY real outlines (no demo/filler):
--       Summer 2026 (teacher-verified, the syllabi you provided):
--         COMM 217 · FINA 210 · ECON 203
--       Winter 2026 (your own blueprints imported from the live site):
--         COMM 216 · COMM 221 (×2 sections) · COMM 223 · COMM 226 · COMM 227 · COMM 316
--     Add a course with one of these codes to see them.
-- Safe: creates two empty tables + functions, then inserts seed rows. Touches
-- nothing else. Idempotent-ish (drops its own policies/functions first).
-- ============================================================================

-- ── shared_blueprints ───────────────────────────────────────────────────────
create table if not exists public.shared_blueprints (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null, -- null = seeded/system
  course_code text not null,                 -- "COMP 248" — the match key
  course_name text,
  professor   text,                          -- instructor who taught this section
  author      text,                          -- uploader handle, e.g. "@maya.codes"
  section     text,
  term        text,                          -- "Summer 2026"
  items       jsonb not null default '[]'::jsonb, -- [{title,kind,weight,due}]
  verified    boolean not null default false, -- true = teacher-verified
  upvotes     integer not null default 0,
  downvotes   integer not null default 0,
  imports     integer not null default 0,
  created_at  timestamptz not null default now()
);
alter table public.shared_blueprints enable row level security;

drop policy if exists "blueprints_public_read" on public.shared_blueprints;
drop policy if exists "blueprints_insert_own"  on public.shared_blueprints;
drop policy if exists "blueprints_update_own"  on public.shared_blueprints;
drop policy if exists "blueprints_delete_own"  on public.shared_blueprints;
-- Shared content → anyone signed in can read it.
create policy "blueprints_public_read" on public.shared_blueprints for select using (true);
-- But you can only create/edit/remove blueprints you authored.
create policy "blueprints_insert_own" on public.shared_blueprints for insert with check (auth.uid() = user_id);
create policy "blueprints_update_own" on public.shared_blueprints for update using (auth.uid() = user_id);
create policy "blueprints_delete_own" on public.shared_blueprints for delete using (auth.uid() = user_id);

create index if not exists shared_blueprints_course_code_idx on public.shared_blueprints (course_code);

-- ── blueprint_votes ─────────────────────────────────────────────────────────
create table if not exists public.blueprint_votes (
  id           uuid primary key default gen_random_uuid(),
  blueprint_id uuid not null references public.shared_blueprints(id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vote_type    text not null check (vote_type in ('up','down')),
  created_at   timestamptz not null default now(),
  unique (blueprint_id, user_id)
);
alter table public.blueprint_votes enable row level security;

drop policy if exists "votes_read_all"   on public.blueprint_votes;
drop policy if exists "votes_insert_own" on public.blueprint_votes;
drop policy if exists "votes_update_own" on public.blueprint_votes;
drop policy if exists "votes_delete_own" on public.blueprint_votes;
-- Vote counts are public; you can only write your own vote.
create policy "votes_read_all"   on public.blueprint_votes for select using (true);
create policy "votes_insert_own" on public.blueprint_votes for insert with check (auth.uid() = user_id);
create policy "votes_update_own" on public.blueprint_votes for update using (auth.uid() = user_id);
create policy "votes_delete_own" on public.blueprint_votes for delete using (auth.uid() = user_id);

-- ── RPCs — bump the denormalized counters (mirror the production API) ─────────
-- SECURITY DEFINER: runs as the table owner so a signed-in user can increment a
-- count on a blueprint they don't own (voting/importing), without UPDATE rights.
create or replace function public.increment_blueprint_imports(p_id uuid) returns void
  language sql security definer set search_path = public as $$
    update public.shared_blueprints set imports = imports + 1 where id = p_id;
  $$;
create or replace function public.increment_blueprint_upvotes(p_id uuid) returns void
  language sql security definer set search_path = public as $$
    update public.shared_blueprints set upvotes = upvotes + 1 where id = p_id;
  $$;
create or replace function public.decrement_blueprint_upvotes(p_id uuid) returns void
  language sql security definer set search_path = public as $$
    update public.shared_blueprints set upvotes = greatest(0, upvotes - 1) where id = p_id;
  $$;
create or replace function public.increment_blueprint_downvotes(p_id uuid) returns void
  language sql security definer set search_path = public as $$
    update public.shared_blueprints set downvotes = downvotes + 1 where id = p_id;
  $$;
create or replace function public.decrement_blueprint_downvotes(p_id uuid) returns void
  language sql security definer set search_path = public as $$
    update public.shared_blueprints set downvotes = greatest(0, downvotes - 1) where id = p_id;
  $$;

grant execute on function public.increment_blueprint_imports(uuid)   to authenticated;
grant execute on function public.increment_blueprint_upvotes(uuid)   to authenticated;
grant execute on function public.decrement_blueprint_upvotes(uuid)   to authenticated;
grant execute on function public.increment_blueprint_downvotes(uuid) to authenticated;
grant execute on function public.decrement_blueprint_downvotes(uuid) to authenticated;

-- ── Seed content — ONLY real outlines ────────────────────────────────────────
-- Reseed cleanly: wipe the system rows (user_id is null) first, then insert. Your
-- own contributed blueprints (user_id not null) are left untouched.
delete from public.shared_blueprints where user_id is null;

-- ════════════════════════════════════════════════════════════════════════════
-- SUMMER 2026 — the three official syllabi you provided (teacher-verified).
-- ════════════════════════════════════════════════════════════════════════════
insert into public.shared_blueprints
  (user_id, course_code, course_name, professor, author, section, term, verified, upvotes, downvotes, imports, items)
values
  -- ── COMM 217 · Financial Accounting (JMSB) · sec AA · Pierre Hilal ──────────
  -- Quizzes 15% (best 4 of 6) · Simulation 15% · Midterm 30% · Final 40%
  (null, 'COMM 217', 'Financial Accounting', 'Pierre Hilal', 'Pierre Hilal', 'AA', 'Summer 2026', true, 0, 0, 0,
   jsonb_build_array(
     jsonb_build_object('title','Quiz 1 (Ch. 2)','kind','quiz','weight',2.5,'due', timestamptz '2026-05-16 23:00:00-04'),
     jsonb_build_object('title','Quiz 2 (Ch. 3)','kind','quiz','weight',2.5,'due', timestamptz '2026-05-23 23:00:00-04'),
     jsonb_build_object('title','Quiz 3 (Ch. 4 & 5)','kind','quiz','weight',2.5,'due', timestamptz '2026-05-30 23:00:00-04'),
     jsonb_build_object('title','Mid-term exam (Ch. 1–5)','kind','midterm','weight',30,'due', timestamptz '2026-06-01 15:00:00-04'),
     jsonb_build_object('title','Quiz 4 (Ch. 6)','kind','quiz','weight',2.5,'due', timestamptz '2026-06-06 23:00:00-04'),
     jsonb_build_object('title','Accounting simulation','kind','project','weight',15,'due', timestamptz '2026-06-22 23:00:00-04'),
     jsonb_build_object('title','Quiz 5 (Ch. 7 & 8)','kind','quiz','weight',2.5,'due', timestamptz '2026-06-13 23:00:00-04'),
     jsonb_build_object('title','Quiz 6 (Ch. 10, 12)','kind','quiz','weight',2.5,'due', timestamptz '2026-06-20 23:00:00-04'),
     jsonb_build_object('title','Final exam (cumulative)','kind','final','weight',40,'due', timestamptz '2026-06-25 14:00:00-04'))),

  -- ── FINA 210 · Real Estate Finance · sec AA · Michel Deslauriers ───────────
  -- Assignments 10% (3) · Term project 15% · Midterm 30% · Final 45%
  (null, 'FINA 210', 'Real Estate Finance', 'Michel Deslauriers', 'Michel Deslauriers', 'AA', 'Summer 2026', true, 0, 0, 0,
   jsonb_build_array(
     jsonb_build_object('title','Assignment 1','kind','assignment','weight',3,'due', timestamptz '2026-05-21 23:59:00-04'),
     jsonb_build_object('title','Midterm (Topics 1–5)','kind','midterm','weight',30,'due', timestamptz '2026-06-02 11:45:00-04'),
     jsonb_build_object('title','Assignment 2','kind','assignment','weight',3,'due', timestamptz '2026-06-04 23:59:00-04'),
     jsonb_build_object('title','Assignment 3','kind','assignment','weight',4,'due', timestamptz '2026-06-09 23:59:00-04'),
     jsonb_build_object('title','Term project (group)','kind','project','weight',15,'due', timestamptz '2026-06-11 23:59:00-04'),
     jsonb_build_object('title','Final exam (comprehensive)','kind','final','weight',45,'due', timestamptz '2026-06-23 14:00:00-04'))),

  -- ── ECON 203 · Macroeconomics · sec RM · Moshe Lander ──────────────────────
  -- Labs 20% (8, best-attempt) · Midterm 30% (Jul 12) · Final 50%
  (null, 'ECON 203', 'Introduction to Macroeconomics', 'Moshe Lander', 'Moshe Lander', 'RM', 'Summer 2026', true, 0, 0, 0,
   jsonb_build_array(
     jsonb_build_object('title','Lab 1 (Ch. 8)','kind','lab','weight',2.5,'due', timestamptz '2026-05-31 23:59:00-04'),
     jsonb_build_object('title','Lab 2 (Ch. 15)','kind','lab','weight',2.5,'due', timestamptz '2026-06-14 23:59:00-04'),
     jsonb_build_object('title','Lab 3 (Ch. 14–15)','kind','lab','weight',2.5,'due', timestamptz '2026-06-21 23:59:00-04'),
     jsonb_build_object('title','Lab 4','kind','lab','weight',2.5,'due', timestamptz '2026-07-05 23:59:00-04'),
     jsonb_build_object('title','Midterm (1:30–3:15pm)','kind','midterm','weight',30,'due', timestamptz '2026-07-12 13:30:00-04'),
     jsonb_build_object('title','Lab 5','kind','lab','weight',2.5,'due', timestamptz '2026-07-19 23:59:00-04'),
     jsonb_build_object('title','Lab 6','kind','lab','weight',2.5,'due', timestamptz '2026-07-26 23:59:00-04'),
     jsonb_build_object('title','Lab 7','kind','lab','weight',2.5,'due', timestamptz '2026-08-09 23:59:00-04'),
     jsonb_build_object('title','Lab 8','kind','lab','weight',2.5,'due', timestamptz '2026-08-16 23:59:00-04'),
     jsonb_build_object('title','Final exam (cumulative)','kind','final','weight',50,'due', timestamptz '2026-08-16 14:00:00-04')))
;

-- ════════════════════════════════════════════════════════════════════════════
-- WINTER 2026 — your own real blueprints, exported read-only from the live site
-- and reshaped for the dev schema (prod baked the section into course_code, e.g.
-- "COMM 227-X" → code "COMM 227" + section "X"; item kinds inferred from the name;
-- ungraded weight-0 schedule markers dropped). Past term → they sort/show as such.
-- ════════════════════════════════════════════════════════════════════════════
insert into public.shared_blueprints
  (user_id, course_code, course_name, professor, author, section, term, verified, upvotes, downvotes, imports, items)
values
  (null, 'COMM 227', 'Interpersonal and Critical Thinking Skills', 'Ashkan Rostami', 'Ashkan Rostami', 'X', 'Winter 2026', true, 1, 0, 0,
   jsonb_build_array(
     jsonb_build_object('title','Reflection Report 1','kind','assignment','weight',2.5,'due', timestamptz '2026-01-29T23:59:00+00:00'),
     jsonb_build_object('title','Project Progress Report','kind','project','weight',5,'due', timestamptz '2026-02-12T14:45:00+00:00'),
     jsonb_build_object('title','Reflection Report 2','kind','assignment','weight',2.5,'due', timestamptz '2026-02-12T23:59:00+00:00'),
     jsonb_build_object('title','Midterm Exam','kind','midterm','weight',20,'due', timestamptz '2026-02-19T14:45:00+00:00'),
     jsonb_build_object('title','Reflection Report 3','kind','assignment','weight',2.5,'due', timestamptz '2026-03-12T23:59:00+00:00'),
     jsonb_build_object('title','Reflection Report 4','kind','assignment','weight',2.5,'due', timestamptz '2026-03-26T23:59:00+00:00'),
     jsonb_build_object('title','Extra Credit (Research Participation)','kind','assignment','weight',2,'due', timestamptz '2026-04-13T23:59:00+00:00'),
     jsonb_build_object('title','Team Project Video','kind','project','weight',20,'due', timestamptz '2026-04-16T14:45:00+00:00'),
     jsonb_build_object('title','Final Exam','kind','final','weight',35,'due', timestamptz '2026-04-24T14:00:00+00:00'))),
  (null, 'COMM 226', 'Business Technology Management', 'Dr. Raul Valverde', 'Dr. Raul Valverde', 'EC', 'Winter 2026', true, 1, 0, 0,
   jsonb_build_array(
     jsonb_build_object('title','Knowledge Check 1','kind','quiz','weight',0.5,'due', timestamptz '2026-01-18T23:59:00+00:00'),
     jsonb_build_object('title','Knowledge Check 2','kind','quiz','weight',0.5,'due', timestamptz '2026-01-25T23:59:00+00:00'),
     jsonb_build_object('title','Quiz 1','kind','quiz','weight',2.5,'due', timestamptz '2026-01-30T23:59:00+00:00'),
     jsonb_build_object('title','Knowledge Check 3-4','kind','quiz','weight',0.5,'due', timestamptz '2026-02-08T23:59:00+00:00'),
     jsonb_build_object('title','Interactive Case 1','kind','project','weight',2.5,'due', timestamptz '2026-02-14T23:59:00+00:00'),
     jsonb_build_object('title','Knowledge Check 5','kind','quiz','weight',0.5,'due', timestamptz '2026-02-15T23:59:00+00:00'),
     jsonb_build_object('title','Assignment 1 (SAP)','kind','assignment','weight',10,'due', timestamptz '2026-02-20T23:59:00+00:00'),
     jsonb_build_object('title','Knowledge Check 6','kind','quiz','weight',0.5,'due', timestamptz '2026-02-22T23:59:00+00:00'),
     jsonb_build_object('title','Knowledge Check 7','kind','quiz','weight',0.5,'due', timestamptz '2026-03-01T23:59:00+00:00'),
     jsonb_build_object('title','Assignment 2 (Group)','kind','assignment','weight',15,'due', timestamptz '2026-03-20T23:59:00+00:00'),
     jsonb_build_object('title','Knowledge Check 9','kind','quiz','weight',0.5,'due', timestamptz '2026-03-22T23:59:00+00:00'),
     jsonb_build_object('title','Quiz 2','kind','quiz','weight',2.5,'due', timestamptz '2026-03-27T23:59:00+00:00'),
     jsonb_build_object('title','Knowledge Check 10','kind','quiz','weight',0.5,'due', timestamptz '2026-03-29T23:59:00+00:00'),
     jsonb_build_object('title','Assignment 3 (Group)','kind','assignment','weight',15,'due', timestamptz '2026-04-03T23:59:00+00:00'),
     jsonb_build_object('title','Knowledge Check 11','kind','quiz','weight',0.5,'due', timestamptz '2026-04-05T23:59:00+00:00'),
     jsonb_build_object('title','Interactive Case 2','kind','project','weight',2.5,'due', timestamptz '2026-04-10T23:59:00+00:00'),
     jsonb_build_object('title','Knowledge Check 12','kind','quiz','weight',0.5,'due', timestamptz '2026-04-12T23:59:00+00:00'),
     jsonb_build_object('title','Final Exam','kind','final','weight',45,'due', timestamptz '2026-04-20T14:00:00+00:00'))),
  (null, 'COMM 216', 'Ethics, Business Sustainability, and Social Responsibility', 'Prof. Raymond Paquin', 'Prof. Raymond Paquin', 'EC5', 'Winter 2026', true, 1, 0, 0,
   jsonb_build_array(
     jsonb_build_object('title','Smartbook-Chapter 1&3','kind','reading','weight',4,'due', timestamptz '2026-02-02T23:59:00+00:00'),
     jsonb_build_object('title','Quiz-Chapter 1&3','kind','quiz','weight',4,'due', timestamptz '2026-02-06T23:59:00+00:00'),
     jsonb_build_object('title','Smartbook-Chapter 2&8','kind','reading','weight',4,'due', timestamptz '2026-02-13T23:59:00+00:00'),
     jsonb_build_object('title','Assignment 1','kind','assignment','weight',10,'due', timestamptz '2026-02-13T23:59:00+00:00'),
     jsonb_build_object('title','Quiz-Chapter 2&8','kind','quiz','weight',4,'due', timestamptz '2026-02-13T23:59:00+00:00'),
     jsonb_build_object('title','Smartbook-Chapter 5','kind','reading','weight',4,'due', timestamptz '2026-02-23T23:59:00+00:00'),
     jsonb_build_object('title','Quiz-Chapter 5','kind','quiz','weight',4,'due', timestamptz '2026-02-27T23:59:00+00:00'),
     jsonb_build_object('title','Smartbook-Chapter 10','kind','reading','weight',4,'due', timestamptz '2026-03-16T23:59:00+00:00'),
     jsonb_build_object('title','Quiz-Chapter 10','kind','quiz','weight',4,'due', timestamptz '2026-03-20T23:59:00+00:00'),
     jsonb_build_object('title','Smartbook-Chapter 13','kind','reading','weight',4,'due', timestamptz '2026-03-30T23:59:00+00:00'),
     jsonb_build_object('title','Quiz-Chapter 13','kind','quiz','weight',4,'due', timestamptz '2026-04-03T23:59:00+00:00'),
     jsonb_build_object('title','Assignment 2','kind','assignment','weight',10,'due', timestamptz '2026-04-11T23:59:00+00:00'),
     jsonb_build_object('title','Extra Credit (UN Climate Course)','kind','assignment','weight',4,'due', timestamptz '2026-04-11T23:59:00+00:00'),
     jsonb_build_object('title','Final Exam','kind','final','weight',40,'due', timestamptz '2026-04-20T14:00:00+00:00'))),
  (null, 'COMM 316', 'Business Law & Ethics', 'Me Patrice Blais', 'Me Patrice Blais', 'DD', 'Winter 2026', true, 1, 0, 0,
   jsonb_build_array(
     jsonb_build_object('title','Class Test (Ch 1, 2, 9)','kind','midterm','weight',20,'due', timestamptz '2026-02-17T19:15:00+00:00'),
     jsonb_build_object('title','Final Exam (Ch 4, 6, 7, 8)','kind','final','weight',80,'due', timestamptz '2026-04-20T19:00:00+00:00'))),
  (null, 'COMM 221', 'Financial Markets', 'Loretta Hung', 'Loretta Hung', 'J', 'Winter 2026', true, 1, 0, 0,
   jsonb_build_array(
     jsonb_build_object('title','Quiz 1 (Sess 1-3)','kind','quiz','weight',8,'due', timestamptz '2026-02-08T23:59:00+00:00'),
     jsonb_build_object('title','Quiz 2 (Sess 4-5)','kind','quiz','weight',8,'due', timestamptz '2026-02-22T23:59:00+00:00'),
     jsonb_build_object('title','Quiz 3 (Sess 6-7)','kind','quiz','weight',8,'due', timestamptz '2026-03-15T23:59:00+00:00'),
     jsonb_build_object('title','Quiz 4 (Sess 8-9)','kind','quiz','weight',8,'due', timestamptz '2026-03-29T23:59:00+00:00'),
     jsonb_build_object('title','Quiz 5 (Sess 10-11)','kind','quiz','weight',8,'due', timestamptz '2026-04-05T23:59:00+00:00'),
     jsonb_build_object('title','Final Exam','kind','final','weight',60,'due', timestamptz '2026-04-22T09:00:00+00:00'))),
  (null, 'COMM 223', 'Marketing Management 1', 'Stephen J. Laing', 'Stephen J. Laing', 'P', 'Winter 2026', true, 1, 0, 0,
   jsonb_build_array(
     jsonb_build_object('title','Quiz 1','kind','quiz','weight',5,'due', timestamptz '2026-02-05T11:45:00+00:00'),
     jsonb_build_object('title','Mid-Term Exam','kind','midterm','weight',25,'due', timestamptz '2026-02-19T11:45:00+00:00'),
     jsonb_build_object('title','Quiz 2','kind','quiz','weight',5,'due', timestamptz '2026-03-26T11:45:00+00:00'),
     jsonb_build_object('title','Term Project & Peer Eval','kind','project','weight',20,'due', timestamptz '2026-04-09T11:45:00+00:00'),
     jsonb_build_object('title','Marketing Research Practicum','kind','project','weight',4,'due', timestamptz '2026-04-13T23:59:00+00:00'),
     jsonb_build_object('title','Final Exam','kind','final','weight',41,'due', timestamptz '2026-04-16T14:00:00+00:00'))),
  (null, 'COMM 221', 'Financial Markets', 'Radomir Todorov, Ph.D.', 'Radomir Todorov, Ph.D.', 'GG', 'Winter 2026', true, 0, 0, 0,
   jsonb_build_array(
     jsonb_build_object('title','Quiz 1 (Moodle, online)','kind','quiz','weight',8,'due', timestamptz '2026-02-08T23:59:00+00:00'),
     jsonb_build_object('title','Quiz 2 (Moodle, online)','kind','quiz','weight',8,'due', timestamptz '2026-02-22T23:59:00+00:00'),
     jsonb_build_object('title','Quiz 3 (Moodle, online)','kind','quiz','weight',8,'due', timestamptz '2026-03-15T23:59:00+00:00'),
     jsonb_build_object('title','Quiz 4 (Moodle, online)','kind','quiz','weight',8,'due', timestamptz '2026-03-29T23:59:00+00:00'),
     jsonb_build_object('title','Quiz 5 (Moodle, online)','kind','quiz','weight',8,'due', timestamptz '2026-04-15T23:59:00+00:00'),
     jsonb_build_object('title','Final Common Exam (In-person)','kind','final','weight',60,'due', timestamptz '2026-12-31T23:59:00+00:00')))
;
