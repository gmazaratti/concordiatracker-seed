-- ── The admin scope, and an agent token that cannot publish everywhere ──────
--
-- WHY THIS EXISTS. An assistant acting through /api/v1 needs to manage student
-- organisations and read everything the admin console shows. Every org rule and
-- every admin_* function in this database is written against auth.uid(), and
-- the v1 layer runs as the SERVICE ROLE, where auth.uid() is null. Rather than
-- re-implement ~55 authorisation checks in TypeScript (a second rule set that
-- will drift from the first), the API mints a short-lived HS256 token for a
-- real account and calls PostgREST as that account. Every existing policy then
-- applies unchanged.
--
-- THE ONE THING THAT MUST NOT COME FOR FREE. That account is an admin, and
-- FOUR write policies plus ct_can_act_as_org currently grant an admin write
-- access to EVERY organisation. For a human in the console that is correct and
-- deliberate. For an unattended agent it is not: the agreed rule is
-- membership-required for publishing, admin-wide for reading.
--
-- So the minted token carries a claim, `ct_agent: true`, and `ct_is_agent()`
-- reads it. Every admin WRITE bypass below becomes "admin AND not an agent".
-- The narrowing is therefore enforced by RLS, not by the handler: a bug in the
-- API cannot publish to an org the agent is not a member of. The claim is
-- inside a token we sign, so forging it needs the JWT secret, and anyone
-- holding that already holds the service-role key.
--
-- is_admin() ITSELF IS UNTOUCHED, so every admin_* READ keeps working.
--
-- ALSO FIXED HERE — A LIVE REGRESSION. `db/api_tokens.sql` hard-codes the scope
-- list as ('owner','me') and the prefix map as owner/pat. It was re-run on
-- 2026-09-20 for the demo-chart columns, which silently reverted the 'support'
-- scope added by support_api.sql and the ct_per_ prefix added by
-- personal_api.sql. Measured: the live create_api_token refuses 'support'
-- today, while a support token minted before the re-run still works. The list
-- now lives in ONE function that those files do not define, so re-running any
-- of them cannot narrow it again.
--
-- RUN in the Supabase SQL editor. Safe to re-run.

-- ── One list, one prefix map ────────────────────────────────────────────────

create or replace function public.ct_api_scopes()
returns text[] language sql immutable as $$
  select array['owner', 'me', 'support', 'admin']::text[];
$$;

/** Scopes only an admin may mint. 'me' is the only self-serve one. */
create or replace function public.ct_api_admin_scopes()
returns text[] language sql immutable as $$
  select array['owner', 'support', 'admin']::text[];
$$;

create or replace function public.ct_api_scope_prefix(p_scope text)
returns text language sql immutable as $$
  select case p_scope
           when 'owner'   then 'ct_owner_'
           when 'support' then 'ct_sup_'
           when 'admin'   then 'ct_adm_'
           else 'ct_per_'
         end;
$$;

create or replace function public.ct_new_api_token(p_scope text)
returns text language sql as $$
  select public.ct_api_scope_prefix(p_scope)
         || replace(gen_random_uuid()::text, '-', '')
         || replace(gen_random_uuid()::text, '-', '');
$$;

create or replace function public.create_api_token(p_name text, p_scope text default 'me')
returns table (id uuid, token text, prefix text)
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_token text;
  v_name  text := nullif(btrim(coalesce(p_name, '')), '');
  v_count int;
begin
  if v_uid is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;
  if not (p_scope = any (public.ct_api_scopes())) then
    raise exception 'Unknown scope %', p_scope using errcode = '22023';
  end if;
  if p_scope = any (public.ct_api_admin_scopes()) and not public.is_admin() then
    raise exception 'Only an admin can create a % token.', p_scope using errcode = '42501';
  end if;
  if v_name is null then
    raise exception 'Give the token a name so you can recognise it later.' using errcode = '22023';
  end if;

  select count(*) into v_count
    from public.api_tokens t
   where t.user_id = v_uid and t.revoked_at is null;
  if v_count >= 20 then
    raise exception 'You already have 20 active tokens. Revoke one first.' using errcode = '53400';
  end if;

  v_token := public.ct_new_api_token(p_scope);

  insert into public.api_tokens (user_id, scope, name, token_hash, prefix)
  values (v_uid, p_scope, left(v_name, 60), public.ct_hash_api_token(v_token), left(v_token, 15))
  returning api_tokens.id into id;

  token  := v_token;
  prefix := left(v_token, 15);
  return next;
