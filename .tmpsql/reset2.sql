update public.organizations set setup_completed_at = null where handle = '@probeclubcp3alr';
select handle, setup_completed_at is null as will_show from public.organizations where handle='@probeclubcp3alr';
