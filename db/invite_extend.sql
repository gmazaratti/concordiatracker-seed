-- ── Extend / revive an organizer invite ──────────────────────────────────────
-- Real clubs move on their own timeline: ASFA came back well after the 7-day
-- window, and re-minting a link means the one already sent by email is dead.
-- This pushes the expiry out instead, so the ORIGINAL link keeps working.
--
-- Also resets an invite that was fully consumed back to unused when asked, for
-- the case where someone accepted on the wrong account.
--
-- RUN AFTER db/invites_and_activity.sql. Safe to re-run.

create or replace function public.admin_extend_org_invite(
  p_id       uuid,
  p_days     int default 14,
  p_reset_uses boolean default false
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare inv record;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;

  -- Always extend from NOW, never from an already-passed expiry — otherwise
  -- "+14 days" on a link that lapsed three weeks ago is still expired.
  update public.org_invites
     set expires_at = greatest(expires_at, now()) + make_interval(days => greatest(1, p_days)),
         use_count  = case when p_reset_uses then 0 else use_count end
   where id = p_id
   returning * into inv;

  if inv is null then raise exception 'invite not found'; end if;

  return jsonb_build_object(
    'id', inv.id,
    'token', inv.token,
    'expires_at', inv.expires_at,
    'use_count', inv.use_count,
    'max_uses', inv.max_uses
  );
end $$;
grant execute on function public.admin_extend_org_invite(uuid, int, boolean) to authenticated;
