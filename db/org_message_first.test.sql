-- The messaging guardrail, against the real database, rolled back.
begin;
create temporary table t_out (n int generated always as identity, label text, got text, want text);
create or replace function pg_temp.want(l text, g text, w text) returns void
language sql as $$ insert into t_out (label, got, want) values (l, g, w); $$;
create or replace function pg_temp.refused(q text) returns text language plpgsql as $$
begin execute q; return 'ALLOWED'; exception when others then return 'refused'; end $$;

do $$
declare
  org uuid := gen_random_uuid();
  owner_u uuid := gen_random_uuid();
  follower uuid := gen_random_uuid();
  stranger uuid := gen_random_uuid();
  quiet uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, instance_id, aud, role) values
    (owner_u,  'zz-o@t.test', '00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
    (follower, 'zz-f@t.test', '00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
    (stranger, 'zz-s@t.test', '00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
    (quiet,    'zz-q@t.test', '00000000-0000-0000-0000-000000000000','authenticated','authenticated');
  insert into public.user_profile (user_id, email, name, handle, allow_org_dms) values
    (follower,'zz-f@t.test','Fran','zzfran', true),
    (stranger,'zz-s@t.test','Stan','zzstan', true),
    (quiet,   'zz-q@t.test','Quinn','zzquinn', false);

  insert into public.organizations (id, owner_id, handle, name, glyph, color, status)
  values (org, owner_u, '@zz-dmtest', 'DM Test', 'DT', '#8fb39a', 'approved');
  insert into public.org_members (org_id, user_id, name, email, role, status, joined_at)
  values (org, owner_u, 'Owner', 'zz-o@t.test', 'owner', 'active', now());

  insert into public.org_follows (org_id, user_id) values (org, follower), (org, quiet);

  perform set_config('request.jwt.claims',
    json_build_object('sub', owner_u::text, 'role','authenticated','email','zz-o@t.test')::text, true);

  perform pg_temp.want('a stranger cannot be messaged first',
    public.ct_org_dm_block_reason(org, stranger), 'not_a_follower');
  perform pg_temp.want('a follower can',
    coalesce(public.ct_org_dm_block_reason(org, follower), 'ok'), 'ok');
  perform pg_temp.want('a follower who opted out cannot',
    public.ct_org_dm_block_reason(org, quiet), 'opted_out');

  perform pg_temp.want('sending to a stranger is refused',
    pg_temp.refused(format('select public.send_org_dm(%L,%L,%L)', org, stranger, 'hi')), 'refused');
  perform pg_temp.want('sending to a follower works',
    pg_temp.refused(format('select public.send_org_dm(%L,%L,%L)', org, follower, 'hi')), 'ALLOWED');

  perform pg_temp.want('ONE opener, then it is their turn',
    public.ct_org_dm_block_reason(org, follower), 'awaiting_reply');
  perform pg_temp.want('a second opener is refused',
    pg_temp.refused(format('select public.send_org_dm(%L,%L,%L)', org, follower, 'again')), 'refused');

  -- They answer; the club can talk freely from then on.
  insert into public.messages (sender, recipient_org, body) values (follower, org, 'hello back');
  perform pg_temp.want('after they reply the club may write again',
    coalesce(public.ct_org_dm_block_reason(org, follower), 'ok'), 'ok');

  perform pg_temp.want('an empty body is refused',
    pg_temp.refused(format('select public.send_org_dm(%L,%L,%L)', org, follower, '   ')), 'refused');

  perform pg_temp.want('candidates exclude the opted-out follower',
    (select count(*)::text from public.org_dm_candidates(org, '')), '1');
  perform pg_temp.want('and search narrows them',
    (select count(*)::text from public.org_dm_candidates(org, 'nomatch')), '0');

  -- Somebody else's club.
  perform set_config('request.jwt.claims',
    json_build_object('sub', stranger::text, 'role','authenticated','email','zz-s@t.test')::text, true);
  perform pg_temp.want('a non-member cannot message as the club',
    public.ct_org_dm_block_reason(org, follower), 'not_your_org');
end $$;

select case when got is not distinct from want then 'ok  ' else 'FAIL' end as r, label, got, want
  from t_out order by n;
rollback;
