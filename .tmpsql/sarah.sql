select o.handle, o.name, o.status, o.setup_completed_at is null as will_show,
       coalesce(nullif(trim(o.bio),''),'(no bio)') as bio,
       (o.logo is not null) as has_logo, (o.banner is not null) as has_banner,
       (select count(*) from events e where e.org_id=o.id) as events,
       u.email as owner_email, o.created_at
  from organizations o left join auth.users u on u.id = o.owner_id
 where u.email ilike '%senjisfn%' or o.created_at > now() - interval '2 days'
 order by o.created_at desc limit 8;
