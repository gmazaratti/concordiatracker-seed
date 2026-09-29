-- ============================================================================
-- admin_ticket_people — who is behind each support ticket, for the admin inbox.
--
-- The queue showed a name (or an email) and nothing else, so answering meant
-- opening the Users tab in another window to find out whether this was a paying
-- student, a first-day account or somebody who had written five times before.
-- This returns, per ticket author: face, handle, programme, plan, when they
-- joined, and how many tickets they have filed.
--
-- A SEPARATE FUNCTION rather than new columns on `admin_tickets`: that one's
-- return type is shared by the docs lookup and the support API, and a
-- `returns table` cannot be widened by `create or replace` (it would have to be
-- dropped and every caller re-deployed together).
--
-- Admin-only, checked inside. Anonymous (docs) tickets have no user and are
-- simply absent from the answer.
-- ============================================================================

create or replace function public.admin_ticket_people(p_users uuid[])
returns table (
  user_id uuid,
  name text,
  handle text,
  avatar_url text,
  program text,
  is_pro boolean,
  plan_status text,
  joined_at timestamptz,
  ticket_count int
)
language plpgsql security definer set search_path = public stable as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;
  return query
    select p.user_id,
           p.name,
           p.handle,
           p.avatar_url,
           p.program,
           (p.plan_status = 'pro' or coalesce(p.comped, false) or coalesce(p.team_pro, false)
             or (p.pro_until is not null and p.pro_until > now())) as is_pro,
           p.plan_status,
           p.created_at as joined_at,
           (select count(*)::int from public.tickets t where t.user_id = p.user_id) as ticket_count
      from public.user_profile p
     where p.user_id = any(p_users);
end $$;

revoke all on function public.admin_ticket_people(uuid[]) from public, anon;
grant execute on function public.admin_ticket_people(uuid[]) to authenticated;
