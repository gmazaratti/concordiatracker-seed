-- ============================================================================
-- "No date needed": a third answer for an assessment's date.
--
-- Until now an assessment either had a date or it did not, and "did not" meant
-- "not known yet" — so attendance and participation, which are graded without
-- ever being due on a day, sat under "No date yet" on Today with a caution
-- forever. `no_date = true` says no date will ever come: Today leaves it out of
-- "No date yet" and nothing styles it as a warning.
--
-- A date and "no date needed" cannot both be true. The trigger keeps it that
-- way on EVERY write path — the app, the personal API (which can set due_at
-- and knows nothing about this column), a script — by clearing the flag the
-- moment a date is set, rather than refusing the write.
-- Additive and re-runnable.
-- ============================================================================

alter table public.assignments add column if not exists no_date boolean not null default false;

create or replace function public.ct_no_date_clears()
returns trigger
language plpgsql
as $$
begin
  if new.date is not null then
    new.no_date := false;
  end if;
  return new;
end $$;

drop trigger if exists assignments_no_date_clears on public.assignments;
create trigger assignments_no_date_clears
  before insert or update of date, no_date on public.assignments
  for each row execute function public.ct_no_date_clears();
