select 'org_activity cols' as what,
       string_agg(column_name||':'||data_type, ', ' order by ordinal_position) as detail
  from information_schema.columns where table_schema='public' and table_name='org_activity'
union all
select 'org_roles exists', coalesce((select 'yes' from information_schema.tables
  where table_schema='public' and table_name='org_roles'), 'no')
union all
select 'notifications cols',
       string_agg(column_name, ', ' order by ordinal_position)
  from information_schema.columns where table_schema='public' and table_name='notifications'
union all
select 'org_members role values', string_agg(distinct role, ', ')
  from public.org_members
union all
select 'members with perms override', count(*)::text
  from public.org_members where permissions is not null and permissions <> '{}'::jsonb;
