-- ============================================================================
-- Phase 9 — Teacher portal (teacher_accounts + announcements).
-- RUN THIS IN YOUR concordiatracker-dev PROJECT ONLY (SQL Editor → paste → Run).
--
-- Only TWO small tables — the headline feature (publish a course outline → it
-- becomes a teacher-verified blueprint) REUSES the existing `shared_blueprints`
-- table from Phase 5, so there's nothing new for that.
--   • teacher_accounts — who is a teacher + approval status (the publish gate).
--   • announcements    — a teacher posts → students see it on Today + course detail.
--     Keyed by COURSE CODE (like blueprints) — per-user course ids differ between
--     a teacher and a student, so the code is the shared match key.
--
-- NOTE (connection-phase, flagged): in dev a teacher can self-set their account
-- to "approved" and anyone can insert a verified blueprint — the UI gates this.
-- Real server-side approval/verification gating (an admin-only RLS check) is a
-- later hardening pass.
-- ============================================================================

-- ── teacher_accounts ──────────────────────────────────────────────────────────
create table if not exists public.teacher_accounts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  email      text not null,
  status     text not null default 'pending',  -- pending | approved
  created_at timestamptz not null default now(),
  unique (user_id)
);
alter table public.teacher_accounts enable row level security;

drop policy if exists "teacher_self_read"   on public.teacher_accounts;
drop policy if exists "teacher_self_insert" on public.teacher_accounts;
drop policy if exists "teacher_self_update" on public.teacher_accounts;
create policy "teacher_self_read"   on public.teacher_accounts for select using (auth.uid() = user_id);
create policy "teacher_self_insert" on public.teacher_accounts for insert with check (auth.uid() = user_id);
-- dev: lets the admin console flip status to approved (real approval is admin-only).
create policy "teacher_self_update" on public.teacher_accounts for update using (auth.uid() = user_id);

-- ── announcements ─────────────────────────────────────────────────────────────
create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  course_code text not null,                 -- "COMM 217" — the match key
  author_id   uuid references auth.users(id) on delete set null, -- null = seeded
  author_name text,
  title       text not null,
  body        text default '',
  posted_at   timestamptz not null default now(),
  edited_at   timestamptz
);
alter table public.announcements enable row level security;

create index if not exists announcements_course_code_idx on public.announcements (course_code);

drop policy if exists "ann_public_read"   on public.announcements;
drop policy if exists "ann_author_insert" on public.announcements;
drop policy if exists "ann_author_update" on public.announcements;
drop policy if exists "ann_author_delete" on public.announcements;
-- Course announcements are public read (students filter to their own courses).
create policy "ann_public_read"   on public.announcements for select using (true);
create policy "ann_author_insert" on public.announcements for insert with check (auth.uid() = author_id);
create policy "ann_author_update" on public.announcements for update using (auth.uid() = author_id);
create policy "ann_author_delete" on public.announcements for delete using (auth.uid() = author_id);

-- ── Seed announcements (author_id null = system seed) ─────────────────────────
-- Keyed to codes you're likely to have (your Summer courses) + a few others so
-- the digest shows something. Re-running reseeds the system rows only.
delete from public.announcements where author_id is null;
insert into public.announcements (course_code, author_name, title, body, posted_at) values
  ('COMM 217', 'Pierre Hilal', 'Midterm coverage posted', 'The midterm covers chapters 1–5; a formula sheet will be provided.', now() - interval '2 days'),
  ('FINA 210', 'Michel Deslauriers', 'Term project groups due Friday', 'Form your group of 4 and submit names on Moodle before the weekend.', now() - interval '1 days'),
  ('ECON 203', 'Moshe Lander', 'Lab 2 deadline reminder', 'Lab 2 is due Sunday 11:59 PM on MyLab — your first attempt is the graded one.', now() - interval '6 hours'),
  ('COMP 248', 'Dr. Aiman Hanna', 'Assignment 2 deadline extended', 'You now have until Friday 11:59 PM to submit the inheritance assignment.', now()),
  ('MATH 205', 'Dr. Galia Dafni', 'Office hours moved to Thursday', 'This week only — Thursday 2–4 PM in LB 619 instead of Wednesday.', now() - interval '1 days'),
  ('POLI 202', 'Dr. Daniel Salée', 'Guest lecture on Quebec federalism', 'Wednesday''s class features a guest speaker — attendance counts toward participation.', now() - interval '3 days');
