with u as (select id, email from auth.users where email ilike '%senjisfn%')
select 'user' as what, (select id::text from u) as a, (select email from u) as b
union all
select 'owns', o.id::text, o.handle || ' · ' || o.status || ' · setup=' || coalesce(o.setup_completed_at::text,'NULL')
  from public.organizations o, u where o.owner_id = u.id
union all
select 'member of', m.org_id::text, coalesce(o.handle,'?') || ' · role=' || m.role || ' · ' || m.status
  from public.org_members m left join public.organizations o on o.id = m.org_id, u
 where m.user_id = u.id
union all
select 'invites used', i.token, coalesce(i.org_name,'') || ' · org_id=' || coalesce(i.org_id::text,'NULL') || ' · uses=' || i.use_count
  from public.org_invites i where i.use_count > 0 and i.created_at > now() - interval '2 days';
