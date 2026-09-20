-- ============================================================================
-- Admin audit log — who did what to whom, and why.
-- RUN IN: Supabase SQL Editor. Safe to re-run.
--
-- WHY. Three Pro accounts could not be explained from the dashboard, and the
-- only place the answer existed was one person's memory. Every privileged
-- action until now has been an UPDATE with no record that it happened: a plan
-- flipped, a flag set, a subscription edited by hand, and afterwards the row
-- looks exactly like a row that was always that way.
--
-- THE REASON FIELD IS THE POINT. A log that says "plan_status: free -> pro"
-- answers WHAT and still leaves WHY to memory, which is the thing that failed.
-- So `reason` is required by the write function, not optional.
--
-- APPEND-ONLY, ENFORCED. No update or delete policy exists, and none should:
-- an audit log an admin can edit answers a different question from the one it
-- was built for. Even the service role writing through PostgREST cannot amend
-- a row, because the only door is the function below.
-- ============================================================================

create table if not exists public.admin_audit_log (
  id          bigserial primary key,
  -- WHO. Kept as an id AND a denormalised email: an account can be deleted,
  -- and "deleted user granted Pro" is a useless audit entry.
  actor_id    uuid,
  actor_email text,
  -- WHAT. Free-form but conventional: 'plan.grant', 'plan.revoke',
  -- 'flag.internal', 'flag.comped', 'subscription.edit', 'refund.issue'.
  action      text not null,
  -- TO WHOM. Same reasoning as the actor.
  target_id   uuid,
  target_email text,
  -- The change itself. jsonb rather than two text columns so an action that
  -- touches three fields is one row, not three.
  old_value   jsonb,
  new_value   jsonb,
  -- WHY. Required; see the header.
  reason      text not null,
  created_at  timestamptz not null default now()
);

create index if not exists admin_audit_target_idx on public.admin_audit_log (target_id, created_at desc);
create index if not exists admin_audit_created_idx on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;

-- Admins read it. Nobody writes it directly, including them.
drop policy if exists admin_audit_select on public.admin_audit_log;
create policy admin_audit_select on public.admin_audit_log
  for select using (public.is_admin());

-- ── The only door ────────────────────────────────────────────────────────────
-- Takes the actor from auth.uid() rather than from the caller. An audit log
-- that lets you name yourself is a log of who claimed to do things.
create or replace function public.log_admin_action(
  p_action text,
  p_target uuid,
  p_reason text,
  p_old jsonb default null,
  p_new jsonb default null
)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_id bigint;
  v_actor uuid := auth.uid();
begin
  if not public.is_admin() then raise exception 'Not authorized.'; end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Every logged action needs a reason.';
  end if;

  insert into public.admin_audit_log
    (actor_id, actor_email, action, target_id, target_email, old_value, new_value, reason)
  values (
    v_actor,
    (select u.email from public.user_profile u where u.user_id = v_actor),
    p_action,
    p_target,
    (select u.email from public.user_profile u where u.user_id = p_target),
    p_old, p_new, trim(p_reason)
  )
  returning id into v_id;
  return v_id;
end $$;
grant execute on function public.log_admin_action(text, uuid, text, jsonb, jsonb) to authenticated;

-- ── The actions that must be logged ──────────────────────────────────────────
-- Wrapped rather than left to the client, so the change and its record are one
-- statement. A client that does the UPDATE and then the log can do the first
-- and skip the second -- which is exactly how a history ends up with holes in
-- the places that matter most.

