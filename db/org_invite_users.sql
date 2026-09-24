-- ─────────────────────────────────────────────────────────────────────────────
-- Inviting people who are ALREADY on the site to a club's team.
--
-- The Team page could only invite by email, which builds a link for somebody
-- who is not on the site yet. For an existing user that is the wrong funnel:
-- they already have an account and a bell, so the invite should arrive there
-- and be accepted in one tap.
--
--   org_find_invitees(org, q)      search by name / handle (partial) or email
--                                  (EXACT only — an email is not browsable)
--   org_invite_user(org, user, role_id, title)
--                                  a pending row BOUND to that account + a
--                                  notification linking to the accept page
--   org_invite_by_email(org, name, email, role_id, title)
--                                  if the address belongs to an account, this
--                                  IS org_invite_user; otherwise an email invite
--   decline_org_member_invite(token)
--   accept_org_member_invite(token) refuses a bound invite for anybody else
--
-- Why a column and not "match the email": a user invite must reach exactly the
-- person picked from the list. Forwarding the link must not hand the seat to
-- whoever opens it, and a changed email must not orphan it.
--
-- Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.org_members
  add column if not exists invited_user uuid references auth.users(id) on delete cascade;

create index if not exists org_members_invited_user_idx
  on public.org_members (invited_user) where invited_user is not null;

