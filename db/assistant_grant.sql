-- The assistant identity (Alfred): one account, a narrow platform grant, its
-- own token scope, and an audit trail. db/assistant_grant.sql.
--
-- WHO: rows in `assistant_grant`, checked by user id (ct_is_assistant()).
-- Only alfred@concordiatracker.com is in it. Regular admins are NOT, and the
-- check never looks at is_admin(), so nothing here widens anybody else.
--
-- WHAT, on EVERY organisation, current and future, without team membership:
--   stories, feed posts, events (create, edit, delete); the profile (name,
--   bio, logo, banner, links, colour; NOT the handle); insights; the team
--   list (read); pending team invites (create, revoke).
-- NOT: roles, removing teammates, ownership, handoff links (org_invites,
--   which can give a club away), the club inbox, handle changes.
--
-- The blanket `publish_any` agent flag Alfred's account had passed EVERY
-- permission key, team management included. It is switched off here, so the
-- allow-list below is the only path. Idempotent; safe to re-run.

create table if not exists public.assistant_grant (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_at timestamptz not null default now(),
  note text
);
alter table public.assistant_grant enable row level security;
revoke all on public.assistant_grant from anon, authenticated;

insert into public.assistant_grant (user_id, note)
select id, 'Alfred, the AI assistant' from auth.users where lower(email) = 'alfred@concordiatracker.com'
on conflict (user_id) do nothing;

update public.agent_accounts set publish_any = false
where user_id in (select user_id from public.assistant_grant);

create or replace function public.ct_is_assistant()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
     and exists (select 1 from public.assistant_grant g where g.user_id = auth.uid())
$$;
grant execute on function public.ct_is_assistant() to authenticated;

-- What the API's pre-check asks: may this account act on a club it is not on?
create or replace function public.ct_org_override()
returns boolean language sql stable security definer set search_path = public as $$
  select public.ct_agent_publish_any() or public.ct_is_assistant()
$$;
grant execute on function public.ct_org_override() to authenticated;