/** Grant or revoke Pro. `p_until` null = indefinite. */
create or replace function public.admin_set_plan(
  p_target uuid, p_pro boolean, p_reason text, p_until timestamptz default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare before jsonb;
begin
  if not public.is_admin() then raise exception 'Not authorized.'; end if;
  select to_jsonb(x) into before from (
    select p.plan_status, p.pro_until from public.user_profile p where p.user_id = p_target
  ) x;

  update public.user_profile
     set plan_status = case when p_pro then 'pro' else 'free' end,
         pro_until   = case when p_pro then p_until else null end,
         -- Granting Pro by hand IS comping. Recording it as such is what
         -- keeps the paying-customer count honest.
         comped      = case when p_pro then true else comped end
   where user_id = p_target;

  perform public.log_admin_action(
    case when p_pro then 'plan.grant' else 'plan.revoke' end,
    p_target, p_reason, before,
    jsonb_build_object('plan_status', case when p_pro then 'pro' else 'free' end,
                       'pro_until', p_until)
  );
end $$;
grant execute on function public.admin_set_plan(uuid, boolean, text, timestamptz) to authenticated;

/** Set the internal / comped flags. */
create or replace function public.admin_set_flags(
  p_target uuid, p_internal boolean, p_comped boolean, p_reason text
)
returns void
language plpgsql security definer set search_path = public as $$
declare before jsonb;
begin
  if not public.is_admin() then raise exception 'Not authorized.'; end if;
  select to_jsonb(x) into before from (
    select p.is_internal, p.comped from public.user_profile p where p.user_id = p_target
  ) x;

  update public.user_profile
     set is_internal = coalesce(p_internal, is_internal),
         comped      = coalesce(p_comped, comped)
   where user_id = p_target;

  perform public.log_admin_action(
    'flag.set', p_target, p_reason, before,
    jsonb_build_object('is_internal', p_internal, 'comped', p_comped)
  );
end $$;
grant execute on function public.admin_set_flags(uuid, boolean, boolean, text) to authenticated;

-- ── Reading it ───────────────────────────────────────────────────────────────
create or replace function public.admin_audit_for_user(p_target uuid, p_limit int default 50)
returns table (
  id bigint, actor_email text, action text, old_value jsonb, new_value jsonb,
  reason text, created_at timestamptz
)
language sql security definer set search_path = public stable as $$
  select l.id, l.actor_email, l.action, l.old_value, l.new_value, l.reason, l.created_at
    from public.admin_audit_log l
   where public.is_admin() and l.target_id = p_target
   order by l.created_at desc
   limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;
grant execute on function public.admin_audit_for_user(uuid, int) to authenticated;

create or replace function public.admin_audit_recent(p_limit int default 100)
returns table (
  id bigint, actor_email text, action text, target_email text,
  old_value jsonb, new_value jsonb, reason text, created_at timestamptz
)
language sql security definer set search_path = public stable as $$
  select l.id, l.actor_email, l.action, l.target_email,
         l.old_value, l.new_value, l.reason, l.created_at
    from public.admin_audit_log l
   where public.is_admin()
   order by l.created_at desc
   limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;
grant execute on function public.admin_audit_recent(int) to authenticated;

-- ── Backfill: the grants we already know about ───────────────────────────────
-- Recorded as what they are -- reconstructed after the fact, by me, from the
-- founder's own account of them. Marked so nobody later mistakes these four
-- for entries that were captured as they happened.
--
-- Written with a guard rather than `on conflict` because there is no natural
-- key here: re-running must not produce a second copy of the same history.
do $$
declare v_alex uuid;
begin
  select user_id into v_alex from public.user_profile where lower(email) = 'alexxdegryse@gmail.com';
  if v_alex is null then
    raise notice 'admin_audit: no founder account found; skipping the backfill.';
    return;
  end if;
  if exists (select 1 from public.admin_audit_log where action = 'plan.grant.backfill') then
    raise notice 'admin_audit: backfill already recorded; skipping.';
    return;
  end if;

  insert into public.admin_audit_log
    (actor_id, actor_email, action, target_id, target_email, old_value, new_value, reason)
  select
    v_alex, 'alexxdegryse@gmail.com', 'plan.grant.backfill',
    p.user_id, p.email,
    jsonb_build_object('plan_status', 'free'),
    jsonb_build_object('plan_status', 'pro', 'comped', true),
    'Comped by Alex. Reconstructed when the audit log was added; the grant itself predates it.'
  from public.user_profile p
  where lower(p.email) in (
    'amirkhord@gmail.com',          -- Ali
    'sofia.molina02@gmail.com',     -- Sofia
    'naveed-ghaffar0120@hotmail.com', -- Naveed
    'florencemarie123@gmail.com'    -- Flo
  );
end $$;

-- Flo was the account nobody could explain. She is comped.
update public.user_profile
   set comped = true
 where lower(email) = 'florencemarie123@gmail.com';

-- Check:
--   select action, target_email, reason, created_at from public.admin_audit_log
--    order by created_at desc;
--   select name, email, plan_status, comped, is_internal from public.user_profile
--    where comped or is_internal order by is_internal, email;
