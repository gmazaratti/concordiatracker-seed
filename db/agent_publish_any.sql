-- ============================================================================
-- A platform-admin token can publish to any organisation.
-- RUN IN: Supabase SQL Editor. Safe to re-run. Non-destructive.
--
-- WHAT THIS REVERSES, AND WHAT IT DOES NOT.
--
-- `db/alfred_admin_scope.sql` narrowed five write gates so an agent token lost
-- the admin's write-anywhere bypass. The reason was real and is recorded
-- there: an unattended token that can publish as any club is one bug away from
-- posting as somebody else's club. The consequence, also real, is that
-- admin-side content work is refused — @jmcconline and @reggiesmtl have no
-- team, so there is no membership to have, and there is deliberately no verb
-- for an agent to join an existing org.
--
-- That leaves the platform owner unable to do the one thing they are the
-- platform owner OF. So the bypass comes back, for CONTENT only, and only for
-- an account explicitly marked here:
--
--   PUBLISHING IS RESTORED — posts, events, stories, post edits and deletes,
--   the org profile and its images. These are things the admin already does
--   by hand in the console; an API doing them changes who is typing, not what
--   is possible.
--
--   MEMBERSHIP AND INVITES ARE NOT. `org_members` and `org_invites` keep the
--   narrowing. The distinction is not squeamishness: an org_invite with a null
--   org_id MINTS AN ORGANISATION AND AN ACCOUNT, and a membership row is a
--   standing grant that outlives the request that created it. Content can be
--   deleted; an account that was handed out cannot be un-handed-out. Publishing
--   everywhere makes self-joining pointless anyway, which is exactly why there
--   is no reason to also open it.
--
-- EVERY WRITE THROUGH THE OVERRIDE IS AUDITED. `ct_agent_audit` already runs on
-- each of these endpoints; the API now stamps `"override": true` on the ones
-- that reached the org without membership, so the log distinguishes "the team
-- posted" from "the platform posted on their behalf" — which is the question
-- somebody will eventually ask about a post on a club's page.
-- ============================================================================

-- ── The flag ────────────────────────────────────────────────────────────────
-- On the ACCOUNT, not on the token. A custom JWT claim would be the tighter
-- control, but the API only signs its own token when SUPABASE_JWT_SECRET is
-- set; on the fallback path it redeems a real Supabase session, which cannot
-- carry a custom claim. A claim-based override would therefore be silently
-- absent exactly where it is needed. Same reasoning that put `agent_accounts`
-- beside the `ct_agent` claim in the first place.
alter table public.agent_accounts
  add column if not exists publish_any boolean not null default false;

comment on column public.agent_accounts.publish_any is
  'Platform-admin override: this agent account may publish to any approved organisation. Content only — never team or invites.';

create or replace function public.ct_agent_publish_any()
returns boolean language sql stable security definer set search_path = public as $$
  -- BOTH conditions. The flag alone is not a grant: an account that loses
  -- admin loses this with it, and there is no path where a non-admin row in
  -- this table means anything.
  select public.is_admin()
     and exists (
       select 1 from public.agent_accounts a
        where a.user_id = auth.uid() and a.publish_any
     );
$$;
grant execute on function public.ct_agent_publish_any() to authenticated, anon;

-- ── The content gates, reopened ─────────────────────────────────────────────
-- Each keeps every branch it had. `ct_admin_write()` still excludes agents;
-- the new disjunct is what lets a marked one through, so revoking the flag
-- restores the narrow behaviour with no other edit.

-- Posts and stories both run through this.
create or replace function public.ct_can_act_as_org(p_org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organizations o
     where o.id = p_org
       and coalesce(o.status, 'pending') = 'approved'
       and (
         o.owner_id = auth.uid()
         or exists (
           select 1 from public.org_members m
            where m.org_id = o.id
              and m.user_id = auth.uid()
              and coalesce(m.status, 'active') = 'active'
         )
       )
  ) or public.ct_admin_write() or public.ct_agent_publish_any();
$$;

drop policy if exists "orgs_owner_write" on public.organizations;
create policy "orgs_owner_write" on public.organizations for update
  using (auth.uid() = owner_id or public.org_perm(id, 'edit_profile')
         or public.ct_admin_write() or public.ct_agent_publish_any())
  with check (auth.uid() = owner_id or public.org_perm(id, 'edit_profile')
              or public.ct_admin_write() or public.ct_agent_publish_any());

drop policy if exists "events_owner_write" on public.events;
create policy "events_owner_write" on public.events for all
  using (public.org_perm(events.org_id, 'manage_events')
         or public.ct_admin_write() or public.ct_agent_publish_any())
  with check (public.org_perm(events.org_id, 'manage_events')
              or public.ct_admin_write() or public.ct_agent_publish_any());

-- org_members and org_invites are POINTEDLY absent. See the header.

-- ── Mark the assistant account ──────────────────────────────────────────────
-- By email, so this file does not carry a uuid that only means something on
-- one project. A missing account is a notice, not a failure: the rest of the
-- file is the schema and should apply regardless.
do $$
declare v_uid uuid;
begin
  select id into v_uid from auth.users where lower(email) = 'alfred@concordiatracker.com';
  if v_uid is null then
    raise notice 'No alfred@concordiatracker.com account — nothing marked. Set publish_any by hand once it exists.';
    return;
  end if;
  insert into public.agent_accounts (user_id, label, publish_any)
  values (v_uid, 'Alfred (platform admin)', true)
  on conflict (user_id) do update set publish_any = true;
  raise notice 'publish_any granted to alfred@concordiatracker.com.';
end $$;

-- ── Checks ──────────────────────────────────────────────────────────────────
--   select user_id, label, publish_any from public.agent_accounts;
--   -- As the agent account, against an org it is not on:
--   select public.ct_can_act_as_org('<org uuid>');   -- true
--   -- Membership is still refused, which is the point:
--   insert into public.org_members (org_id, user_id, role) values (…);  -- 42501