-- Who may send a team invite: the same rule as the write policy on this table.
create or replace function public.ct_can_invite_team(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.org_perm(p_org, 'manage_team')
      or public.ct_admin_write()
      or exists (select 1 from public.organizations o where o.id = p_org and o.owner_id = auth.uid())
$$;

-- A role the caller may hand out: in this club, not an owner role, strictly
-- below the caller (owners and platform admins rank above everything).
create or replace function public.ct_grantable_role(p_org uuid, p_role uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.org_roles r
     where r.id = p_role and r.org_id = p_org and not r.is_owner
       and r.position < public.ct_org_position(p_org)
  )
$$;

-- ── Search ──────────────────────────────────────────────────────────────────
drop function if exists public.org_find_invitees(uuid, text);
create function public.org_find_invitees(p_org uuid, p_q text)
returns table (user_id uuid, name text, handle text, avatar_url text, by_email boolean, state text)
language plpgsql stable security definer set search_path = public as $$
declare
  q text := lower(trim(coalesce(p_q, '')));
  bare text := ltrim(lower(trim(coalesce(p_q, ''))), '@');
begin
  if auth.uid() is null or not public.ct_can_invite_team(p_org) then
    raise exception 'You cannot invite people to this team.' using errcode = '42501';
  end if;
  if length(bare) < 2 then return; end if;

  return query
  with hits as (
    -- email: exact only, so the box cannot be used to enumerate addresses
    select u.id as uid, true as by_email
      from auth.users u
     where position('@' in q) > 1 and lower(u.email) = q
    union
    select p.user_id, false
      from public.user_profile p
     where not (position('@' in q) > 1)
       and (lower(coalesce(p.handle, '')) like bare || '%'
            or lower(coalesce(p.name, '')) like '%' || bare || '%')
  )
  select h.uid, p.name, p.handle, p.avatar_url, bool_or(h.by_email),
         (select case when m.status = 'active' then 'member' else 'invited' end
            from public.org_members m
           where m.org_id = p_org and (m.user_id = h.uid or m.invited_user = h.uid)
           order by (m.status = 'active') desc limit 1)
    from hits h
    join public.user_profile p on p.user_id = h.uid
   where h.uid <> auth.uid()
     and not exists (select 1 from public.agent_accounts a where a.user_id = h.uid)
     and not public.ct_blocked_between(auth.uid(), h.uid)
   group by h.uid, p.name, p.handle, p.avatar_url
   order by bool_or(h.by_email) desc, p.handle nulls last
   limit 8;
end $$;

-- ── Invite an account ───────────────────────────────────────────────────────
drop function if exists public.org_invite_user(uuid, uuid, uuid, text);
create function public.org_invite_user(p_org uuid, p_user uuid, p_role_id uuid, p_title text default null)
returns table (member_id uuid, invite_token text)
language plpgsql security definer set search_path = public as $$
declare
  v_token text := replace(gen_random_uuid()::text, '-', '') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  v_id uuid;
  v_name text;
  v_email text;
  v_org text;
  v_role text;
  v_legacy text;
begin
  if auth.uid() is null or not public.ct_can_invite_team(p_org) then
    raise exception 'You cannot invite people to this team.' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'You are already on this team.' using detail = 'self';
  end if;
  if not public.ct_grantable_role(p_org, p_role_id) then
    raise exception 'You can only invite people to a role below your own.' using errcode = '42501';
  end if;
  if public.ct_blocked_between(auth.uid(), p_user) then
    raise exception 'That person cannot be invited.' using detail = 'blocked';
  end if;

  select u.email into v_email from auth.users u where u.id = p_user;
  if v_email is null then raise exception 'No such account.' using detail = 'missing'; end if;

  if exists (select 1 from public.org_members m
              where m.org_id = p_org and m.status = 'active'
                and (m.user_id = p_user or lower(m.email) = lower(v_email))) then
    raise exception 'They are already on this team.' using detail = 'member';
  end if;
  if exists (select 1 from public.org_members m
              where m.org_id = p_org and m.status = 'invited'
                and (m.invited_user = p_user or lower(m.email) = lower(v_email))) then
    raise exception 'They already have an invite waiting.' using detail = 'invited';
  end if;

  select coalesce(nullif(trim(p.name), ''), p.handle, split_part(v_email, '@', 1))
    into v_name from public.user_profile p where p.user_id = p_user;
  select o.name into v_org from public.organizations o where o.id = p_org;
  select r.name, case when r.position >= 50 then 'admin' else 'member' end
    into v_role, v_legacy from public.org_roles r where r.id = p_role_id;

  insert into public.org_members (org_id, name, email, role, role_id, title, status, invite_token, invited_user)
  values (p_org, coalesce(v_name, 'Invited member'), v_email, v_legacy, p_role_id,
          nullif(trim(coalesce(p_title, '')), ''), 'invited', v_token, p_user)
  returning id into v_id;

  perform public.ct_notify(
    array[p_user], 'org_invite',
    'You were invited to join ' || coalesce(v_org, 'a club') || '''s team',
    'As ' || coalesce(v_role, 'Member') || '. Open to accept or decline.',
    '/organizer/join/' || v_token, p_org, null);

  perform public.ct_org_log(p_org, 'member_invite',
    'invited ' || coalesce(v_name, 'someone') || ' as ' || coalesce(v_role, 'Member'),
    'member', v_id::text, null, jsonb_build_object('invited_user', p_user, 'role_id', p_role_id));

  return query select v_id, v_token;
end $$;

-- ── Invite an address ───────────────────────────────────────────────────────
drop function if exists public.org_invite_by_email(uuid, text, text, uuid, text);
create function public.org_invite_by_email(
  p_org uuid, p_name text, p_email text, p_role_id uuid, p_title text default null)
returns table (member_id uuid, invite_token text, existing_user boolean, name text)
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_user uuid;
  v_token text := replace(gen_random_uuid()::text, '-', '') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  v_id uuid;
  v_legacy text;
  v_role text;
begin
  if auth.uid() is null or not public.ct_can_invite_team(p_org) then
    raise exception 'You cannot invite people to this team.' using errcode = '42501';
  end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'That is not an email address.' using detail = 'email';
  end if;

  -- The address already belongs to somebody: invite THEM, in the app.
  select u.id into v_user from auth.users u where lower(u.email) = v_email limit 1;
  if v_user is not null then
    return query
      select i.member_id, i.invite_token, true,
             (select m.name from public.org_members m where m.id = i.member_id)
        from public.org_invite_user(p_org, v_user, p_role_id, p_title) i;
    return;
  end if;

  if not public.ct_grantable_role(p_org, p_role_id) then
    raise exception 'You can only invite people to a role below your own.' using errcode = '42501';
  end if;
  if exists (select 1 from public.org_members m
              where m.org_id = p_org and lower(m.email) = v_email and m.status in ('active', 'invited')) then
    raise exception 'That address already has an invite or a seat.' using detail = 'invited';
  end if;

  select r.name, case when r.position >= 50 then 'admin' else 'member' end
    into v_role, v_legacy from public.org_roles r where r.id = p_role_id;

  insert into public.org_members (org_id, name, email, role, role_id, title, status, invite_token)
  values (p_org, coalesce(nullif(trim(coalesce(p_name, '')), ''), split_part(v_email, '@', 1)),
          v_email, v_legacy, p_role_id, nullif(trim(coalesce(p_title, '')), ''), 'invited', v_token)
  returning id into v_id;

  perform public.ct_org_log(p_org, 'member_invite',
    'invited ' || v_email || ' as ' || coalesce(v_role, 'Member'),
    'member', v_id::text, null, jsonb_build_object('email', v_email, 'role_id', p_role_id));

  return query select v_id, v_token, false,
    coalesce(nullif(trim(coalesce(p_name, '')), ''), split_part(v_email, '@', 1));
end $$;

-- ── Accept (bound) / decline ────────────────────────────────────────────────
create or replace function public.accept_org_member_invite(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare m_id uuid; m_org uuid; m_for uuid; av text;
begin
  if auth.uid() is null then raise exception 'You must be signed in to accept an invite.'; end if;
  select id, org_id, invited_user into m_id, m_org, m_for
    from public.org_members where invite_token = p_token and status = 'invited';
  if m_id is null then return null; end if;
  -- An invite made for a specific account is for that account only.
  if m_for is not null and m_for <> auth.uid() then
    raise exception 'This invite was sent to a different account.' using detail = 'wrong_account';
  end if;
  select avatar_url into av from public.user_profile where user_id = auth.uid();
  update public.org_members
    set status = 'active', user_id = auth.uid(), joined_at = now(), invite_token = null,
        invited_user = null, avatar_url = coalesce(av, avatar_url)
    where id = m_id;
  return m_org;
end $$;

create or replace function public.decline_org_member_invite(p_token text)
returns boolean language plpgsql security definer set search_path = public as $$
declare m_id uuid; m_org uuid; m_name text;
begin
  if auth.uid() is null then return false; end if;
  select id, org_id, name into m_id, m_org, m_name
    from public.org_members
   where invite_token = p_token and status = 'invited' and invited_user = auth.uid();
  if m_id is null then return false; end if;
  delete from public.org_members where id = m_id;
  -- Logged as the club's history: the decliner is not on the team, so the
  -- entry is written by the definer and names what happened.
  insert into public.org_activity (org_id, actor_name, actor_email, actor_user, action, detail, entity_type, entity_id)
  select m_org, coalesce(m_name, 'Someone'), coalesce(u.email, ''), auth.uid(), 'member_decline',
         'declined the invite to join the team', 'member', m_id::text
    from auth.users u where u.id = auth.uid();
  return true;
end $$;

-- What the accept page shows, for a signed-in invitee (bound or not).
drop function if exists public.org_member_invite_info(text);
create function public.org_member_invite_info(p_token text)
returns table (org_name text, member_name text, role_name text, for_you boolean, bound boolean)
language sql stable security definer set search_path = public as $$
  select o.name, m.name, coalesce(r.name, initcap(m.role)),
         m.invited_user is not null and m.invited_user = auth.uid(),
         m.invited_user is not null
    from public.org_members m
    join public.organizations o on o.id = m.org_id
    left join public.org_roles r on r.id = m.role_id
   where m.invite_token = p_token and m.status = 'invited'
$$;

revoke all on function public.ct_can_invite_team(uuid), public.ct_grantable_role(uuid, uuid) from public, anon;
grant execute on function public.org_find_invitees(uuid, text),
  public.org_invite_user(uuid, uuid, uuid, text),
  public.org_invite_by_email(uuid, text, text, uuid, text),
  public.accept_org_member_invite(text),
  public.decline_org_member_invite(text),
  public.org_member_invite_info(text) to authenticated;
