-- ── Poll only what needs polling ─────────────────────────────────────────────
-- RUN AFTER db/seat_watch.sql. Safe to re-run.
--
-- The first version polled every watched course on every tick. A class that
-- already has seats needs no watching — the student would simply register — so
-- the working set is really "courses where at least one watched section is
-- currently full, or has never been checked."
--
-- On a normal day that's most of the traffic gone, which matters because
-- Concordia meters API calls per application and has not published a limit.

create or replace function public.seat_watch_sections()
returns table (term_code text, subject text, catalog text)
language sql security definer set search_path = public stable as $$
  select distinct w.term_code, w.subject, w.catalog
  from public.seat_watches w
  where
    -- Never checked: we need one reading to establish a baseline.
    w.last_capacity is null
    -- Currently full: this is the transition we're waiting for.
    or w.last_enrollment >= w.last_capacity
    -- Recently opened: keep watching briefly in case it fills again before the
    -- student manages to register, which is the common case for a popular class.
    or w.notified_at > now() - interval '2 hours';
$$;
revoke all on function public.seat_watch_sections() from public, anon, authenticated;

-- Stop watching sections nobody is waiting on any more. A watch whose class has
-- been open for a day has done its job — the student either registered or moved
-- on, and polling it forever is pure waste.
create or replace function public.prune_seat_watches()
returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with gone as (
    delete from public.seat_watches
     where notified_at is not null
       and notified_at < now() - interval '24 hours'
       and last_enrollment < last_capacity
    returning 1
  )
  select count(*)::int into n from gone;
  return n;
end $$;
revoke all on function public.prune_seat_watches() from public, anon, authenticated;
