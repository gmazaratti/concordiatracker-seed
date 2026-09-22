-- ============================================================================
-- Deleting a notification.
-- RUN IN: Supabase SQL Editor. Safe to re-run. Non-destructive.
--
-- `db/notifications.sql` gave the table SELECT and nothing else, on purpose:
-- every write is a SECURITY DEFINER function so nobody can mint a
-- notification, forge who it came from, or edit the sentence they were sent.
-- That rule is why there is no `for delete` policy here either — clearing one
-- is a write, and it goes through a function like every other write does.
--
-- WHY DELETE AND NOT A `dismissed_at` COLUMN. A notification is already a
-- record of a moment; keeping a tombstone of somebody clearing their own
-- notification list preserves nothing anybody will ever read and makes every
-- later query carry a filter. The audit log is where things that need to
-- survive live, and a notification is not one of them.
-- ============================================================================

create or replace function public.delete_notifications(p_ids uuid[] default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  -- `user_id = auth.uid()` is the whole authorisation. Ids come from the
  -- caller and are never trusted: passing somebody else's id deletes nothing
  -- rather than deleting theirs.
  delete from public.notifications
   where user_id = auth.uid()
     and (p_ids is null or id = any (p_ids));
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.delete_notifications(uuid[]) from public;
grant execute on function public.delete_notifications(uuid[]) to authenticated;

-- ── Checks ──────────────────────────────────────────────────────────────────
--   select public.delete_notifications(array['<an id you do not own>'::uuid]);  -- 0
--   select public.delete_notifications();  -- clears your own, returns the count
