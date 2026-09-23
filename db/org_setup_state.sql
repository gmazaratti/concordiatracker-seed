-- ============================================================================
-- The setup wizard opens because setup has not been done — not because the
-- club is awaiting approval.
-- RUN IN: Supabase SQL Editor. Safe to re-run.
--
-- ── THE BUG THIS FIXES ──────────────────────────────────────────────────────
-- `OrgOnboardingGate` decided with `org.status !== 'pending'`. Approval status
-- and setup progress are two different facts, and they come apart immediately:
--
--   • an invite carrying an `org_id` is a HANDOFF of an EXISTING organisation,
--     which is already `approved` — so the wizard could never open on that
--     path, which is exactly what was reported;
--   • and the moment an admin approves a club, its half-finished setup
--     silently disappears mid-flow.
--
-- ── WHY A COLUMN AND NOT A BETTER GUESS ─────────────────────────────────────
-- The alternative was to infer it — "no bio and no logo means unfinished" —
-- but somebody who deliberately skipped setup would then be asked again on
-- every single load, and the in-memory Set that was suppressing that resets on
-- reload. Finishing or skipping is a decision the person made, so it is worth
-- one column and it is worth surviving a reload.
--
-- ── THE BACKFILL DOES NOT AMBUSH ESTABLISHED CLUBS ──────────────────────────
-- Any organisation that already looks set up — a bio, a logo, a banner or a
-- single event — is marked done, so the 35 clubs already live never see a
-- wizard about a club they have been running for months. Everything bare is
-- left null, which is the honest answer: nobody has set it up.
-- ============================================================================

alter table public.organizations
  add column if not exists setup_completed_at timestamptz;

comment on column public.organizations.setup_completed_at is
  'When the organizer setup wizard was finished or skipped. NULL = show it. '
  'Deliberately NOT derived from `status`: approval and setup are different facts.';

update public.organizations o
   set setup_completed_at = coalesce(o.created_at, now())
 where o.setup_completed_at is null
   and (
     coalesce(nullif(trim(o.bio), ''), null) is not null
     or o.logo is not null
     or o.banner is not null
     or exists (select 1 from public.events e where e.org_id = o.id)
   );

/* Marking it done is a definer function for one reason: `organizations` has an
   UPDATE policy an ordinary member can satisfy through `profile_edit`, and
   this is not a profile field — it is a fact about a person's progress through
   a flow. Anybody who can act for the club may finish its setup; nobody needs
   `profile_edit` to do so, and a member without it should still be able to
   dismiss a wizard that is in their way. */
create or replace function public.mark_org_setup_done(p_org uuid)
returns void language plpgsql security definer
set search_path to 'public' as $$
begin
  if not public.ct_is_org_member(p_org) then
    raise exception 'That is not your organization.';
  end if;
  update public.organizations
     set setup_completed_at = now()
   where id = p_org and setup_completed_at is null;
end $$;

grant execute on function public.mark_org_setup_done(uuid) to authenticated;

/* Re-opening it. Used by "Replay setup" in the portal, which previously only
   flipped an in-memory flag and so could not survive the reload it caused. */
create or replace function public.reset_org_setup(p_org uuid)
returns void language plpgsql security definer
set search_path to 'public' as $$
begin
  if not public.ct_is_org_member(p_org) then
    raise exception 'That is not your organization.';
  end if;
  update public.organizations set setup_completed_at = null where id = p_org;
end $$;

grant execute on function public.reset_org_setup(uuid) to authenticated;

-- ── Checks ──────────────────────────────────────────────────────────────────
--   -- clubs that will be offered the wizard (bare ones only):
--   select handle, status, setup_completed_at is null as will_show
--     from organizations order by will_show desc, handle;

-- ── A handoff re-opens setup ────────────────────────────────────────────────
--
-- An invite carrying an `org_id` replaces the club's whole team, so the person
-- accepting it has never been through setup even though the organisation has.
-- Leaving the flag set is what produced the reported bug in its second form:
-- a club pre-created with a bio and `status = 'approved'`, handed over, and no
-- wizard anywhere.
--
-- It is cleared unconditionally rather than "only if the club looks bare". A
-- pre-filled bio is not evidence that a real club filled it in, and the cost
-- of being wrong in that direction is one click on Skip — against a new
-- president who is given a dashboard and no idea what any of it does.
create or replace function public.ct_reopen_setup_on_handoff()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  -- Only when the owner actually changes hands.
  if new.owner_id is distinct from old.owner_id then
    new.setup_completed_at := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_reopen_setup_on_handoff on public.organizations;
create trigger trg_reopen_setup_on_handoff before update on public.organizations
  for each row execute function public.ct_reopen_setup_on_handoff();
