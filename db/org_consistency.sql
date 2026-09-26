-- Organisation consistency. db/org_consistency.sql. Idempotent.
--
-- ROOT CAUSE (JMMA, @jmmaonline): clubs were readable only by their owner or,
-- once APPROVED, by everyone. No rule let an admin (or the assistant) read a
-- PENDING or BANNED club, while the handle's unique index covers every status.
-- So when JMMA was set back to pending for its handoff (db/jmma_fix.sql), an
-- authorised lookup returned nothing and creating it said the handle existed.
-- Separately, its handoff link had one of two uses spent, and a spent link on
-- a club JOINS rather than claims, so the real claimant would have become a
-- member of a club nobody owned.
--
-- 1. Admins and the assistant identity read every club, at any status.
-- 2. Handles are unique regardless of case (none collided when this shipped).
-- 3. A link used on a club with no owner and no active team CLAIMS it.

drop policy if exists orgs_admin_read on public.organizations;
create policy orgs_admin_read on public.organizations
  for select to authenticated using (public.is_admin() or public.ct_is_assistant());

create unique index if not exists organizations_handle_lower_key on public.organizations (lower(handle));

CREATE OR REPLACE FUNCTION public.accept_org_invite(p_token text, p_force boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare inv record; target_org uuid; uemail text; uname text; av text; h text; removed int;
begin
  if auth.uid() is null then
    raise exception 'Sign in to accept an invite.';
  end if;
  select * into inv from org_invites where token = p_token for update;
  if inv is null then raise exception 'This invite link is not valid.'; end if;
  if inv.use_count >= inv.max_uses then raise exception 'This invite link has already been used.'; end if;
  if inv.expires_at < now() then raise exception 'This invite link has expired.'; end if;
  if inv.revoked_at is not null then raise exception 'This invite was cancelled.'; end if;

  -- ADMIN = DRY RUN BY DEFAULT (unchanged): validate, write nothing.
  if public.is_admin() and not coalesce(p_force, false) then
    return jsonb_build_object('org_id', inv.org_id, 'dry_run', true);
  end if;

  select email into uemail from auth.users where id = auth.uid();
  select name, avatar_url into uname, av from public.user_profile where user_id = auth.uid();

  -- A DIRECT invite belongs to the person it was sent to. A forwarded link
  -- must not let somebody else claim a club meant for them.
  if coalesce(inv.kind, 'link') = 'user' and inv.recipient_user is distinct from auth.uid() then
    raise exception 'This invite was sent to someone else. Ask for your own.';
  end if;
  if coalesce(inv.kind, 'link') = 'email'
     and lower(coalesce(uemail, '')) <> lower(coalesce(inv.recipient_email, '')) then
    raise exception 'This invite was sent to another email address. Sign in with that address to accept it.';
  end if;

  -- ── JOIN: the link has already been claimed once ─────────────────────────
  -- ...unless the club has NO owner and NO active team: then there is nobody to
  -- join, and this use is the handoff. (db/org_consistency.sql. Without this,
  -- a handoff link whose first use had been spent, like JMMA's, made its real
  -- claimant a plain member of an ownerless club.)
  if inv.use_count > 0 and inv.org_id is not null
     and (exists (select 1 from organizations o where o.id = inv.org_id and o.owner_id is not null)
          or exists (select 1 from org_members m where m.org_id = inv.org_id and m.status = 'active')) then
    if not exists (select 1 from organizations where id = inv.org_id) then
      raise exception 'This organization no longer exists.';
    end if;
    if exists (select 1 from organizations o where o.id = inv.org_id and o.owner_id = auth.uid())
       or exists (select 1 from org_members m where m.org_id = inv.org_id and m.status = 'active'
                   and (m.user_id = auth.uid()
                        or (uemail is not null and m.email is not null and lower(m.email) = lower(uemail)))) then
      raise exception 'You already have access to this organization.';
    end if;
    insert into org_members (org_id, user_id, name, email, role, status, joined_at, avatar_url)
      values (inv.org_id, auth.uid(), coalesce(uname, split_part(coalesce(uemail, ''), '@', 1)),
              uemail, 'member', 'active', now(), av);
    update org_invites set use_count = use_count + 1 where id = inv.id;
    insert into org_invite_events (invite_id, kind, user_id, email) values (inv.id, 'join', auth.uid(), uemail);
    return jsonb_build_object('org_id', inv.org_id, 'dry_run', false, 'joined', true);
  end if;

  -- ── CLAIM a prefilled club (handoff) ─────────────────────────────────────
  if inv.org_id is not null then
    if not exists (select 1 from organizations where id = inv.org_id) then
      raise exception 'This organization no longer exists.';
    end if;
    delete from org_members where org_id = inv.org_id;
    get diagnostics removed = row_count;
    insert into org_members (org_id, user_id, name, email, role, status, joined_at, avatar_url)
      values (inv.org_id, auth.uid(), coalesce(uname, inv.org_name),
              coalesce(uemail, inv.recipient_email), 'owner', 'active', now(), av);
    perform set_config('ct.org_claim', '1', true);
    update organizations set owner_id = auth.uid() where id = inv.org_id;
    perform set_config('ct.org_claim', '', true);
    update org_invites set use_count = use_count + 1, claimed_at = now(), claimed_by = auth.uid() where id = inv.id;
    insert into org_invite_events (invite_id, kind, user_id, email) values (inv.id, 'claim', auth.uid(), uemail);
    return jsonb_build_object('org_id', inv.org_id, 'dry_run', false, 'removed_members', removed);
  end if;

  -- ── CREATE (self-setup) ──────────────────────────────────────────────────
  -- A cap rather than a flat refusal: running two clubs is normal (the
  -- sign-in page offers one button per club), a pile of them is not.
  if (select count(*) from organizations o where o.owner_id = auth.uid()) >= 3 then
    raise exception 'This account already manages three organizations.';
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
  -- The club this link produced: later uses join it rather than try to
  -- create a second one under a handle that is now taken.
  update org_invites
     set use_count = use_count + 1, org_id = target_org, claimed_at = now(), claimed_by = auth.uid()
   where id = inv.id;
  insert into org_invite_events (invite_id, kind, user_id, email) values (inv.id, 'claim', auth.uid(), uemail);
  return jsonb_build_object('org_id', target_org, 'dry_run', false, 'removed_members', 0);
end $function$;
