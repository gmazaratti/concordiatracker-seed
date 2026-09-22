-- ── Turn realtime on for the two tables that claim to use it ────────────────
--
-- `Chat.tsx` has subscribed to `postgres_changes` on `messages` since the day
-- chat shipped. It has never received one. `supabase_realtime` exists with
-- `puballtables = false` and NO TABLES IN IT, so the publication the WAL
-- listener reads has nothing to say and the subscription sits there quietly
-- succeeding at nothing.
--
-- Which is why a message only appeared after switching tabs: the tab switch
-- refetched, and the refetch was doing all the work.
--
-- RLS STILL APPLIES. Realtime evaluates the subscriber's own policies against
-- each change, so adding a table here does not broadcast it: `messages` is
-- select-own, so you receive the rows you could already have queried, and
-- nobody else's.
--
-- NOTIFICATIONS TOO, so the bell and its dot move on their own rather than on
-- the next navigation.
--
-- RUN in the Supabase SQL editor. Safe to re-run.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
    raise notice 'messages added to supabase_realtime';
  end if;

  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
    raise notice 'notifications added to supabase_realtime';
  end if;
end $$;

-- Realtime sends the OLD row for updates and deletes only when the table has
-- a replica identity that can describe it. Default (primary key) is enough
-- for what we listen to — inserts — and is what these tables already have.
