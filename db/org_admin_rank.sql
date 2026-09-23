-- ============================================================================
-- A platform admin outranks a club's own hierarchy.
-- RUN IN: Supabase SQL Editor. Safe to re-run.
--
-- ── THE BUG ─────────────────────────────────────────────────────────────────
-- Reported: signed in as the founder on @concordia.president, every role on
-- the Roles page locked and nothing editable.
--
-- Measured before changing anything: that club has `owner_id` NULL and ZERO
-- `org_members` rows — nobody owns it, and the founder reaches it through
-- `is_admin()`, not through membership. That is by design (god-mode access is
-- invisible: it grants without putting the platform accounts on anybody's
-- team). But it left permissions and RANK disagreeing:
--
--   org_perm(org, 'roles_grant')  -> true   (via ct_admin_write)
--   ct_org_position(org)          -> -1     (no member row, not the owner)
--
-- and every check reads "the role has to sit strictly below you", so -1 put
-- every role above them. The permission said yes and the ladder said no.
--
-- ── THE FIX, and why it is in `position` and not in each check ──────────────
-- Rank is the thing that was wrong, so rank is what changes. Four call sites
-- compare against `ct_org_position` — creating a role, editing one, deleting
-- one, granting one — and patching each to also ask "…or are they an admin?"
-- is four places to forget it the fifth time.
--
-- `ct_admin_write()` is admin AND NOT an agent, so an Alfred token still has
-- no rank here: it can publish content where it is a member and it cannot
-- restructure somebody's team.
-- ============================================================================

create or replace function public.ct_org_position(p_org uuid)
returns int language sql stable security definer
set search_path to 'public' as $$
  select case
    -- An owner, or a platform admin acting in the console, is above every
    -- role a club can define. The sentinel rather than a large number, so a
    -- club cannot reach it by creating a role at position 2147483646.
    when public.ct_org_is_owner(p_org) or public.ct_admin_write() then 2147483647
    else coalesce((select r.position from public.org_members m
                     join public.org_roles r on r.id = m.role_id
                    where m.org_id = p_org
                      and coalesce(m.status,'active') = 'active'
                      and (m.user_id = auth.uid()
                           or (m.email is not null
                               and lower(m.email) = lower(coalesce(auth.jwt()->>'email',''))))
                    limit 1), -1)
  end;
$$;

-- ── Checks ──────────────────────────────────────────────────────────────────
--   -- as a platform admin on a club they do not own:
--   select ct_org_position('<org>');            -- 2147483647
--   select ct_org_may_manage_role('<admin role>');  -- true
--   -- the Owner role stays fixed for everybody, which is what owner means:
--   select ct_org_may_manage_role('<owner role>');  -- false
