-- ============================================================================
-- Direct invites: send a club invite to an EMAIL or to an existing USER.
--
-- Built on org_invites like every invite (same uses, expiry and open/claim
-- tracking). What is new:
--   kind            'link' (the default, every existing row) | 'email' | 'user'
--   recipient_user  who a 'user' invite was sent to
--   revoked_at/by   Cancel: invalidates immediately, KEEPS the row and its
--                   trail (a cancelled invite is history, not nothing)
--
-- A DIRECT INVITE IS BOUND TO ITS RECIPIENT: a 'user' invite can only be
-- accepted by that account, an 'email' invite only by an account with that
-- email. Otherwise forwarding the link would hand somebody else a club meant
-- for the person you confirmed. Plain link invites are unchanged: existing
-- rows are all 'link' and behave exactly as before, including the ones that
-- carry an optional recipient_email from the old form.
--
-- A 'user' invite also drops an in-app notification; the email for both
-- kinds is sent by /api/admin?action=invite-email (Resend), because email
-- needs a server key. Re-runnable.
-- ============================================================================

alter table public.org_invites add column if not exists kind text;
update public.org_invites set kind = 'link' where kind is null;
alter table public.org_invites alter column kind set default 'link';
do $$ begin
  alter table public.org_invites add constraint org_invites_kind_ck check (kind in ('link', 'email', 'user'));
exception when duplicate_object then null; end $$;
alter table public.org_invites add column if not exists recipient_user uuid references auth.users (id) on delete set null;
alter table public.org_invites add column if not exists revoked_at timestamptz;
alter table public.org_invites add column if not exists revoked_by uuid references auth.users (id) on delete set null;

drop function if exists public.get_org_invite(text);
create or replace function public.get_org_invite(p_token text)
returns table (org_name text, org_handle text, recipient_email text, status text, mode text, claimed boolean, kind text)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
  select i.org_name, i.org_handle, i.recipient_email,
         case when i.revoked_at is not null then 'revoked'
              when i.use_count >= i.max_uses then 'used'
              when i.expires_at < now() then 'expired'
              else 'valid' end,
         coalesce(i.mode, case when i.org_id is null then 'self' else 'prefilled' end),
         (i.use_count > 0),
         coalesce(i.kind, 'link')
    from org_invites i
   where i.token = p_token;
end $$;
grant execute on function public.get_org_invite(text) to anon, authenticated;

create or replace function public.accept_org_invite(p_token text, p_force boolean default false)
returns jsonb
language plpgsql security definer set search_path = public as $$
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
  if inv.use_count > 0 and inv.org_id is not null then
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
end $$;

