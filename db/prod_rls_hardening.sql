-- ============================================================================
-- GATE 2 — RLS / security hardening (run on the PRODUCTION project, in the
-- Supabase SQL Editor) BEFORE a second person ever signs in.
--
-- It is SAFE + idempotent: it only tightens permissions. It does NOT touch any
-- data and can be re-run. Nothing the launch app does breaks (verified against
-- the app code). Each change is explained above it.
-- ============================================================================

-- ── 0. Already correct (no change needed — shown for your confirmation) ──────
--   courses / assignments / todos / user_profile are already locked per-user:
--   every read & write requires  auth.uid() = user_id.  So nobody can ever see
--   or change another person's courses, deadlines, tasks, or profile.
--   (The big SELECT at the bottom prints these so you can see them.)

-- ── 1. shared_blueprints — stop owners forging trust signals ─────────────────
--   Blueprints are PUBLIC (anyone signed in can read them). Today an owner can
--   UPDATE their own blueprint row — including flipping verified=true (a FAKE
--   "teacher-verified" badge) or inflating upvotes. The launch app never edits a
--   blueprint directly (students only post new ones + vote via secure functions),
--   so we simply remove direct UPDATE rights. The upvote/import counters keep
--   working because they're bumped by SECURITY DEFINER functions, which are
--   unaffected by this.
revoke update on public.shared_blueprints from authenticated, anon;
drop policy if exists "blueprints_update_own" on public.shared_blueprints;
--   (When the teacher portal ships later, teacher-verifying a blueprint will go
--    through a small SECURITY DEFINER function instead of a direct update.)
--
--   Also pin the INSERT: a client may post a blueprint, but it must be UNVERIFIED
--   with zero counters. This blocks minting a fake "verified" badge (or fake
--   votes) via INSERT. The app's normal post sends verified=false / counts=0, so
--   it still passes; only a forgery (verified=true, upvotes=9999) is rejected.
drop policy if exists "blueprints_insert_own" on public.shared_blueprints;
create policy "blueprints_insert_own" on public.shared_blueprints for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.user_profile p
                where p.user_id = auth.uid() and coalesce(p.can_upload_blueprints, true))
    and verified = false
    and coalesce(upvotes, 0)   = 0
    and coalesce(downvotes, 0) = 0
    and coalesce(imports, 0)   = 0
  );

-- ── 2. access_requests — submissions only through the safe function ──────────
--   "Request teacher/organizer access" is submitted by submit_access_request(),
--   a SECURITY DEFINER function that forces status='pending'. The open insert
--   policy let someone craft a row directly (e.g. status='accepted'). Remove it;
--   the function still works (it runs with elevated rights).
drop policy if exists "req_insert" on public.access_requests;

-- ── 3. bug_reports — require a real owner, keep "public" admin-only ───────────
--   Read is already locked (you see only your own bugs, plus admin-published
--   "known issues"). Tighten INSERT so a bug must belong to the signed-in user
--   (no anonymous/spoofed rows) and can only be marked public by an admin.
drop policy if exists "bugs_insert" on public.bug_reports;
create policy "bugs_insert" on public.bug_reports for insert
  with check (user_id = auth.uid() and (public = false or public.is_admin()));

-- ── 4. user_stats — nothing to do ───────────────────────────────────────────
--   This table does not exist in this project (usage meters are computed in the
--   app, not stored). Listed only so the checklist is complete.

-- ============================================================================
-- CONFIRMATION — run this last; it prints every policy on the key tables so you
-- can SEE the lockdown. Expect: courses/assignments/todos/user_profile = own;
-- shared_blueprints = public read + own insert/delete (NO update); bug_reports =
-- own/public read + the tightened insert; access_requests = read-own only.
-- ============================================================================
select tablename, policyname, cmd, qual as using_expr, with_check
from pg_catalog.pg_policies
where schemaname = 'public'
  and tablename in ('courses','assignments','todos','user_profile',
                    'shared_blueprints','blueprint_votes','access_requests',
                    'bug_reports','feature_requests','admins')
order by tablename, cmd, policyname;