end;
$$;
grant execute on function public.ct_api_scopes() to authenticated, anon;
grant execute on function public.ct_api_admin_scopes() to authenticated, anon;
grant execute on function public.ct_api_scope_prefix(text) to authenticated, anon;
grant execute on function public.create_api_token(text, text) to authenticated;

-- THE FOURTH COPY OF THE LIST, and the one that actually refused the write.
-- `api_tokens` carries a CHECK constraint naming the scopes, added by
-- support_api.sql and never touched since. create_api_token would have
-- accepted 'admin' and then the INSERT would have failed with 23514, so the
-- console would have shown a database error on a button that looked fine.
-- Pointing the constraint at the same function means widening the list later
-- is one edit rather than four. A CHECK may call an IMMUTABLE function;
-- replacing that function does not re-validate existing rows, which is what
-- we want — a scope that is withdrawn should stop being MINTED, not
-- retroactively invalidate keys somebody is using.
alter table public.api_tokens drop constraint if exists api_tokens_scope_valid;
alter table public.api_tokens add constraint api_tokens_scope_valid
  check (scope = any (public.ct_api_scopes()));

-- ── The agent claim ─────────────────────────────────────────────────────────

/**
 * True when the caller is an API-minted agent token rather than a browser
 * session. Only used to REMOVE an admin's write bypass, never to grant
 * anything, so a missing claim always resolves to the stricter answer.
 */
create or replace function public.ct_is_agent()
returns boolean language sql stable as $$
  select coalesce((nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'ct_agent')::boolean, false);
$$;
grant execute on function public.ct_is_agent() to authenticated, anon;

/** An admin write bypass that an agent token does not get. */
create or replace function public.ct_admin_write()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() and not public.ct_is_agent();
$$;
grant execute on function public.ct_admin_write() to authenticated, anon;

-- ── The five write gates, narrowed ──────────────────────────────────────────
-- Each keeps its membership branch exactly as it was; only the bare is_admin()
-- becomes ct_admin_write(). A human admin in the console is unaffected.

create or replace function public.ct_can_act_as_org(p_org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organizations o
     where o.id = p_org
       and coalesce(o.status, 'pending') = 'approved'
       and (
         o.owner_id = auth.uid()
         or exists (
           select 1 from public.org_members m
            where m.org_id = o.id
              and m.user_id = auth.uid()
              and coalesce(m.status, 'active') = 'active'
         )
       )
  ) or public.ct_admin_write();
$$;

drop policy if exists "orgs_owner_write" on public.organizations;
create policy "orgs_owner_write" on public.organizations for update
  using (auth.uid() = owner_id or public.org_perm(id, 'edit_profile') or public.ct_admin_write())
  with check (auth.uid() = owner_id or public.org_perm(id, 'edit_profile') or public.ct_admin_write());

drop policy if exists "events_owner_write" on public.events;
create policy "events_owner_write" on public.events for all
  using (public.org_perm(events.org_id, 'manage_events') or public.ct_admin_write())
  with check (public.org_perm(events.org_id, 'manage_events') or public.ct_admin_write());

drop policy if exists "org_members_write" on public.org_members;
create policy "org_members_write" on public.org_members for all
  using (public.org_perm(org_id, 'manage_team') or public.ct_admin_write()
         or exists (select 1 from public.organizations o where o.id = org_id and o.owner_id = auth.uid()))
  with check (public.org_perm(org_id, 'manage_team') or public.ct_admin_write()
              or exists (select 1 from public.organizations o where o.id = org_id and o.owner_id = auth.uid()));

