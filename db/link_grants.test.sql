-- Rolled back. (echo "begin;"; cat db/link_grants.test.sql; echo "rollback;") > .t.sql && supabase db query --linked -f .t.sql
create temp table r (step text, ok boolean, detail text) on commit drop;
grant all on r to authenticated;

do $$
declare n uuid := gen_random_uuid(); o uuid := gen_random_uuid(); s uuid := gen_random_uuid();
        x uuid := gen_random_uuid(); a uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, created_at, aud, role) values
    (n, 'lg-new@example.com', now(), 'authenticated', 'authenticated'),
    (o, 'lg-old@example.com', now() - interval '3 days', 'authenticated', 'authenticated'),
    (s, 'lg-sub@example.com', now(), 'authenticated', 'authenticated'),
    (x, 'lg-none@example.com', now(), 'authenticated', 'authenticated'),
    (a, 'lg-apple@example.com', now(), 'authenticated', 'authenticated');
  insert into public.user_profile (user_id, email, name, signup_ref) values
    (n, 'lg-new@example.com', 'New', 'linkedin-l'),
    (o, 'lg-old@example.com', 'Old', 'linkedin-l'),
    (s, 'lg-sub@example.com', 'Sub', 'linkedin-l'),
    (x, 'lg-none@example.com', 'None', 'reddit'),
    (a, 'lg-apple@example.com', 'Apple', 'linkedin-l');
  update public.user_profile set subscription_status = 'active', plan_status = 'pro', pro_until = null where user_id = s;
  update public.user_profile set iap_expires_at = now() + interval '5 months' where user_id = a;
  perform set_config('ct.n', n::text, true); perform set_config('ct.o', o::text, true);
  perform set_config('ct.s', s::text, true); perform set_config('ct.x', x::text, true);
  perform set_config('ct.a', a::text, true);
end $$;

set local role authenticated;
create or replace function pg_temp.as_user(k text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', current_setting('ct.' || k), 'role', 'authenticated')::text, true)
$$;

select pg_temp.as_user('n');
do $$ declare j jsonb; j2 jsonb; u timestamptz; begin
  j := public.claim_signup_grant();
  insert into r values ('new linkedin-l account is granted', (j->>'granted')::boolean, j::text);
  j2 := public.claim_signup_grant();
  insert into r values ('a second claim is refused (idempotent)', j2->>'reason' = 'already_granted', j2::text);
  begin
    update public.user_profile set pro_until = now() + interval '1 year' where user_id = auth.uid();
    insert into r values ('the student cannot extend it themselves', false, 'allowed');
  exception when others then insert into r values ('the student cannot extend it themselves', true, sqlerrm); end;
  begin
    insert into public.signup_grants (user_id, source, pro_until) values (auth.uid(), 'linkedin-l', now());
    insert into r values ('a grant row cannot be written directly', false, 'allowed');
  exception when others then insert into r values ('a grant row cannot be written directly', true, sqlerrm); end;
end $$;
select pg_temp.as_user('o');
do $$ declare j jsonb; begin j := public.claim_signup_grant();
  insert into r values ('an existing (3-day-old) account is refused', j->>'reason' = 'not_a_new_account', j::text); end $$;
select pg_temp.as_user('s');
do $$ declare j jsonb; begin j := public.claim_signup_grant();
  insert into r values ('a Stripe subscriber is left alone', j->>'reason' = 'already_pro', j::text); end $$;
select pg_temp.as_user('a');
do $$ declare j jsonb; begin j := public.claim_signup_grant();
  insert into r values ('an Apple subscriber is left alone', j->>'reason' = 'already_pro', j::text); end $$;
select pg_temp.as_user('x');
do $$ declare j jsonb; begin j := public.claim_signup_grant();
  insert into r values ('another source gets nothing', j->>'reason' = 'no_eligible_source', j::text); end $$;
reset role;

do $$ declare d numeric; st text; sub text; begin
  select extract(epoch from (p.pro_until - u.created_at)) / 86400, p.plan_status, p.subscription_status
    into d, st, sub
    from public.user_profile p join auth.users u on u.id = p.user_id where p.user_id = current_setting('ct.n')::uuid;
  insert into r values ('grant is exactly 14 days from signup, billing untouched',
    round(d, 3) = 14 and st is distinct from 'pro' and sub is null, d::text || ' ' || coalesce(st,'') || ' ' || coalesce(sub,''));
  select p.plan_status, p.subscription_status into st, sub from public.user_profile p where p.user_id = current_setting('ct.s')::uuid;
  insert into r values ('the subscriber row is unchanged', st = 'pro' and sub = 'active', st || ' ' || sub);
end $$;
select step, ok, detail from r;
