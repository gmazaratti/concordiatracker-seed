-- 1. Both probe orgs start "done" (they have bios), which is the failing state.
update public.organizations set setup_completed_at = now()
 where handle like '@probe%cp3alr';
select handle, status, setup_completed_at is null as will_show, '1 before' as step
  from public.organizations where handle like '@probe%cp3alr' order by handle;
