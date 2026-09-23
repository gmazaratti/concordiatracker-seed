-- ============================================================================
-- Nobody but a human platform admin can delete a club. Runs against the REAL
-- database inside a transaction that rolls back; nothing survives the run.
--
-- The RLS half runs under `set local role authenticated`, because the login
-- role this runs as BYPASSES RLS — asserting a policy as a superuser passes
-- while proving nothing (the lesson from the Alfred scope checks).
-- ============================================================================
begin;

create temporary table t_out (n int generated always as identity, label text, got text, want text);
create or replace function pg_temp.want(p_label text, p_got text, p_want text) returns void
language sql as $$ insert into t_out (label, got, want) values (p_label, p_got, p_want); $$;

create or replace function pg_temp.be(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_uid::text, 'role', 'authenticated',
                      'email', p_uid::text || '@t.test')::text, true);
$$;

create or replace function pg_temp.refused(p_sql text) returns text
language plpgsql as $$
begin
  execute p_sql;
  return 'ALLOWED';
exception when others then
  return 'refused';
end $$;

do $$
declare
  org uuid := gen_random_uuid();
  owner_u uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, instance_id, aud, role)
  values (owner_u, 'zz-del-owner@t.test', '00000000-0000-0000-0000-000000000000',
          'authenticated', 'authenticated');
  insert into public.organizations (id, owner_id, handle, name, glyph, color, status)
  values (org, owner_u, '@zz-deltest', 'Delete Test', 'DT', '#8fb39a', 'approved');
  perform set_config('t.org', org::text, true);
  perform set_config('t.owner', owner_u::text, true);
end $$;

-- 1. The owner, through the same path PostgREST uses: RLS applies.
select pg_temp.be(current_setting('t.owner')::uuid);
set local role authenticated;
delete from public.organizations where id = current_setting('t.org')::uuid;
reset role;
select pg_temp.want('an owner deleting through the API removes nothing',
  (select count(*)::text from public.organizations where id = current_setting('t.org')::uuid), '1');

-- 2. The owner, through the admin verb: not an admin.
select pg_temp.be(current_setting('t.owner')::uuid);
select pg_temp.want('an owner cannot call admin_delete_org',
  pg_temp.refused(format('select public.admin_delete_org(%L)', current_setting('t.org'))), 'refused');

-- 3. The agent account IS an admin, and is still refused — by the trigger.
select pg_temp.be((select user_id from public.agent_accounts limit 1));
select pg_temp.want('the agent really is an admin (so the trigger is what stops it)',
  public.is_admin()::text, 'true');
select pg_temp.want('the agent cannot delete a club even through the admin verb',
  pg_temp.refused(format('select public.admin_delete_org(%L)', current_setting('t.org'))), 'refused');
select pg_temp.want('and the club is still there',
  (select count(*)::text from public.organizations where id = current_setting('t.org')::uuid), '1');

-- 4. A human admin, from the console: the one path that works.
select pg_temp.be((select a.user_id from public.admins a
                    where not exists (select 1 from public.agent_accounts x where x.user_id = a.user_id)
                    limit 1));
select pg_temp.want('a human admin can delete from the console',
  pg_temp.refused(format('select public.admin_delete_org(%L)', current_setting('t.org'))), 'ALLOWED');
select pg_temp.want('and then it is gone',
  (select count(*)::text from public.organizations where id = current_setting('t.org')::uuid), '0');

-- 5. No permission key names deletion.
select pg_temp.want('no permission key can express deleting a club',
  (select count(*)::text from unnest(public.ct_org_perm_keys()) k where k ilike '%delete%' and k not like 'post_%'), '0');

select case when got = want then 'ok  ' else 'FAIL' end as r, label, got, want from t_out order by n;
rollback;
