select tablename, policyname, cmd,
       coalesce(qual,'-') as using_expr, coalesce(with_check,'-') as check_expr
  from pg_policies
 where schemaname='public' and tablename in ('events','organizations','org_posts','org_stories','org_activity')
 order by tablename, policyname;
