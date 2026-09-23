select p.proname, pg_get_functiondef(p.oid) as def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public'
   and p.proname in ('ct_notify','ct_can_act_as_org','ct_is_org_member','ct_org_people')
 order by 1;
