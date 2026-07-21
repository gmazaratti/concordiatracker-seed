-- ── Shared org dashboards + ConcordiaTracker co-owners + GameDev banner ──────
-- WHAT: until now only organizations.owner_id (one account) could edit an org
-- or its events. This extends edit rights to ACTIVE org_members with role
-- owner/admin — matched by user id OR email, so a membership row works the
-- moment that Google account signs in (no pre-registration needed).
-- Then it grants BOTH ConcordiaTracker accounts co-owner access to the
-- @concordiatracker org, and sets the new GameDev banner.
--
-- RUN AFTER the matching app deploy is live. Safe to re-run.

-- Membership check used inside policies. SECURITY DEFINER so it can read
-- org_members without tripping that table's own RLS (no policy recursion).
create or replace function public.is_org_editor(p_org uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from org_members m
    where m.org_id = p_org
      and m.status = 'active'
      and m.role in ('owner', 'admin')
      and (
        m.user_id = auth.uid()
        or (m.email is not null
            and lower(m.email) = lower(coalesce(auth.jwt()->>'email', '')))
      )
  );
$$;
grant execute on function public.is_org_editor(uuid) to authenticated, anon;

-- events: writable by the org owner OR an owner/admin member.
drop policy if exists "events_owner_write" on public.events;
create policy "events_owner_write" on public.events for all
  using (
    exists (select 1 from public.organizations o where o.id = events.org_id and o.owner_id = auth.uid())
    or public.is_org_editor(events.org_id)
  )
  with check (
    exists (select 1 from public.organizations o where o.id = events.org_id and o.owner_id = auth.uid())
    or public.is_org_editor(events.org_id)
  );

-- organizations: profile editable by the owner OR an owner/admin member.
drop policy if exists "orgs_owner_write" on public.organizations;
create policy "orgs_owner_write" on public.organizations for update
  using (auth.uid() = owner_id or public.is_org_editor(id))
  with check (auth.uid() = owner_id or public.is_org_editor(id));

-- org_members: you can always read your OWN membership row (that's how the app
-- finds your shared dashboard); editors read + manage the whole team. The
-- invite-token read path (accept pages) stays.
drop policy if exists "org_members_read" on public.org_members;
create policy "org_members_read" on public.org_members for select using (
  invite_token is not null
  or exists (select 1 from public.organizations o where o.id = org_id and o.owner_id = auth.uid())
  or user_id = auth.uid()
  or (email is not null and lower(email) = lower(coalesce(auth.jwt()->>'email', '')))
  or public.is_org_editor(org_id)
);
drop policy if exists "org_members_write" on public.org_members;
create policy "org_members_write" on public.org_members for all
  using (
    exists (select 1 from public.organizations o where o.id = org_id and o.owner_id = auth.uid())
    or public.is_org_editor(org_id)
  )
  with check (
    exists (select 1 from public.organizations o where o.id = org_id and o.owner_id = auth.uid())
    or public.is_org_editor(org_id)
  );

-- Co-owner memberships for the ConcordiaTracker org (skip any that exist).
-- user_id fills in when that email already has an auth account; the email
-- match in is_org_editor covers it either way.
insert into public.org_members (org_id, user_id, name, email, role, status, joined_at)
select o.id, u.id, v.name, v.email, 'owner', 'active', now()
from public.organizations o
cross join (values
  ('ConcordiaTracker', 'concordiatracker@gmail.com'),
  ('Alex Degryse', 'alexxdegryse@gmail.com')
) as v(name, email)
left join auth.users u on lower(u.email) = lower(v.email)
where o.handle = '@concordiatracker'
  and not exists (
    select 1 from public.org_members m
    where m.org_id = o.id and lower(m.email) = lower(v.email)
  );

-- GameDev banner (deployed at concordiatracker.com/logos/).
update public.organizations
set banner = '/logos/gamedev-banner.jpg'
where handle = '@concordiagamedev';
