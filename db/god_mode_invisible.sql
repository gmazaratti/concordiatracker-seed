-- ============================================================================
-- Platform accounts manage every club and appear on no team.
-- RUN IN: Supabase SQL Editor. Safe to re-run. Non-destructive to real teams.
--
-- THE ACCESS ALREADY EXISTS, and that is the point of this file. Both gates —
-- `ct_can_act_as_org` (publishing) and `ct_is_org_member` (reading an org's
-- inbox, seeing its queued posts) — already return true for an admin without
-- any membership row, and the provider already loads every organisation for
-- an admin with full permissions. So nothing here grants anything.
--
-- WHAT IT REMOVES IS VISIBILITY. Sixteen real `org_members` rows put the two
-- platform accounts on other clubs' teams as `admin`, which is what a club
-- president sees when they open Team: two strangers with management rights
-- they did not add. Access derived from `is_admin()` is invisible; a
-- membership row is not, and the row was never what the access depended on.
--
-- OWNED ORGS ARE LEFT ALONE. @concordiatracker genuinely belongs to these
-- accounts, and removing the owner from their own team would be a different
-- bug. The delete is scoped by "does not own this org".
--
-- NO TRIGGER STOPS THE ROWS COMING BACK, deliberately: one of these people
-- may one day actually run a club, and a guard that refuses that is worse
-- than a row somebody can delete. If they reappear in bulk, whatever created
-- them is the thing to fix.
-- ============================================================================

do $$
declare
  -- Named, not derived from `admins`: a future admin might legitimately be on
  -- a club's team, and quietly removing them would be a surprise.
  god_emails text[] := array['concordiatracker@gmail.com', 'alexxdegryse@gmail.com'];
  god_ids uuid[];
  removed int;
begin
  select coalesce(array_agg(id), '{}') into god_ids
    from auth.users where lower(email) = any (select lower(unnest(god_emails)));

  delete from public.org_members m
   where (
           m.user_id = any (god_ids)
           or (m.email is not null and lower(m.email) = any (select lower(unnest(god_emails))))
         )
     -- Not in an org one of them actually owns.
     and not exists (
       select 1 from public.organizations o
        where o.id = m.org_id and o.owner_id = any (god_ids)
     );
  get diagnostics removed = row_count;
  raise notice 'god-mode: removed % membership row(s); access is unchanged (is_admin covers it).', removed;
end $$;

-- ── Checks ──────────────────────────────────────────────────────────────────
--   select o.handle, m.email, m.role
--     from org_members m join organizations o on o.id = m.org_id
--    where m.email in ('concordiatracker@gmail.com','alexxdegryse@gmail.com');
--   -- expect: only rows for orgs those accounts own.
