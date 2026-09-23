-- ============================================================================
-- org_member_guard.sql — the team table cannot be used to promote yourself.
--
-- FOUND WHILE BUILDING THE ROLES PAGE. `org_members_write` is a FOR ALL policy
-- keyed on `manage_team`, which is right for "invite people and remove them"
-- and wrong for everything else that table can say. Anybody holding that one
-- permission (a Secretary, say) could, straight through the API:
--
--   • update their OWN row to the Owner role, or write a `permissions`
--     override granting themselves every key — `org_perm` reads the override
--     BEFORE the role, so the override wins;
--   • insert an "invite" with their own email and status 'active', which
--     `ct_org_my_member` then matches by email;
--   • delete the row of somebody above them, owners included.
--
-- And `org_invites_admin` let the same permission mint a HANDOFF invite for
-- the club — the kind that replaces the owner — and accept it themselves.
--
-- `set_org_member_role`, `transfer_org_ownership` and the accept verbs already
-- check the hierarchy properly; the hole was that nothing forced anybody to go
-- through them. This trigger does.
--
-- THE TEST IS `current_user`, NOT `auth.role()`. Inside a SECURITY DEFINER
-- function `current_user` is the function's owner while `auth.role()` still
-- reports the caller's JWT, so this lets every existing verb through
-- unchanged and stops only writes that arrive through PostgREST directly.
-- ============================================================================

-- The role a row points at, read with the owner's rights: the trigger below
-- runs as the CALLER (see why), and a caller's view of org_roles is filtered.
create or replace function public.ct_role_meta(p_role uuid, out pos int, out owner boolean)
language sql stable security definer set search_path to 'public' as $$
  select r.position, r.is_owner from public.org_roles r where r.id = p_role;
$$;
revoke all on function public.ct_role_meta(uuid) from public;
grant execute on function public.ct_role_meta(uuid) to authenticated;

-- DELIBERATELY NOT SECURITY DEFINER. Inside a definer function `current_user`
-- is the function's owner, so a definer trigger would see the owner on every
-- write and wave everything through — which is exactly what the first
-- version of this file did, and what its test caught.
create or replace function public.ct_guard_org_members()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_org     uuid := coalesce(new.org_id, old.org_id);
  am_owner  boolean;
  my_pos    int;
  r_pos     int;
  r_owner   boolean;
  mine      boolean;
begin
  -- A verb (SECURITY DEFINER) or the platform itself: it checked its own rules.
  if current_user not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;
  -- A human platform admin in the console. An agent account is NOT this —
  -- `ct_admin_write()` is false for it by design.
  if public.ct_admin_write() then
    return coalesce(new, old);
  end if;

  am_owner := public.ct_org_is_owner(v_org);
  my_pos   := public.ct_org_position(v_org);

  if tg_op = 'INSERT' then
    -- Owners invite whoever they like, including a co-owner (the onboarding
    -- "invite your president as an owner" path).
    if am_owner then return new; end if;

    if new.user_id is not null
       or coalesce(new.status, 'invited') <> 'invited'
       or new.permissions is not null then
      raise exception 'A new teammate joins by accepting an invite.'
        using errcode = '42501';
    end if;

    -- `trg_default_member_role` has already filled role_id from the legacy
    -- column (it sorts first), so this sees the role they would really get.
    select m.pos, m.owner into r_pos, r_owner from public.ct_role_meta(new.role_id) m;
    if coalesce(r_owner, false) or new.role = 'owner'
       or coalesce(r_pos, 2147483647) >= my_pos then
      raise exception 'You can only invite people to a role below your own.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Never, for anybody but a platform admin: moving a row to another club
    -- or onto another account is not an edit.
    if new.org_id is distinct from old.org_id
       or new.user_id is distinct from old.user_id then
      raise exception 'That cannot be changed here.' using errcode = '42501';
    end if;

    if am_owner then return new; end if;

    -- Access lives in these columns. A role changes through
    -- set_org_member_role (which checks both ends of the hierarchy), an invite
    -- is accepted through its verb, and a per-person permission override is
    -- an owner's call alone.
    if new.role is distinct from old.role
       or new.role_id is distinct from old.role_id
       or new.permissions is distinct from old.permissions
       or new.status is distinct from old.status
       or new.email is distinct from old.email
       or new.invite_token is distinct from old.invite_token
       or new.joined_at is distinct from old.joined_at then
      raise exception 'Roles and access change from the Roles page.'
        using errcode = '42501';
    end if;
    -- Name, title and photo are what somebody is called, not what they may do.
    return new;
  end if;

  -- DELETE
  if am_owner then return old; end if;

  mine := old.user_id = auth.uid()
          or (old.email is not null
              and lower(old.email) = lower(coalesce(auth.jwt() ->> 'email', '')));
  -- Leaving is always allowed.
  if mine then return old; end if;

  select m.pos, m.owner into r_pos, r_owner from public.ct_role_meta(old.role_id) m;
  if coalesce(r_owner, false) or old.role = 'owner'
     or coalesce(r_pos, 0) >= my_pos then
    raise exception 'You can only remove people below your own role.'
      using errcode = '42501';
  end if;
  return old;
end
$$;

-- `trg_g…` sorts after `trg_default_member_role`, and same-timing triggers run
-- in name order, so the INSERT check sees the role the default filled in.
drop trigger if exists trg_guard_org_members on public.org_members;
create trigger trg_guard_org_members
  before insert or update or delete on public.org_members
  for each row execute function public.ct_guard_org_members();

-- ── Handoff invites ──────────────────────────────────────────────────────────
-- An invite carrying an org_id hands the club to whoever accepts it. That is
-- the owner's decision, or ours. The one exception is a club nobody owns yet —
-- the Alfred flow creates it ownerless and hands it over — and even there it
-- takes the Admin level, not merely `manage_team`.
drop policy if exists "org_invites_admin" on public.org_invites;
create policy "org_invites_admin" on public.org_invites for all
  using (
    public.ct_admin_write()
    or (org_id is not null
        and (public.ct_org_is_owner(org_id)
             or (not exists (select 1 from public.organizations o
                              where o.id = org_id and o.owner_id is not null)
                 and public.org_perm(org_id, 'manage_team')
                 and public.ct_org_position(org_id) >= 50)))
  )
  with check (
    public.ct_admin_write()
    or (org_id is not null
        and (public.ct_org_is_owner(org_id)
             or (not exists (select 1 from public.organizations o
                              where o.id = org_id and o.owner_id is not null)
                 and public.org_perm(org_id, 'manage_team')
                 and public.ct_org_position(org_id) >= 50)))
  );
