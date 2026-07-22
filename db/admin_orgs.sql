-- ── Admin: create + fully set up an organization, then hand it off ───────────
-- Lets the platform admin spin up a brand-new org (profile and all) that has NO
-- owner yet, then mint a handoff invite (org_invites.org_id) so a club claims it.
-- Also grants the admin write access to ANY org (foundation for managing more
-- than one), so is_admin() can edit/manage everything without being a member.
--
-- RUN AFTER the matching app deploy. Safe to re-run.

-- admin_create_org: ownerless org, fully profiled, ready to hand off.
create or replace function public.admin_create_org(
  p_name text,
  p_handle text,
  p_glyph text,
  p_color text,
  p_bio text default '',
  p_logo text default null,
  p_banner text default null,
  p_verified boolean default true
) returns uuid
language plpgsql security definer set search_path = public as $$
declare h text; new_id uuid;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if length(coalesce(trim(p_name), '')) < 2 then raise exception 'Name is required.'; end if;
  h := case when left(p_handle, 1) = '@' then p_handle else '@' || p_handle end;
  if exists (select 1 from organizations where lower(handle) = lower(h)) then
    raise exception 'An organization with the handle % already exists.', h;
  end if;
  insert into organizations (owner_id, handle, name, verified, glyph, color, bio, logo, banner, status)
    values (null, h, trim(p_name), coalesce(p_verified, true), p_glyph, p_color,
            coalesce(p_bio, ''), p_logo, p_banner, 'approved')
    returning id into new_id;
  return new_id;
end $$;
grant execute on function public.admin_create_org(text, text, text, text, text, text, text, boolean) to authenticated;

-- Admin write access to any org / its events / team / activity.
drop policy if exists "orgs_owner_write" on public.organizations;
create policy "orgs_owner_write" on public.organizations for update
  using (auth.uid() = owner_id or public.org_perm(id, 'edit_profile') or public.is_admin())
  with check (auth.uid() = owner_id or public.org_perm(id, 'edit_profile') or public.is_admin());

drop policy if exists "events_owner_write" on public.events;
create policy "events_owner_write" on public.events for all
  using (public.org_perm(events.org_id, 'manage_events') or public.is_admin())
  with check (public.org_perm(events.org_id, 'manage_events') or public.is_admin());

drop policy if exists "org_members_write" on public.org_members;
create policy "org_members_write" on public.org_members for all
  using (public.org_perm(org_id, 'manage_team') or public.is_admin()
         or exists (select 1 from public.organizations o where o.id = org_id and o.owner_id = auth.uid()))
  with check (public.org_perm(org_id, 'manage_team') or public.is_admin()
              or exists (select 1 from public.organizations o where o.id = org_id and o.owner_id = auth.uid()));

drop policy if exists "org_activity_read" on public.org_activity;
create policy "org_activity_read" on public.org_activity for select using (
  public.is_admin()
  or exists (select 1 from public.organizations o where o.id = org_id and o.owner_id = auth.uid())
  or public.is_org_member(org_id)
);

-- Also notify the admin when someone CLAIMS/JOINS an org (handoff invites don't
-- create a new pending org, so they wouldn't otherwise show). Recreated feed =
-- the original unions + recent owner/admin org-member joins.
create or replace function public.admin_activity_feed()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare seen timestamptz; items jsonb;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  select activity_seen_at into seen from public.admins where user_id = auth.uid();
  with recent as (
    select 'user'::text as kind, up.user_id::text as id,
           coalesce(up.name, up.email, 'New student') as title,
           coalesce(up.email, '') as subtitle, up.created_at
      from public.user_profile up where up.user_id <> auth.uid()
    union all
    select 'feature', fr.id::text, fr.title, fr.author_name || ' · feature request', fr.created_at
      from public.feature_requests fr where fr.hidden = false
    union all
    select 'bug', br.id::text, br.title, coalesce(br.user_email, 'someone') || ' · bug report', br.created_at
      from public.bug_reports br
    union all
    select 'request', ar.case_id, ar.name || ' — ' || ar.role || ' access', ar.email, ar.created_at
      from public.access_requests ar where ar.status = 'pending'
    union all
    select 'org', o.id::text, o.name || ' — new organization', '@' || o.handle, o.created_at
      from public.organizations o where o.status = 'pending'
    union all
    select 'teacher', tc.id::text, tc.name || ' — teacher access', tc.email, tc.created_at
      from public.teacher_accounts tc where tc.status = 'pending'
    union all
    select 'org', 'mem-' || m.id::text,
           coalesce(m.name, m.email, 'Someone') || ' joined ' || o.name,
           coalesce(m.email, '') || ' · ' || m.role, m.joined_at
      from public.org_members m join public.organizations o on o.id = m.org_id
      where m.status = 'active' and m.role in ('owner', 'admin')
        and m.joined_at is not null and m.joined_at > now() - interval '30 days'
  )
  select jsonb_agg(to_jsonb(r) order by r.created_at desc)
    into items
    from (select * from recent order by created_at desc limit 50) r;
  return jsonb_build_object('seen_at', seen, 'items', coalesce(items, '[]'::jsonb));
end $$;
