-- The approval gate was a UI convention, not a rule. This makes it a rule.
--
-- MEASURED, NOT ASSUMED. A disposable account with nothing but a signed-in
-- session was able to, through the ordinary anon API:
--   1. insert an organization with status = 'approved' AND verified = true
--   2. update its own organization to approved + verified afterwards
-- Neither is offered by the UI. The UI is not the security boundary.
--
-- WHAT WAS ALREADY RIGHT, so it is not touched: the READ gate works. A
-- pending org is invisible to students and so are its events — verified with
-- a second, signed-out client against a genuinely pending row. The hole was
-- entirely on the write side: nothing stopped an org promoting itself out of
-- pending, which made the gate decorative.
--
-- WHY THIS MATTERS MORE THAN IT SOUNDS. `verified` is the blue seal, and the
-- product tells students it means an authenticated real organization — the
-- same badge the university's own accounts carry. Self-granting it is not a
-- cosmetic bug; it is anybody being able to impersonate a credible source in
-- a feed aimed at students.
--
-- A TRIGGER, NOT A POLICY. RLS can say who may write a row; it cannot
-- readily say "this column may not change". A BEFORE trigger can, and it
-- does it by PRESERVING the old value rather than raising — the client sends
-- whole rows, so an error here would break ordinary profile edits that
-- happen to include the field.
--
-- RUN in the Supabase SQL editor. Safe to re-run.

create or replace function public.ct_guard_org_status()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- The server (service_role, cron, our own API) has no auth.uid() and is
  -- already trusted; admins are trusted by definition. Everyone else has
  -- these three columns decided for them.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status   := 'pending';
    new.verified := false;
    new.owner_id := auth.uid();
  else
    -- Preserve, do not reject: an organizer saving their bio sends the whole
    -- row back, and refusing it would break the profile editor.
    new.status   := old.status;
    new.verified := old.verified;
    new.owner_id := old.owner_id;
  end if;

  return new;
end; $$;

drop trigger if exists ct_guard_org_status on public.organizations;
create trigger ct_guard_org_status
  before insert or update on public.organizations
  for each row execute function public.ct_guard_org_status();

-- ── The same hole, one table over ────────────────────────────────────────────
-- `events.org_id` is writable by the org's owner, so nothing stopped an
-- organizer re-pointing one of their events at somebody ELSE's org — which
-- would publish under that org's name and badge. The event write policy
-- checks the org you are writing TO, so this is only reachable on UPDATE.
create or replace function public.ct_guard_event_org()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.org_id is distinct from old.org_id then
    new.org_id := old.org_id;
  end if;
  return new;
end; $$;

drop trigger if exists ct_guard_event_org on public.events;
create trigger ct_guard_event_org
  before update on public.events
  for each row execute function public.ct_guard_event_org();

-- ── What got through before the gate existed ────────────────────────────────
-- REPORTS, DOES NOT RESET. The first version of this block un-approved every
-- owned+approved org that had no approval in `admin_audit_log` — and then
-- measuring showed that log records plan grants, messages and AI replies but
-- NOT approvals. So the test would have matched everything and the migration
-- would have un-approved @concordiatracker, the product's own account, on the
-- way past. There are two owned orgs in total; a human can read two rows.
do $$
declare r record; n int := 0;
begin
  for r in
    select o.handle, o.name, o.verified, o.created_at
      from public.organizations o
     where o.owner_id is not null and o.status = 'approved'
     order by o.created_at
  loop
    n := n + 1;
    raise notice 'Approved & owned: % (%) verified=% created %', r.handle, r.name, r.verified, r.created_at::date;
  end loop;
  if n = 0 then
    raise notice 'No owned org is approved — nothing to review.';
  else
    raise notice 'Review the % row(s) above. Any you did not approve yourself, set back to pending in Admin -> Portals.', n;
  end if;
end $$;

-- FOLLOW-UP worth doing separately: `admin_set_org_status` writes no audit
-- row, which is why the check above had nothing to consult. Logging approvals
-- would make this answerable by query instead of by eye.
