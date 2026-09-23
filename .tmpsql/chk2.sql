select count(*) filter (where setup_completed_at is null) as will_show,
       count(*) filter (where setup_completed_at is not null) as already_done,
       count(*) as total
  from public.organizations;
