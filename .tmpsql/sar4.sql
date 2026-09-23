select o.handle, o.name, o.status, o.owner_id is not null as has_owner,
       o.setup_completed_at is null as wizard_will_show,
       coalesce(nullif(trim(o.bio),''),'(none)') as bio, o.created_at
  from public.organizations o
 where o.handle in ('@testclub-mpyug7','@flow-test-boid','@testclub-hcb6')
 order by o.created_at;
