select 'members' as what, count(*)::text as n from public.org_members
union all select 'orgs', count(*)::text from public.organizations
union all select 'activity rows', count(*)::text from public.org_activity
union all select 'notify fns', string_agg(p.proname, ', ' order by p.proname)
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname like '%notif%'
union all select 'policies using ct_can_act_as_org',
  (select string_agg(tablename||'.'||policyname, ', ')
     from pg_policies where schemaname='public'
      and (qual like '%ct_can_act_as_org%' or with_check like '%ct_can_act_as_org%'));
