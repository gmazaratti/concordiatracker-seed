-- ── Handing an organisation over: who holds it before, and who holds it after
--
-- An organisation created through the admin API is a PLACEHOLDER. Somebody
-- sets it up — profile, logo, banner, first events — and then a real club
-- claims it with a single-use link. Two things have to be true for that to
-- work, and neither was.
--
-- BEFORE THE CLAIM: NO OWNER. `admin_create_org` already leaves owner_id
-- null, but ct_agent_create_org then added its caller as an OWNER-role
-- member, so the team list showed an owner and the org did not read as
-- unclaimed. The caller is now an ADMIN-role member instead: same rights
-- (org_perm defaults every permission to true for owner AND admin), no claim
-- on the organisation.
--
-- WHY A MEMBER ROW AT ALL, rather than no row and a bypass for unclaimed
-- orgs. Because "an admin may write to any organisation nobody has claimed"
-- is the rule that let an agent reach @reggiesmtl and every other placeholder
-- profile set up for a real venue. A membership row is explicit, appears in
-- the team list, and is removed by the claim below. A bypass is invisible and
-- applies to organisations nobody meant to include.
--
-- AFTER THE CLAIM: NOBODY ELSE. The handoff path added the claimer and left
-- everyone who had been setting the org up still on the team, and only set
-- owner_id when it happened to be null. So "hand this club to its president"
-- left the previous holder with full access and, if the org already had an
-- owner, left ownership where it was. A handoff invite exists for exactly one
-- purpose; it now does that purpose completely.
--
-- RUN in the Supabase SQL editor. Safe to re-run.

-- ── Created unowned ─────────────────────────────────────────────────────────

create or replace function public.ct_agent_create_org(
  p_name text,
  p_handle text,
  p_glyph text,
  p_color text,
  p_bio text default '',
  p_logo text default null,
  p_banner text default null,
  p_verified boolean default false
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_org uuid; v_email text; v_name text;
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  v_org := public.admin_create_org(p_name, p_handle, p_glyph, p_color, p_bio, p_logo, p_banner, p_verified);

  select email into v_email from auth.users where id = v_uid;
  select name into v_name from public.user_profile where user_id = v_uid;

  -- ADMIN, NOT OWNER. Everything needed to set the organisation up, and no
  -- claim on it: owner_id stays null and the team list shows no owner until
  -- a real club accepts the handoff link.
  insert into public.org_members (org_id, user_id, name, email, role, status, joined_at)
  values (v_org, v_uid, coalesce(v_name, split_part(v_email, '@', 1), 'Admin'),
          v_email, 'admin', 'active', now());

  return v_org;
end;
$$;
grant execute on function public.ct_agent_create_org(text, text, text, text, text, text, text, boolean) to authenticated;

-- ── Claimed exclusively ─────────────────────────────────────────────────────

create or replace function public.accept_org_invite(p_token text)
returns jsonb
language plpgsql security definer set search_path = public as $$
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

  -- ADMIN = DRY RUN: the link is fully validated, nothing is written, no use
  -- is consumed — test the flow, then send the same link.
  if public.is_admin() then
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
end $$;
grant execute on function public.accept_org_invite(text) to authenticated;

-- ── The reason the transfer never happened ──────────────────────────────────
--
-- `ct_guard_org_status` is a BEFORE trigger that, for any caller who is not an
-- admin, puts owner_id back: `new.owner_id := old.owner_id`. That is the right
-- guard — it is what stops a student handing themselves an organisation — and
-- it reads auth.uid() from the SESSION, so a SECURITY DEFINER function does
-- not get past it either.
--
-- Which means accepting a handoff invite has NEVER set organizations.owner_id.
-- The old code's `if org_owner is null then update ...` was discarded by the
-- trigger every time; the claimer got an owner-ROLE member row, which grants
-- access through org_perm, and the organisation itself stayed unowned. Found
-- by checking the row after a real claim rather than by reading the function.
--
-- The escape hatch is the one this schema already uses for exactly this shape
-- of problem: a transaction-local setting that only the vetted path sets, the
-- same way apply_for_org uses `ct.org_apply`. It relaxes owner_id AND NOTHING
-- ELSE — status and verified stay pinned, so claiming a link can never
-- approve or verify the organisation on the way through.
create or replace function public.ct_guard_org_status()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status      := 'pending';
    new.verified    := false;
    new.owner_id    := auth.uid();
    -- Filed through apply_for_org, not by hand, so the shape is ours.
    if coalesce(current_setting('ct.org_apply', true), '') <> '1' then
      new.application := null;
      new.applied_at  := null;
    end if;
  else
    new.status      := old.status;
    new.verified    := old.verified;
    -- Ownership moves only through accept_org_invite, which sets this for the
    -- length of its own transaction. Every other update keeps the old owner.
    if coalesce(current_setting('ct.org_claim', true), '') <> '1' then
      new.owner_id  := old.owner_id;
    end if;
    new.application := old.application;
    new.applied_at  := old.applied_at;
  end if;

  return new;
end; $$;
