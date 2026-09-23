-- ============================================================================
-- An admin can walk the invite flow for real, on purpose.
-- RUN IN: Supabase SQL Editor. Safe to re-run. Non-destructive.
--
-- THE PROBLEM. `accept_org_invite` treats an admin accept as a DRY RUN: the
-- link is validated and nothing is consumed, so the same link still works for
-- the club it was sent to. That default is right — an admin opening a
-- recipient's link must not burn it — but it left no way for the founder to
-- go through the flow, which reads from the seat as the button doing nothing.
--
-- THE FIX IS AN OPT-IN, not a removal. `p_force` makes an admin accept a real
-- one, and every other caller ignores it entirely: a non-admin was never on
-- the dry-run path, so the parameter cannot widen anybody's access. The UI
-- shows it as a second, deliberate action after the verification result.
--
-- The body below is `pg_get_functiondef` on the live function with exactly two
-- lines changed (the signature and the dry-run condition), not a rewrite —
-- the last function written from memory had an invented signature, an invented
-- column order and a column name that does not exist.
-- ============================================================================

create or replace function public.accept_org_invite(
  p_token text,
  -- Only consulted when the caller is an admin. It is the difference between
  -- "check this link works" and "set this up on my account".
  p_force boolean default false
)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare inv record; target_org uuid; uemail text; uname text; av text; h text; removed int;
begin
  if auth.uid() is null then
    raise exception 'Sign in to accept an invite.';
  end if;
  select * into inv from org_invites where token = p_token for update;
  if inv is null then
    raise exception 'This invite link is not valid.';
  end if;
  if inv.use_count >= inv.max_uses then
    raise exception 'This invite link has already been used.';
  end if;
  if inv.expires_at < now() then
    raise exception 'This invite link has expired.';
  end if;

  -- ADMIN = DRY RUN BY DEFAULT: the link is fully validated, nothing is
  -- written, no use is consumed — test the flow, then send the same link.
  -- `p_force` is how the founder walks it for real.
  if public.is_admin() and not coalesce(p_force, false) then
    return jsonb_build_object('org_id', inv.org_id, 'dry_run', true);
  end if;

  select email into uemail from auth.users where id = auth.uid();
  select name, avatar_url into uname, av from public.user_profile where user_id = auth.uid();

  if inv.org_id is not null then
    -- HANDOFF: the claimer takes the organisation, and takes it alone.
    if not exists (select 1 from organizations where id = inv.org_id) then
      raise exception 'This organization no longer exists.';
    end if;
    if exists (
      select 1 from org_members m
      where m.org_id = inv.org_id and m.status = 'active'
        and (m.user_id = auth.uid()
             or (uemail is not null and m.email is not null and lower(m.email) = lower(uemail)))
    ) then
      raise exception 'You already have access to this organization.';
    end if;

    -- EVERYONE ELSE GOES FIRST, including whoever set the organisation up.
    -- A handoff link means the club now runs this, and leaving the previous
    -- holder on the team is the difference between handing something over and
    -- sharing it. Counted so the caller can see it happened.
    delete from org_members where org_id = inv.org_id;
    get diagnostics removed = row_count;

    insert into org_members (org_id, user_id, name, email, role, status, joined_at, avatar_url)
      values (inv.org_id, auth.uid(), coalesce(uname, inv.org_name),
              coalesce(uemail, inv.recipient_email), 'owner', 'active', now(), av);

    -- UNCONDITIONALLY, not only when it was null. Ownership is the other half
    -- of access: clearing the team while leaving owner_id pointing somewhere
    -- else would keep that account in through a different door.
    --
    -- The setting is what gets this past ct_guard_org_status, which otherwise
    -- pins owner_id for every non-admin caller. Transaction-local, so it
    -- cannot leak into anything else the session goes on to do.
    perform set_config('ct.org_claim', '1', true);
    update organizations set owner_id = auth.uid() where id = inv.org_id;
    perform set_config('ct.org_claim', '', true);

    update org_invites set use_count = use_count + 1 where id = inv.id;
    return jsonb_build_object('org_id', inv.org_id, 'dry_run', false, 'removed_members', removed);
  end if;

  -- CREATE a brand-new org (the original path).
  if exists (select 1 from organizations o where o.owner_id = auth.uid()) then
    raise exception 'This account already manages an organization.';
  end if;
  h := case when left(inv.org_handle, 1) = '@' then inv.org_handle else '@' || inv.org_handle end;
  if exists (select 1 from organizations o where lower(o.handle) = lower(h)) then
    raise exception 'An organization with the handle % already exists.', h;
  end if;
  insert into organizations (owner_id, handle, name, verified, glyph, color, bio, status)
    values (auth.uid(), h, inv.org_name, false, inv.glyph, inv.color, '', 'pending')
    returning id into target_org;
  insert into org_members (org_id, user_id, name, email, role, status, joined_at, avatar_url)
    values (target_org, auth.uid(), inv.org_name, coalesce(uemail, inv.recipient_email), 'owner', 'active', now(), av);
  update org_invites set use_count = use_count + 1 where id = inv.id;
  return jsonb_build_object('org_id', target_org, 'dry_run', false, 'removed_members', 0);
end $function$;

grant execute on function public.accept_org_invite(text, boolean) to authenticated;

/*
 * THE ONE-ARGUMENT VERSION IS DROPPED.
 *
 * `create or replace` with a new parameter OVERLOADS rather than replaces, and
 * PostgREST then cannot choose between the two — it answers PGRST203, which
 * reads exactly like the function not existing. The default on `p_force` means
 * every existing single-argument call keeps working against the new one.
 */
drop function if exists public.accept_org_invite(text);

-- ── Checks ──────────────────────────────────────────────────────────────────
--   select public.accept_org_invite('<token>');          -- admin: dry_run true
--   select public.accept_org_invite('<token>', true);    -- admin: real accept
