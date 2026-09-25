-- Teacher gate: who counts as a teacher is the DATABASE'S decision.
--
-- WHAT WAS WRONG, measured 2026-09-25:
--   1. "Continue as …" on /teacher upserted teacher_accounts with
--      status = 'approved', and `teacher_self_update` let the owner rewrite
--      their own row, so any signed-in student could make themselves an
--      approved teacher.
--   2. `ann_author_insert` only checked author_id = auth.uid(), so ANY
--      signed-in account could post an announcement to every student in any
--      course, portal or not.
--   3. The other way round: `blueprints_insert_own` requires verified = false
--      and there is no update policy, so a genuine teacher pressing Publish
--      was refused silently. Nobody could publish a teacher-verified outline.
--
-- AFTER THIS FILE: a teacher account starts pending whatever the client
-- sends, only an admin moves it to approved (Admin → Portals), and only an
-- approved teacher (or an admin) can post announcements or publish a
-- verified outline. Idempotent; safe to re-run.

-- ── 1. Status is set by an admin, never by the account holder ────────────
create or replace function public.ct_guard_teacher_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- The SQL editor / service role (no auth.uid()) and admins decide freely.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'pending';
  else
    new.status := old.status;
    new.user_id := old.user_id;
  end if;
  return new;
end $$;

drop trigger if exists ct_guard_teacher_status on public.teacher_accounts;
create trigger ct_guard_teacher_status
  before insert or update on public.teacher_accounts
  for each row execute function public.ct_guard_teacher_status();

-- ── 2. The one question every write below asks ───────────────────────────
create or replace function public.ct_is_approved_teacher()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.teacher_accounts
    where user_id = auth.uid() and status = 'approved'
  )
$$;
grant execute on function public.ct_is_approved_teacher() to authenticated;

-- ── 3. Announcements: approved teachers (and admins) only ─────────────────
-- Deleting stays open to the author, so a teacher whose approval is revoked
-- can still take down what they posted.
drop policy if exists ann_author_insert on public.announcements;
create policy ann_author_insert on public.announcements
  for insert to authenticated
  with check (auth.uid() = author_id and (public.ct_is_approved_teacher() or public.is_admin()));

drop policy if exists ann_author_update on public.announcements;
create policy ann_author_update on public.announcements
  for update to authenticated
  using (auth.uid() = author_id and (public.ct_is_approved_teacher() or public.is_admin()))
  with check (auth.uid() = author_id and (public.ct_is_approved_teacher() or public.is_admin()));

-- ── 4. Verified outlines: approved teachers can publish and update them ──
-- Student uploads keep their own policy (verified = false). These two are
-- the teacher half, which did not exist, so publishing never worked.
drop policy if exists blueprints_insert_teacher on public.shared_blueprints;
create policy blueprints_insert_teacher on public.shared_blueprints
  for insert to authenticated
  with check (
    auth.uid() = user_id and verified = true and public.ct_is_approved_teacher()
    and coalesce(upvotes, 0) = 0 and coalesce(downvotes, 0) = 0 and coalesce(imports, 0) = 0
  );

drop policy if exists blueprints_update_teacher on public.shared_blueprints;
create policy blueprints_update_teacher on public.shared_blueprints
  for update to authenticated
  using (auth.uid() = user_id and verified = true and public.ct_is_approved_teacher())
  with check (auth.uid() = user_id and verified = true and public.ct_is_approved_teacher());

-- UPDATE on this table was withheld from users on purpose, and stays that
-- way for everything except an outline's CONTENT: a teacher can rewrite what
-- their outline says, never its votes, import count or owner. Column grants,
-- not a trigger, so there is no code path that could forget.
grant update (course_code, course_name, professor, author, section, term, items, verified)
  on public.shared_blueprints to authenticated;

-- Removed in favour of the column grant above, if an earlier draft made it.
drop trigger if exists ct_guard_blueprint_counts on public.shared_blueprints;
drop function if exists public.ct_guard_blueprint_counts();

-- ── 5. The admin's switch ────────────────────────────────────────────────
create or replace function public.admin_set_teacher_status(p_teacher_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if p_status not in ('pending', 'approved') then raise exception 'bad status %', p_status; end if;
  update public.teacher_accounts set status = p_status where id = p_teacher_id;
end $$;
grant execute on function public.admin_set_teacher_status(uuid, text) to authenticated;
