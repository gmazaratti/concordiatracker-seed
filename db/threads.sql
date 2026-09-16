-- ============================================================================
-- What each conversation looks like from the outside.
-- RUN IN: Supabase SQL Editor. Safe to re-run.
--
-- The message list showed a name and a handle, which is the same thing a
-- contacts list shows and tells you nothing about whether anyone is waiting on
-- you. To show a preview, a time and an unread count it needs, per person: the
-- LAST message either way, and how many of theirs you have not read.
--
-- ONE ROUND TRIP, not one per thread. The obvious client-side version -- fetch
-- every message and group in JavaScript -- works for twenty messages and falls
-- over at two thousand, and it would ship every message body you have ever
-- exchanged to the browser just to render one line of each.
-- ============================================================================

create or replace function public.my_threads()
returns table (
  other           uuid,
  last_body       text,
  last_attachment jsonb,
  last_sender     uuid,
  last_at         timestamptz,
  unread          integer
)
language sql
security definer
set search_path = public
stable
as $$
  with mine as (
    -- Every message I am party to, with the OTHER person resolved once so
    -- both directions group together.
    select m.*,
           case when m.sender = auth.uid() then m.recipient else m.sender end as counterpart
      from public.messages m
     where auth.uid() in (m.sender, m.recipient)
  ),
  newest as (
    -- distinct on + order by is Postgres's "latest row per group", and it
    -- reads the index rather than sorting the whole table per person.
    select distinct on (counterpart)
           counterpart, body, attachment, sender, created_at
      from mine
     order by counterpart, created_at desc
  ),
  unread_counts as (
    -- Only THEIR messages can be unread by me. Counting my own would show a
    -- badge on a conversation where I am the one who spoke last.
    select counterpart, count(*)::integer as n
      from mine
     where recipient = auth.uid() and read_at is null
     group by counterpart
  )
  select n.counterpart,
         n.body,
         n.attachment,
         n.sender,
         n.created_at,
         coalesce(u.n, 0)
    from newest n
    left join unread_counts u on u.counterpart = n.counterpart;
$$;

grant execute on function public.my_threads() to authenticated;

-- Marking a conversation read when you open it. One statement rather than the
-- client PATCHing each message: opening a thread with forty unread should not
-- be forty requests, and `read_at` is not the client's to set per row.
create or replace function public.mark_thread_read(p_other uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update public.messages
     set read_at = now()
   where recipient = auth.uid()
     and sender = p_other
     and read_at is null;
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.mark_thread_read(uuid) to authenticated;

-- The list sorts by recency and the unread count is read on every load, so
-- both directions of this pair want an index.
create index if not exists messages_sender_created_idx
  on public.messages (sender, created_at desc);
create index if not exists messages_recipient_unread_idx
  on public.messages (recipient, sender) where read_at is null;

-- Check:
--   select * from public.my_threads();
