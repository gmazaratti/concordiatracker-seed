-- Her freshly-accepted handoff club: re-open setup so she can retest at once.
update public.organizations set setup_completed_at = null where handle = '@flow-test-boid';
select handle, status, setup_completed_at is null as wizard_will_show
  from public.organizations where handle in ('@flow-test-boid','@testclub-mpyug7');
