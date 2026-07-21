-- ── Granular org permissions (Discord-style) + teammate avatars ──────────────
-- WHAT:
--   1. org_members.permissions (jsonb) — per-member overrides for four
--      capabilities: manage_events, edit_profile, view_insights, manage_team.
--      Absent → the role's default (owner/admin = everything, member = view
--      only). org_perm(org, perm) resolves owner OR member+permission and now
--      backs the write policies, so a granted member can do exactly what their
--      toggles say — enforced in the database, not just the UI.
--   2. org_members.avatar_url — a snapshot of the member's profile photo (the
--      same denormalize-pattern as feedback authors, since RLS hides other
--      users' profiles). Backfilled now; kept fresh by the accept RPCs.
--   3. Any active member can read their org's team list + activity trail.
--
-- RUN AFTER the matching app deploy. Safe to re-run.

alter table public.org_members add column if not exists permissions jsonb;
alter table public.org_members add column if not exists avatar_url text;

-- Owner OR an active member whose effective permission allows p_perm.
create or replace function public.org_perm(p_org uuid, p_perm text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from organizations o where o.id = p_org and o.owner_id = auth.uid())
  or exists (
    select 1 from org_members m
    where m.org_id = p_org
      and m.status = 'active'
      and (
        m.user_id = auth.uid()
        or (m.email is not null and lower(m.email) = lower(coalesce(auth.jwt()->>'email', '')))
      )
      and coalesce((m.permissions ->> p_perm)::boolean, m.role in ('owner', 'admin'))
  );
$$;
grant execute on function public.org_perm(uuid, text) to authenticated, anon;

-- Any active membership at all (team/activity visibility).
create or replace function public.is_org_member(p_org uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from org_members m
    where m.org_id = p_org
      and m.status = 'active'
      and (
        m.user_id = auth.uid()
        or (m.email is not null and lower(m.email) = lower(coalesce(auth.jwt()->>'email', '')))
      )
  );
$$;
grant execute on function public.is_org_member(uuid) to authenticated, anon;

-- Policies move from role-based (is_org_editor) to permission-based.
drop policy if exists "events_owner_write" on public.events;
create policy "events_owner_write" on public.events for all
  using (public.org_perm(events.org_id, 'manage_events'))
  with check (public.org_perm(events.org_id, 'manage_events'));

drop policy if exists "orgs_owner_write" on public.organizations;
create policy "orgs_owner_write" on public.organizations for update
  using (auth.uid() = owner_id or public.org_perm(id, 'edit_profile'))
  with check (auth.uid() = owner_id or public.org_perm(id, 'edit_profile'));

drop policy if exists "org_members_read" on public.org_members;
create policy "org_members_read" on public.org_members for select using (
  invite_token is not null
  or exists (select 1 from public.organizations o where o.id = org_id and o.owner_id = auth.uid())
  or user_id = auth.uid()
  or (email is not null and lower(email) = lower(coalesce(auth.jwt()->>'email', '')))
  or public.is_org_member(org_id)
);
drop policy if exists "org_members_write" on public.org_members;
create policy "org_members_write" on public.org_members for all
  using (public.org_perm(org_id, 'manage_team')
         or exists (select 1 from public.organizations o where o.id = org_id and o.owner_id = auth.uid()))
  with check (public.org_perm(org_id, 'manage_team')
              or exists (select 1 from public.organizations o where o.id = org_id and o.owner_id = auth.uid()));

drop policy if exists "org_activity_read" on public.org_activity;
create policy "org_activity_read" on public.org_activity for select using (
  exists (select 1 from public.organizations o where o.id = org_id and o.owner_id = auth.uid())
  or public.is_org_member(org_id)
);

-- Backfill avatar snapshots for existing members (by user id, then email).
update public.org_members m
set avatar_url = p.avatar_url
from public.user_profile p
where m.avatar_url is null
  and p.avatar_url is not null
  and (m.user_id = p.user_id
       or (m.email is not null and p.email is not null and lower(m.email) = lower(p.email)));

-- Accept RPCs now snapshot the accepter's avatar too.
create or replace function public.accept_org_member_invite(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare m_id uuid; m_org uuid; av text;
begin
  if auth.uid() is null then raise exception 'You must be signed in to accept an invite.'; end if;
  select id, org_id into m_id, m_org
    from public.org_members where invite_token = p_token and status = 'invited';
  if m_id is null then return null; end if;
  select avatar_url into av from public.user_profile where user_id = auth.uid();
  update public.org_members
    set status = 'active', user_id = auth.uid(), joined_at = now(), invite_token = null,
        avatar_url = coalesce(av, avatar_url)
    where id = m_id;
  return m_org;
end; $$;

create or replace function public.accept_org_invite(p_token text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare inv record; new_org uuid; uemail text; av text; h text;
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
  if exists (select 1 from organizations o where o.owner_id = auth.uid()) then
    raise exception 'This account already manages an organization.';
  end if;
  h := case when left(inv.org_handle, 1) = '@' then inv.org_handle else '@' || inv.org_handle end;
  if exists (select 1 from organizations o where lower(o.handle) = lower(h)) then
    raise exception 'An organization with the handle % already exists.', h;
  end if;
  select email into uemail from auth.users where id = auth.uid();
  select avatar_url into av from public.user_profile where user_id = auth.uid();
  insert into organizations (owner_id, handle, name, verified, glyph, color, bio, status)
    values (auth.uid(), h, inv.org_name, false, inv.glyph, inv.color, '', 'pending')
    returning id into new_org;
  insert into org_members (org_id, user_id, name, email, role, status, joined_at, avatar_url)
    values (new_org, auth.uid(), inv.org_name, coalesce(uemail, inv.recipient_email), 'owner', 'active', now(), av);
  update org_invites set use_count = use_count + 1 where id = inv.id;
  return new_org;
end; $$;