CREATE OR REPLACE FUNCTION public.org_perm(p_org uuid, p_perm text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with me as (select * from public.ct_org_my_member(p_org)),
       key as (
         -- Legacy aliases, mapped rather than duplicated.
         select case p_perm
                  when 'manage_events' then 'event_create'
                  when 'edit_profile'  then 'profile_edit'
                  else p_perm
                end as k
       )
  select public.ct_org_is_owner(p_org)
      or public.ct_admin_write()
      or public.ct_agent_publish_any()
      -- The assistant identity, CONTENT keys only (db/assistant_grant.sql).
      -- Team, roles and the handle are deliberately not in this list.
      or (public.ct_is_assistant() and (select k from key) in
            ('post_create','post_feed','post_edit','post_delete','event_create','draft_content','profile_edit','view_activity'))
      or coalesce(
           (select (m.permissions ->> (select k from key))::boolean from me m),
           (select (r.permissions ->> (select k from key))::boolean
              from me m join public.org_roles r on r.id = m.role_id),
           (select m.role in ('owner','admin') from me m),
           false
         );
$function$;

CREATE OR REPLACE FUNCTION public.ct_can_act_as_org(p_org uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  ) or public.ct_admin_write() or public.ct_agent_publish_any() or public.ct_is_assistant();
$function$;

CREATE OR REPLACE FUNCTION public.ct_guard_org_members()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_org     uuid := coalesce(new.org_id, old.org_id);
  am_owner  boolean;
  my_pos    int;
  r_pos     int;
  r_owner   boolean;
  mine      boolean;
begin
  -- A verb (SECURITY DEFINER) or the platform itself: it checked its own rules.
  if current_user not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;
  -- A human platform admin in the console. An agent account is NOT this —
  -- `ct_admin_write()` is false for it by design.
  if public.ct_admin_write() then
    return coalesce(new, old);
  end if;
  -- The assistant identity: pending invites only. It can create one (not an
  -- owner, not already an account, no permission override) and revoke one,
  -- and it can change nothing else on a team.
  if public.ct_is_assistant() then
    if tg_op = 'INSERT' and new.user_id is null and coalesce(new.status, 'invited') = 'invited'
       and new.permissions is null and coalesce(new.role, 'member') <> 'owner'
       and not coalesce((select m.owner from public.ct_role_meta(new.role_id) m), false) then
      return new;
    end if;
    if tg_op = 'DELETE' and coalesce(old.status, '') = 'invited' then
      return old;
    end if;
    raise exception 'The assistant can create and revoke pending invites, and nothing else on a team.'
      using errcode = '42501';
  end if;

  am_owner := public.ct_org_is_owner(v_org);
  my_pos   := public.ct_org_position(v_org);

  if tg_op = 'INSERT' then
    -- Owners invite whoever they like, including a co-owner (the onboarding
    -- "invite your president as an owner" path).
    if am_owner then return new; end if;

    if new.user_id is not null
       or coalesce(new.status, 'invited') <> 'invited'
       or new.permissions is not null then
      raise exception 'A new teammate joins by accepting an invite.'
        using errcode = '42501';
    end if;

    -- `trg_default_member_role` has already filled role_id from the legacy
    -- column (it sorts first), so this sees the role they would really get.
    select m.pos, m.owner into r_pos, r_owner from public.ct_role_meta(new.role_id) m;
    if coalesce(r_owner, false) or new.role = 'owner'
       or coalesce(r_pos, 2147483647) >= my_pos then
      raise exception 'You can only invite people to a role below your own.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Never, for anybody but a platform admin: moving a row to another club
    -- or onto another account is not an edit.
    if new.org_id is distinct from old.org_id
       or new.user_id is distinct from old.user_id then
      raise exception 'That cannot be changed here.' using errcode = '42501';
    end if;

    if am_owner then return new; end if;

    -- Access lives in these columns. A role changes through
    -- set_org_member_role (which checks both ends of the hierarchy), an invite
    -- is accepted through its verb, and a per-person permission override is
    -- an owner's call alone.
    if new.role is distinct from old.role
       or new.role_id is distinct from old.role_id
       or new.permissions is distinct from old.permissions
       or new.status is distinct from old.status
       or new.email is distinct from old.email
       or new.invite_token is distinct from old.invite_token
       or new.joined_at is distinct from old.joined_at then
      raise exception 'Roles and access change from the Roles page.'
        using errcode = '42501';
    end if;
    -- Name, title and photo are what somebody is called, not what they may do.
    return new;
  end if;

  -- DELETE
  if am_owner then return old; end if;

  mine := old.user_id = auth.uid()
          or (old.email is not null
              and lower(old.email) = lower(coalesce(auth.jwt() ->> 'email', '')));
  -- Leaving is always allowed.
  if mine then return old; end if;

  select m.pos, m.owner into r_pos, r_owner from public.ct_role_meta(old.role_id) m;
  if coalesce(r_owner, false) or old.role = 'owner'
     or coalesce(r_pos, 0) >= my_pos then
    raise exception 'You can only remove people below your own role.'
      using errcode = '42501';
  end if;
  return old;
end
$function$;


-- Team list (read) and pending invites (create, revoke). The guard trigger
-- above limits the writes to pending, non-owner invites.
drop policy if exists org_members_assistant_read on public.org_members;
create policy org_members_assistant_read on public.org_members
  for select to authenticated using (public.ct_is_assistant());
drop policy if exists org_members_assistant_invite on public.org_members;
create policy org_members_assistant_invite on public.org_members
  for insert to authenticated with check (public.ct_is_assistant() and status = 'invited' and user_id is null);
drop policy if exists org_members_assistant_revoke on public.org_members;
create policy org_members_assistant_revoke on public.org_members
  for delete to authenticated using (public.ct_is_assistant() and status = 'invited');

-- ── Audit: every write the assistant makes, recorded by the database ─────
-- A trigger, not a call in each API handler, so no code path can forget it.
create or replace function public.ct_assistant_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r jsonb := to_jsonb(coalesce(new, old));
  v_org uuid;
  v_op text := lower(tg_op);
begin
  if not public.ct_is_assistant() then
    return coalesce(new, old);
  end if;
  v_org := case when tg_table_name = 'organizations' then (r->>'id')::uuid else (r->>'org_id')::uuid end;
  -- A post is taken down by marking it deleted: log it as the delete it is.
  if tg_table_name = 'org_posts' and tg_op = 'UPDATE'
     and coalesce((to_jsonb(new)->>'deleted')::boolean, false)
     and not coalesce((to_jsonb(old)->>'deleted')::boolean, false) then
    v_op := 'delete';
  end if;
  insert into public.admin_audit_log (actor_id, actor_email, action, target_id, new_value, reason)
  values (
    auth.uid(),
    (select email from auth.users where id = auth.uid()),
    'assistant.' || tg_table_name || '.' || v_op,
    v_org,
    jsonb_build_object(
      'row_id', r->>'id',
      'org_handle', (select handle from public.organizations where id = v_org),
      'summary', left(coalesce(r->>'title', r->>'caption', r->>'name', r->>'email', ''), 140)
    ),
    'Assistant API write'
  );
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['org_stories','org_posts','events','organizations','org_members'] loop
    execute format('drop trigger if exists ct_assistant_audit on public.%I', t);
    execute format('create trigger ct_assistant_audit after insert or update or delete on public.%I
                    for each row execute function public.ct_assistant_audit()', t);
  end loop;
end $$;

create or replace function public.admin_assistant_activity(p_limit int default 200)
returns table (created_at timestamptz, action text, org_id uuid, org_handle text, org_name text, summary text)
language sql stable security definer set search_path = public as $$
  select a.created_at, a.action, a.target_id, coalesce(o.handle, a.new_value->>'org_handle'), o.name, a.new_value->>'summary'
  from public.admin_audit_log a
  left join public.organizations o on o.id = a.target_id
  where public.is_admin() and a.action like 'assistant.%'
  order by a.created_at desc
  limit greatest(1, least(coalesce(p_limit, 200), 1000))
$$;
grant execute on function public.admin_assistant_activity(int) to authenticated;

-- ── The token scope ──────────────────────────────────────────────────────
create or replace function public.ct_api_scopes() returns text[] language sql immutable as $$
  select array['owner', 'me', 'support', 'admin', 'assistant']::text[];
$$;
create or replace function public.ct_api_admin_scopes() returns text[] language sql immutable as $$
  select array['owner', 'support', 'admin', 'assistant']::text[];
$$;
create or replace function public.ct_api_scope_prefix(p_scope text) returns text language sql immutable as $$
  select case p_scope
           when 'owner'     then 'ct_owner_'
           when 'support'   then 'ct_sup_'
           when 'admin'     then 'ct_adm_'
           when 'assistant' then 'ct_ast_'
           else 'ct_per_'
         end;
$$;

CREATE OR REPLACE FUNCTION public.create_api_token(p_name text, p_scope text DEFAULT 'me'::text)
 RETURNS TABLE(id uuid, token text, prefix text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid   uuid := auth.uid();
  v_token text;
  v_name  text := nullif(btrim(coalesce(p_name, '')), '');
  v_count int;
begin
  if v_uid is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;
  -- An assistant token is issued TO the assistant identity, only through
  -- admin_create_assistant_token. Minting one for yourself here would be a
  -- token that looks like the assistant and is not.
  if p_scope = 'assistant' then
    raise exception 'Assistant tokens are created in the admin console.' using errcode = '42501';
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
$function$;


-- Issued TO the assistant identity by a human admin, shown once.
create or replace function public.admin_create_assistant_token(p_name text)
returns table (id uuid, token text, prefix text)
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_token text;
begin
  if not public.ct_admin_write() then
    raise exception 'Only a human admin can create an assistant token.' using errcode = '42501';
  end if;
  select g.user_id into v_owner from public.assistant_grant g order by g.granted_at limit 1;
  if v_owner is null then
    raise exception 'There is no assistant identity to issue it to.' using errcode = '22023';
  end if;
  v_token := public.ct_new_api_token('assistant');
  insert into public.api_tokens (user_id, scope, name, token_hash, prefix)
  values (v_owner, 'assistant', left(coalesce(nullif(btrim(p_name), ''), 'Assistant'), 60),
          public.ct_hash_api_token(v_token), left(v_token, 15))
  returning api_tokens.id into id;
  token := v_token;
  prefix := left(v_token, 15);
  return next;
end $$;

create or replace function public.admin_assistant_tokens()
returns table (id uuid, name text, prefix text, created_at timestamptz, last_used_at timestamptz, use_count int, revoked_at timestamptz)
language sql stable security definer set search_path = public as $$
  select t.id, t.name, t.prefix, t.created_at, t.last_used_at, t.use_count::int, t.revoked_at
  from public.api_tokens t
  where public.is_admin() and t.scope = 'assistant'
  order by t.created_at desc
$$;

create or replace function public.admin_revoke_assistant_token(p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.ct_admin_write() then raise exception 'Not authorized.' using errcode = '42501'; end if;
  update public.api_tokens set revoked_at = now() where id = p_id and scope = 'assistant' and revoked_at is null;
  return found;
end $$;

grant execute on function public.admin_create_assistant_token(text) to authenticated;
grant execute on function public.admin_assistant_tokens() to authenticated;
grant execute on function public.admin_revoke_assistant_token(uuid) to authenticated;
