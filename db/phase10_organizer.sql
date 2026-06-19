-- ============================================================================
-- Phase 10 — Organizer portal write access. Lets the logged-in user OWN an org
-- and create/edit/delete its events, which then flow into the Community feed
-- (the `events` table the feed already reads, from Phase 8).
-- RUN THIS IN YOUR concordiatracker-dev PROJECT ONLY (SQL Editor → paste → Run).
--
-- Phase 8 created organizations/events with PUBLIC READ only (writes were seeded
-- server-side). This adds the owner write policies:
--   • organizations — the owner can create + delete their own org (update already
--     existed from Phase 8).
--   • events — writable by whoever OWNS the event's org.
-- Follows/reminders stay private (own-row only, unchanged). Metrics are still
-- aggregate-only / connection-phase. Team membership (org_members) is later.
-- ============================================================================

-- organizations: owner can create + remove their own org.
drop policy if exists "orgs_owner_insert" on public.organizations;
drop policy if exists "orgs_owner_delete" on public.organizations;
create policy "orgs_owner_insert" on public.organizations for insert with check (auth.uid() = owner_id);
create policy "orgs_owner_delete" on public.organizations for delete using (auth.uid() = owner_id);

-- events: full write for the owner of the event's org (insert/update/delete).
drop policy if exists "events_owner_write" on public.events;
create policy "events_owner_write" on public.events for all
  using (
    exists (select 1 from public.organizations o where o.id = events.org_id and o.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.organizations o where o.id = events.org_id and o.owner_id = auth.uid())
  );
