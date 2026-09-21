-- Remove `profile_follows`, a duplicate of `user_follows` that nothing writes.
--
-- Two migrations each created a follow table. The app has always written to
-- `user_follows`; `profile_follows` never received a row. It was not harmless:
-- `search_public_profiles` counted the EMPTY one, so every follower count in
-- Community search read 0 for everybody, for as long as search has existed.
-- (Repointed in db/blocks.sql; db/searchable_profiles.sql is corrected in the
-- same commit as this file so re-running the older file cannot regress it.)
--
-- THE DROP CHECKS BEFORE IT DESTROYS. Measured 0 rows on production before
-- writing this, but a migration that deletes a table on the strength of a
-- reading taken days earlier is exactly how data goes missing. If anything
-- has written to it since, this refuses and says so, and the table stays.

do $$
declare
  n bigint;
begin
  if to_regclass('public.profile_follows') is null then
    raise notice 'profile_follows is already gone — nothing to do.';
    return;
  end if;

  execute 'select count(*) from public.profile_follows' into n;

  if n > 0 then
    raise warning
      'profile_follows holds % row(s) — NOT dropping. Something started writing to it; reconcile against user_follows first.', n;
    return;
  end if;

  drop table public.profile_follows cascade;
  raise notice 'profile_follows dropped (0 rows).';
end $$;
