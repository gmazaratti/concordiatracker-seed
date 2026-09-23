-- ============================================================================
-- A club can be deleted by ConcordiaTracker, and by nobody else.
--
-- WHAT WAS LIVE: `orgs_owner_delete`, from phase10_organizer.sql —
--     for delete using (auth.uid() = owner_id)
-- so any owner could remove their club with one API call. Nothing in the app
-- offered it, but the policy is what the database obeys, not the UI. And a
-- delete here CASCADES into twelve tables — events, posts, stories, messages
-- both ways, followers, members, roles, invites, reposts, collaborations and
-- the audit log that would have said who did it. There is no undo for that.
--
-- THE RULE, from the user: there is no delete-club permission, not even for
-- the owner. Deletion happens on request, by us.
--
-- TWO LAYERS, because either alone has a hole:
--   1. The policy goes. With RLS on and no DELETE policy, PostgREST refuses
--      every end-user delete outright.
--   2. A BEFORE DELETE trigger refuses any delete made under an end-user
--      token that is not a human platform admin. This is what covers the
--      SECURITY DEFINER paths, which bypass RLS: `admin_delete_org` runs as
--      its owner, and it checks `is_admin()` — which is TRUE for the Alfred
--      agent account. `ct_admin_write()` is admin AND NOT an agent, so the
--      console still works for a person and an agent is refused even if a
--      future endpoint forgets to withhold the verb.
--
-- BACKEND CONTEXTS PASS: the SQL editor, the CLI and the service role carry
-- no end-user role, and they are how we would do it on request.
-- ============================================================================

drop policy if exists "orgs_owner_delete" on public.organizations;

create or replace function public.ct_guard_org_delete()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon')
     and not public.ct_admin_write() then
    raise exception 'A club can only be deleted by ConcordiaTracker. Write to us and we will do it.'
      using errcode = '42501';
  end if;
  return old;
end $$;

drop trigger if exists trg_guard_org_delete on public.organizations;
create trigger trg_guard_org_delete
  before delete on public.organizations
  for each row execute function public.ct_guard_org_delete();

-- ── Checks ──────────────────────────────────────────────────────────────────
--   as an owner:   delete from organizations where id = '<theirs>';  -- 0 rows (no policy)
--   as an owner:   select admin_delete_org('<theirs>');              -- not authorized
--   as Alfred:     select admin_delete_org('<any>');                 -- 42501 from the trigger
--   as the founder in the console: works.
