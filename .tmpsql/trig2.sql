-- 2. THE HANDOFF: owner changes hands. The trigger must re-open setup.
update public.organizations
   set owner_id = (select id from auth.users where email like 'ct-probe-ui-cp3alr%' limit 1)
 where handle = '@probeclubcp3alr'
   and owner_id is distinct from (select id from auth.users where email like 'ct-probe-ui-cp3alr%' limit 1);
-- force a real change to prove the trigger:
update public.organizations set owner_id = null where handle = '@probeclubcp3alr';
select handle, setup_completed_at is null as will_show_after_handoff
  from public.organizations where handle = '@probeclubcp3alr';