-- org_invites had NO membership branch at all (admin only), so narrowing it
-- without adding one would leave an agent unable to invite anybody. A team
-- invite for an org you run is a team action, so manage_team is the right key.
-- An invite with a null org_id mints a brand-new organisation and stays an
-- admin-only act, which an agent correctly cannot perform.
drop policy if exists "org_invites_admin" on public.org_invites;
create policy "org_invites_admin" on public.org_invites for all
  using (public.ct_admin_write()
         or (org_id is not null and public.org_perm(org_id, 'manage_team')))
  with check (public.ct_admin_write()
              or (org_id is not null and public.org_perm(org_id, 'manage_team')));

-- ── Seeding membership on an org that has none ──────────────────────────────

/**
 * Add the caller as the owner-member of an organisation that has no team yet.
 *
 * Without this an agent could create an org (an admin act) and then never
 * publish to it, because publishing needs membership and adding membership
 * needs membership. Deliberately bounded: admin only, and only while the org
 * has NOBODY on it, so it can never be used to join a club that already has
 * people running it.
 */
create or replace function public.ct_agent_claim_org(p_org uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_id uuid; v_email text;
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organizations o where o.id = p_org) then
    raise exception 'No such organisation.' using errcode = 'P0002';
  end if;

  select id into v_id from public.org_members
   where org_id = p_org and user_id = v_uid limit 1;
  if v_id is not null then
    update public.org_members set status = 'active', role = 'owner' where id = v_id;
    return v_id;
  end if;

  if exists (select 1 from public.org_members m where m.org_id = p_org and coalesce(m.status,'active') = 'active') then
    raise exception 'That organisation already has a team. Ask one of them to invite you.'
      using errcode = '42501';
  end if;

  select email into v_email from auth.users where id = v_uid;
  insert into public.org_members (org_id, user_id, name, email, role, status, joined_at)
  values (p_org, v_uid, coalesce(split_part(v_email, '@', 1), 'Agent'), v_email, 'owner', 'active', now())
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.ct_agent_claim_org(uuid) to authenticated;

-- ── Audit ───────────────────────────────────────────────────────────────────

/**
 * Record an agent write.
 *
 * Without it a club's feed changes and nobody can tell whether it was the
 * founder, a club officer or the assistant. The actor is taken from the
 * session, never from the caller's arguments.
 */
create or replace function public.ct_agent_audit(
  p_action text,
  p_target uuid default null,
  p_value  jsonb default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_email text;
begin
  if v_uid is null then return; end if;
  select email into v_email from auth.users where id = v_uid;
  insert into public.admin_audit_log (actor_id, actor_email, action, target_id, new_value, reason)
  values (v_uid, v_email, left(coalesce(p_action, 'agent'), 80), p_target, p_value, 'api:agent');
end;
$$;
grant execute on function public.ct_agent_audit(text, uuid, jsonb) to authenticated;

-- ── Which accounts are agents, independent of how they got their token ──────
--
-- WHY A TABLE AS WELL AS THE CLAIM. The narrowing above hangs on `ct_agent`
-- being inside the token, which is fine while the API signs its own. It is
-- not fine as the only signal: the API also has a fallback that mints a
-- genuine Supabase session (used when SUPABASE_JWT_SECRET is not set), and a
-- real session token cannot carry a custom claim. If the claim were the only
-- evidence, that path would silently restore the admin write-anywhere bypass
-- — the exact thing this file exists to remove, failing open.
--
-- So an account can also be marked an agent once, here. It is the stronger
-- signal of the two: an agent account is passwordless and cannot be signed
-- into, so EVERY token that will ever exist for it is one the API minted.
--
-- Either signal is enough. Neither grants anything; both only remove.
create table if not exists public.agent_accounts (
  user_id    uuid primary key,
  label      text,
  created_at timestamptz not null default now()
);
-- Read through the definer function below and nowhere else. Who the agents
-- are is not interesting to a client, and a list of privileged accounts is
-- not a thing to hand out.
alter table public.agent_accounts enable row level security;

create or replace function public.ct_is_agent()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
           (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'ct_agent')::boolean,
           false
         )
      or exists (select 1 from public.agent_accounts a where a.user_id = auth.uid());
$$;
grant execute on function public.ct_is_agent() to authenticated, anon;