drop function if exists public.admin_create_club_invite(text, text, text, int, timestamptz, text, text, text);
create or replace function public.admin_create_club_invite(
  p_name text,
  p_handle text,
  p_mode text,
  p_max_uses int default 1,
  p_expires_at timestamptz default null,
  p_color text default '#5b9cf6',
  p_bio text default '',
  p_email text default null,
  p_kind text default 'link',
  p_recipient_user uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare h text; bare text; problem text; glyph text; tok text; new_org uuid; words text[];
        target_email text; k text := coalesce(p_kind, 'link');
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if length(coalesce(trim(p_name), '')) < 2 then raise exception 'Give the club a name.'; end if;
  if p_mode not in ('self', 'prefilled') then raise exception 'Unknown mode.'; end if;
  if k not in ('link', 'email', 'user') then raise exception 'Unknown invite kind.'; end if;
  target_email := nullif(lower(trim(coalesce(p_email, ''))), '');
  if k = 'email' and (target_email is null or target_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then
    raise exception 'Enter a valid email address.';
  end if;
  if k = 'user' then
    if p_recipient_user is null then raise exception 'Choose who to invite.'; end if;
    select lower(u.email) into target_email from auth.users u where u.id = p_recipient_user;
    if target_email is null then raise exception 'That account no longer exists.'; end if;
  end if;
  bare := lower(regexp_replace(coalesce(p_handle, ''), '^@+', ''));
  problem := public.org_handle_problem(bare, null);
  if problem is not null then raise exception '%', problem; end if;
  -- An unclaimed self-setup invite reserves nothing in organizations, so two
  -- open invites could promise the same handle. Refuse the second one.
  if exists (select 1 from org_invites i
              where lower(regexp_replace(i.org_handle, '^@+', '')) = bare
                and i.org_id is null and i.use_count < i.max_uses and i.expires_at > now()) then
    raise exception 'Another open invite already offers @%.', bare;
  end if;
  h := '@' || bare;
  words := regexp_split_to_array(trim(p_name), '\s+');
  glyph := upper(case when array_length(words, 1) >= 2 then left(words[1], 1) || left(words[2], 1)
                      else left(words[1], 2) end);
  -- 128 bits from two v4 UUIDs, no pgcrypto: unguessable, and URL-safe.
  tok := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  tok := left(tok, 40);

  if p_mode = 'prefilled' then
    -- Approved: the admin built it. setup_completed_at stays null, so the
    -- person who claims it lands in the wizard to review everything.
    insert into organizations (owner_id, handle, name, verified, glyph, color, bio, status)
      values (null, h, trim(p_name), false, glyph, coalesce(p_color, '#5b9cf6'), coalesce(p_bio, ''), 'approved')
      returning id into new_org;
  end if;

  insert into org_invites (token, org_name, org_handle, glyph, color, recipient_email,
                           max_uses, expires_at, org_id, mode, created_by, kind, recipient_user)
  values (tok, trim(p_name), h, glyph, coalesce(p_color, '#5b9cf6'), target_email,
          greatest(1, coalesce(p_max_uses, 1)), coalesce(p_expires_at, now() + interval '30 days'),
          new_org, p_mode, auth.uid(), k, case when k = 'user' then p_recipient_user end);

  -- A platform user hears about it where they already are: an in-app
  -- notification that opens the invite. (The email goes out from the API.)
  if k = 'user' then
    perform public.ct_notify(array[p_recipient_user], 'club_invite',
      'You''re invited to run ' || trim(p_name),
      'Open the invite to set up ' || h || ' on ConcordiaTracker.',
      '/join/' || tok, null, 'ConcordiaTracker');
  end if;
  return jsonb_build_object('token', tok, 'org_id', new_org, 'kind', k, 'email', target_email);
end $$;
revoke all on function public.admin_create_club_invite(text, text, text, int, timestamptz, text, text, text, text, uuid) from public, anon;
grant execute on function public.admin_create_club_invite(text, text, text, int, timestamptz, text, text, text, text, uuid) to authenticated;

create or replace function public.admin_revoke_club_invite(p_token text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update org_invites set revoked_at = coalesce(revoked_at, now()), revoked_by = coalesce(revoked_by, auth.uid())
   where token = p_token;
end $$;
revoke all on function public.admin_revoke_club_invite(text) from public, anon;
grant execute on function public.admin_revoke_club_invite(text) to authenticated;

drop function if exists public.admin_club_invites();
create or replace function public.admin_club_invites()
returns table (
  token text, org_name text, org_handle text, mode text, recipient_email text,
  max_uses int, use_count int, expires_at timestamptz, created_at timestamptz,
  org_id uuid, org_status text, opens int, first_open_at timestamptz, last_open_at timestamptz,
  signed_in_opens int, claimed_at timestamptz, claimed_email text,
  kind text, revoked_at timestamptz,
  recipient_name text, recipient_handle text, recipient_avatar text
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return query
  select i.token, i.org_name, i.org_handle,
         coalesce(i.mode, case when i.org_id is null then 'self' else 'prefilled' end),
         i.recipient_email, i.max_uses, i.use_count, i.expires_at, i.created_at,
         i.org_id, o.status,
         -- Legacy rows predate the event table: fall back to their counter.
         greatest(coalesce(ev.opens, 0), case when ev.opens is null then i.opened_count else 0 end),
         ev.first_at, coalesce(ev.last_at, i.last_opened_at),
         coalesce(ev.signed_in, 0),
         i.claimed_at, cu.email::text,
         coalesce(i.kind, 'link'), i.revoked_at,
         rp.name, rp.handle, rp.avatar_url
    from org_invites i
    left join user_profile rp on rp.user_id = i.recipient_user
    left join organizations o on o.id = i.org_id
    left join auth.users cu on cu.id = i.claimed_by
    left join lateral (
      select count(*)::int opens, min(e.at) first_at, max(e.at) last_at,
             count(*) filter (where e.user_id is not null)::int signed_in
        from org_invite_events e where e.invite_id = i.id and e.kind = 'open'
    ) ev on true
   order by i.created_at desc;
end $$;
revoke all on function public.admin_club_invites() from public, anon;
grant execute on function public.admin_club_invites() to authenticated;

-- ── Admin: find a person to invite ───────────────────────────────────────────
-- Any account (public or private — this is the admin console), matched on
-- name, handle or email; every word must match. Internal accounts are left
-- out: you do not invite a probe to run a club.
create or replace function public.admin_find_users(p_q text, p_limit int default 8)
returns table (user_id uuid, name text, handle text, avatar_url text, email text)
language plpgsql stable security definer set search_path = public as $$
declare words text[];
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  words := array_remove(regexp_split_to_array(lower(regexp_replace(coalesce(p_q, ''), '@', '', 'g')), '\s+'), '');
  if coalesce(array_length(words, 1), 0) = 0 then return; end if;
  return query
  select p.user_id, p.name, p.handle, p.avatar_url, u.email::text
    from user_profile p
    join auth.users u on u.id = p.user_id
   where not coalesce(p.is_internal, false)
     and (select bool_and(lower(coalesce(p.name, '') || ' ' || coalesce(p.handle, '') || ' ' || coalesce(u.email, '')) like '%' || w || '%')
            from unnest(words) w)
   order by p.name nulls last
   limit greatest(1, least(coalesce(p_limit, 8), 25));
end $$;
revoke all on function public.admin_find_users(text, int) from public, anon;
grant execute on function public.admin_find_users(text, int) to authenticated;
