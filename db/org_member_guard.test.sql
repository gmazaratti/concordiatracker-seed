-- ============================================================================
-- The team table cannot be used to climb the hierarchy. Runs against the REAL
-- database in a transaction that rolls back.
--
-- Every write runs under `set local role authenticated` — the login role this
-- file runs as bypasses RLS AND is not 'authenticated', so without that the
-- trigger would (correctly) wave everything through and prove nothing.
-- ============================================================================
begin;

create temporary table t_out (n int generated always as identity, label text, got text, want text);
create or replace function pg_temp.want(p_label text, p_got text, p_want text) returns void
language sql as $$ insert into t_out (label, got, want) values (p_label, p_got, p_want); $$;

create or replace function pg_temp.be(p_uid uuid, p_email text) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_uid::text, 'role', 'authenticated', 'email', p_email)::text, true);
$$;

-- Runs as `authenticated`, so RLS and the trigger both apply.
create or replace function pg_temp.try(p_sql text) returns text
language plpgsql as $$
begin
  set local role authenticated;
  execute p_sql;
  reset role;
  return 'ALLOWED';
exception when others then
  reset role;
  return 'refused';
end $$;
grant execute on function pg_temp.try(text) to authenticated;

do $$
declare
  org uuid := gen_random_uuid();
  owner_u uuid := gen_random_uuid();
  sec_u uuid := gen_random_uuid();
  adm_u uuid := gen_random_uuid();
  low_u uuid := gen_random_uuid();
  sec_role uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, instance_id, aud, role) values
    (owner_u, 'zz-g-owner@t.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    (sec_u,   'zz-g-sec@t.test',   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    (adm_u,   'zz-g-adm@t.test',   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    (low_u,   'zz-g-low@t.test',   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
  insert into public.organizations (id, owner_id, handle, name, glyph, color, status)
  values (org, owner_u, '@zz-guardtest', 'Guard Test', 'GT', '#8fb39a', 'approved');

  -- A Secretary: manage_team and nothing else, at 32.
  insert into public.org_roles (id, org_id, name, color, position, permissions, can_view_activity, is_owner)
  values (sec_role, org, 'Secretary', '#94a3b8', 32, '{"manage_team": true}', false, false);

  insert into public.org_members (org_id, user_id, name, email, role, status, role_id) values
    (org, sec_u, 'Sec', 'zz-g-sec@t.test', 'member', 'active', sec_role),
    (org, adm_u, 'Adm', 'zz-g-adm@t.test', 'admin',  'active',
       (select id from public.org_roles where org_id = org and system_key = 'admin')),
    (org, low_u, 'Low', 'zz-g-low@t.test', 'member', 'active',
       (select id from public.org_roles where org_id = org and system_key = 'member'));

  perform set_config('t.org', org::text, true);
  perform set_config('t.owner', owner_u::text, true);
  perform set_config('t.sec', sec_u::text, true);
  perform set_config('t.adm', adm_u::text, true);
  perform set_config('t.low', low_u::text, true);
end $$;

-- ── The Secretary tries to climb ─────────────────────────────────────────────
select pg_temp.be(current_setting('t.sec')::uuid, 'zz-g-sec@t.test');

select pg_temp.want('the secretary really can manage the team (so the guard is what stops them)',
  public.org_perm(current_setting('t.org')::uuid, 'manage_team')::text, 'true');

select pg_temp.want('cannot move their own row to the Owner role',
  pg_temp.try(format($q$update public.org_members set role_id =
    (select id from public.org_roles where org_id = %L and is_owner) where user_id = %L$q$,
    current_setting('t.org'), current_setting('t.sec'))), 'refused');

select pg_temp.want('cannot write themselves a permission override',
  pg_temp.try(format($q$update public.org_members set permissions = '{"handle_change":true,"roles_grant":true}'
    where user_id = %L$q$, current_setting('t.sec'))), 'refused');

select pg_temp.want('cannot insert an already-active row under their own email',
  pg_temp.try(format($q$insert into public.org_members (org_id, name, email, role, status)
    values (%L, 'Me again', 'zz-g-sec@t.test', 'member', 'active')$q$, current_setting('t.org'))), 'refused');

select pg_temp.want('cannot invite somebody as Admin (above 32)',
  pg_temp.try(format($q$insert into public.org_members (org_id, name, email, role, status, invite_token)
    values (%L, 'Friend', 'friend@t.test', 'admin', 'invited', 'tok-zz-1')$q$, current_setting('t.org'))), 'refused');

select pg_temp.want('CAN invite somebody as Member (below 32)',
  pg_temp.try(format($q$insert into public.org_members (org_id, name, email, role, status, invite_token)
    values (%L, 'Friend', 'friend2@t.test', 'member', 'invited', 'tok-zz-2')$q$, current_setting('t.org'))), 'ALLOWED');

select pg_temp.want('cannot remove the Admin above them',
  pg_temp.try(format($q$delete from public.org_members where user_id = %L$q$, current_setting('t.adm'))), 'refused');

select pg_temp.want('CAN remove a Member below them',
  pg_temp.try(format($q$delete from public.org_members where user_id = %L$q$, current_setting('t.low'))), 'ALLOWED');

select pg_temp.want('and the Member really is gone',
  (select count(*)::text from public.org_members where user_id = current_setting('t.low')::uuid), '0');

select pg_temp.want('cannot mint a handoff invite for the club',
  pg_temp.try(format($q$insert into public.org_invites (token, org_id, max_uses, org_name, org_handle)
    values ('zz-handoff-tok', %L, 1, 'Guard Test', '@zz-guardtest')$q$, current_setting('t.org'))), 'refused');

select pg_temp.want('CAN still set their own title',
  pg_temp.try(format($q$update public.org_members set title = 'Keeper of lists' where user_id = %L$q$,
    current_setting('t.sec'))), 'ALLOWED');

select pg_temp.want('CAN leave the team',
  pg_temp.try(format($q$delete from public.org_members where user_id = %L$q$, current_setting('t.sec'))), 'ALLOWED');

-- ── The Admin, through the proper verb ───────────────────────────────────────
select pg_temp.be(current_setting('t.adm')::uuid, 'zz-g-adm@t.test');
select pg_temp.want('the Admin still cannot promote themselves directly',
  pg_temp.try(format($q$update public.org_members set role = 'owner' where user_id = %L$q$,
    current_setting('t.adm'))), 'refused');

-- ── The owner is unaffected ──────────────────────────────────────────────────
select pg_temp.be(current_setting('t.owner')::uuid, 'zz-g-owner@t.test');
select pg_temp.want('the owner can still remove the Admin',
  pg_temp.try(format($q$delete from public.org_members where user_id = %L$q$, current_setting('t.adm'))), 'ALLOWED');
select pg_temp.want('the owner can still invite a co-owner',
  pg_temp.try(format($q$insert into public.org_members (org_id, name, email, role, status, invite_token)
    values (%L, 'Co', 'co@t.test', 'owner', 'invited', 'tok-zz-3')$q$, current_setting('t.org'))), 'ALLOWED');
select pg_temp.want('the owner can still mint a handoff invite',
  pg_temp.try(format($q$insert into public.org_invites (token, org_id, max_uses, org_name, org_handle)
    values ('zz-handoff-tok-2', %L, 1, 'Guard Test', '@zz-guardtest')$q$, current_setting('t.org'))), 'ALLOWED');
select pg_temp.want('nobody can move a row to another account',
  pg_temp.try(format($q$update public.org_members set user_id = %L where email = 'friend2@t.test'$q$,
    current_setting('t.owner'))), 'refused');

select case when got = want then 'ok  ' else 'FAIL' end as r, label, got, want from t_out order by n;
rollback;
