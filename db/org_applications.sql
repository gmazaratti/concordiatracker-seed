-- Applying to be listed: the short form a club fills in when nobody invited them.
--
-- THE PROBLEM IT SOLVES. Signing up asked for a name and a handle, so an
-- approval queue row said "Robotics Club, @robotics" and nothing else — there
-- was no way to tell a real club from someone who typed a plausible name, and
-- no way to reach them to ask. Approving is a judgement call, so the queue has
-- to carry enough to make it.
--
-- WHY A JSONB COLUMN AND NOT A TABLE. The application is 1:1 with the
-- organization and is created in the same breath as it — there is no
-- application without an org row and never a second one. A table would buy a
-- join and an orphan state. Adding a question later is a client change.
--
-- WRITTEN THROUGH A FUNCTION, like status and verified. `organizations` has a
-- BEFORE trigger that forces those three columns for non-admins
-- (db/org_approval_gate.sql); the application is the same shape of field —
-- the applicant supplies it once, at creation, and must not be able to edit
-- it afterwards to say something different from what was approved.
--
-- RUN in the Supabase SQL editor. Safe to re-run.

alter table public.organizations
  add column if not exists application jsonb,
  add column if not exists applied_at  timestamptz;

comment on column public.organizations.application is
  'The signup questionnaire, as answered. Set once at creation; immutable to the applicant thereafter.';

-- The application joins the immutable set. Same reasoning as status/verified:
-- what the admin read when they approved must be what is on the row.
--
-- THE TRAP THIS HIT, and why the flag exists. A SECURITY DEFINER function
-- still sees the CALLER's auth.uid(), so `apply_for_org` looked exactly like
-- an ordinary user to this trigger and had its application wiped on the way
-- in — the org was created and the answers vanished. Caught by reading the
-- row back after a real run rather than trusting the insert. The fix is a
-- transaction-local flag only that function sets: `set_config(..., true)` is
-- scoped to the transaction, so it cannot leak to the next statement and a
-- client cannot set it for itself through PostgREST.
create or replace function public.ct_guard_org_status()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status      := 'pending';
    new.verified    := false;
    new.owner_id    := auth.uid();
    -- Filed through apply_for_org, not by hand, so the shape is ours.
    if coalesce(current_setting('ct.org_apply', true), '') <> '1' then
      new.application := null;
      new.applied_at  := null;
    end if;
  else
    new.status      := old.status;
    new.verified    := old.verified;
    new.owner_id    := old.owner_id;
    new.application := old.application;
    new.applied_at  := old.applied_at;
  end if;

  return new;
end; $$;

-- ── Apply ────────────────────────────────────────────────────────────────────
-- Creates the pending org AND records the answers, in one statement, so a
-- half-finished application cannot exist. Returns the new org's id.
create or replace function public.apply_for_org(
  p_name    text,
  p_handle  text,
  p_answers jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_handle text;
  v_id     uuid;
begin
  if v_uid is null then raise exception 'sign in first'; end if;
  -- Tells the guard trigger this insert is the sanctioned path. Transaction-
  -- local, so it is gone by the next statement.
  perform set_config('ct.org_apply', '1', true);
  if coalesce(trim(p_name), '') = '' then raise exception 'name required'; end if;

  v_handle := lower(regexp_replace(coalesce(p_handle, ''), '[^a-zA-Z0-9_.]', '', 'g'));
  if length(v_handle) < 2 then raise exception 'handle required'; end if;
  v_handle := '@' || v_handle;

  -- One pending application per person. Someone who mistypes should fix the
  -- row they have, not leave a queue of half-duplicates for a human to sort.
  if exists (
    select 1 from public.organizations o
     where o.owner_id = v_uid and o.status = 'pending'
  ) then
    raise exception 'you already have an application waiting' using errcode = 'unique_violation';
  end if;

  insert into public.organizations
    (owner_id, handle, name, verified, glyph, color, bio, status, application, applied_at)
  values
    (v_uid, v_handle, trim(p_name), false,
     upper(left(regexp_replace(trim(p_name), '[^a-zA-Z]', '', 'g'), 2)),
     '#5b9cf6',
     coalesce(p_answers ->> 'what', ''),
     'pending',
     -- Trimmed to the questions we ask, so a crafted payload cannot stuff the
     -- admin console with arbitrary keys.
     jsonb_strip_nulls(jsonb_build_object(
       'what',     nullif(trim(coalesce(p_answers ->> 'what', '')), ''),
       'category', nullif(trim(coalesce(p_answers ->> 'category', '')), ''),
       'size',     nullif(trim(coalesce(p_answers ->> 'size', '')), ''),
       'role',     nullif(trim(coalesce(p_answers ->> 'role', '')), ''),
       'contact',  nullif(trim(coalesce(p_answers ->> 'contact', '')), ''),
       'proof',    nullif(trim(coalesce(p_answers ->> 'proof', '')), '')
     )),
     now())
  returning id into v_id;

  return v_id;
end; $$;

revoke all on function public.apply_for_org(text, text, jsonb) from public, anon;
grant execute on function public.apply_for_org(text, text, jsonb) to authenticated;

-- ── The queue ────────────────────────────────────────────────────────────────
-- What an admin needs to decide, including the owner's email — which lives on
-- user_profile and is select-own, hence the definer.
create or replace function public.admin_org_applications()
returns table (
  id           uuid,
  handle       text,
  name         text,
  status       text,
  applied_at   timestamptz,
  owner_email  text,
  owner_name   text,
  application  jsonb
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return query
  select o.id, o.handle, o.name, o.status, o.applied_at,
         p.email, p.name, o.application
    from public.organizations o
    left join public.user_profile p on p.user_id = o.owner_id
   where o.application is not null
   order by o.applied_at desc nulls last;
end; $$;

revoke all on function public.admin_org_applications() from public, anon;
grant execute on function public.admin_org_applications() to authenticated;
