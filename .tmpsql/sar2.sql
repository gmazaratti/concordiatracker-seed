update public.organizations set setup_completed_at = null where handle = '@testclub-hcb6';
select o.handle, o.status, o.owner_id, o.setup_completed_at,
       (select count(*) from org_members m where m.org_id=o.id) as members,
       (select string_agg(m.email,', ') from org_members m where m.org_id=o.id) as team
  from public.organizations o where o.handle = '@testclub-hcb6';
