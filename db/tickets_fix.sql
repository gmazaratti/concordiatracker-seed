-- ── Fix: ticket_thread() failed with "column reference id is ambiguous" ──────
-- RUN IN: Supabase → SQL Editor. Safe to re-run.
--
-- `RETURNS TABLE (id uuid, ...)` declares an OUT variable named `id` that is in
-- scope for the whole function body. The lookup and the mark-as-read both said
-- `where id = p_ticket_id`, which Postgres can't resolve — it could mean the
-- table column or that OUT variable (SQLSTATE 42702). The function therefore
-- errored on every call, which is why opening any conversation in the app said
-- "Couldn't load this conversation".
--
-- The fix is to alias the table and qualify every reference. Worth noting for
-- future RPCs in this file: any function using RETURNS TABLE has to qualify
-- column references whose names collide with its output columns.

create or replace function public.ticket_thread(p_ticket_id uuid)
returns table (id uuid, author_role text, author_name text, body text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  select t.user_id into v_owner from public.tickets t where t.id = p_ticket_id;
  if not found then raise exception 'That ticket does not exist.'; end if;
  if not public.is_admin() and v_owner is distinct from auth.uid() then
    raise exception 'That is not your ticket.';
  end if;

  -- Opening your own thread clears the unread badge.
  if v_owner = auth.uid() then
    update public.tickets t set user_seen_at = now() where t.id = p_ticket_id;
  end if;

  return query
    select m.id, m.author_role, m.author_name, m.body, m.created_at
    from public.ticket_messages m
    where m.ticket_id = p_ticket_id
    order by m.created_at;
end $$;

grant execute on function public.ticket_thread(uuid) to authenticated;
