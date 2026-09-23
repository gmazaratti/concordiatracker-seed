update public.organizations
   set owner_id = (select id from auth.users where email = 'ct-probe-ui-cp3alr@example.com')
 where handle = '@probeclubcp3alr';
select o.id, o.handle, o.status, o.setup_completed_at is null as will_show
  from public.organizations o where o.handle = '@probeclubcp3alr';
