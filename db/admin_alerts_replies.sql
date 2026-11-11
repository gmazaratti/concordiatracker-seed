-- Admin alerts, round two (2026-11-05).
--
-- The 15-minute digest already pushed NEW tickets and a count of new feature
-- requests / bug reports. What it never did:
--   * a REPLY on a ticket that already exists (TKT-1034 and TKT-1037 each sat
--     with an unanswered student message since Sep 29 because of this), and
--   * a COMMENT on a feature request,
-- and the requests / bugs it did report arrived as "2 new things to review"
-- linking to /app, which says nothing about whether to look.
--
-- So two new lists, one push per item in the API:
--   new_replies  — student messages on an existing ticket   (pref: tickets)
--   new_feedback — feature requests, bug reports, and comments on requests,
--                  each with its title and who wrote it     (pref: feedback)
-- The old `features` / `bugs` counts stay so an older deployment of the API
-- keeps working while this one rolls out.
--
-- A return type cannot be widened by `create or replace`, hence the drop.

drop function if exists public.admin_activity_digests();

create function public.admin_activity_digests()
 returns table(user_id uuid, features integer, bugs integer, applications integer, new_users jsonb,
               new_orgs jsonb, new_tickets jsonb, new_scans jsonb, new_replies jsonb, new_feedback jsonb)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  return query
  with computed as (
    select adm.user_id,
           coalesce(adm.activity_pushed_at, 'epoch'::timestamptz) as since,
           coalesce(adm.alert_prefs, '{}'::jsonb) as prefs
      from public.admins adm
  ),
  data as (
    select c.user_id,
      case when public.ct_alert_on(c.prefs, 'feedback') then
        (select count(*) from public.feature_requests fr
          where fr.hidden = false and fr.created_at > c.since) else 0 end as features,
      case when public.ct_alert_on(c.prefs, 'feedback') then
        (select count(*) from public.bug_reports br
          where br.created_at > c.since) else 0 end as bugs,
      case when public.ct_alert_on(c.prefs, 'requests') then
        ((select count(*) from public.access_requests ar
            where ar.status = 'pending' and ar.created_at > c.since)
         + (select count(*) from public.teacher_accounts tc
            where tc.status = 'pending' and tc.created_at > c.since)) else 0 end as applications,
      case when public.ct_alert_on(c.prefs, 'signups') then
        (select coalesce(jsonb_agg(jsonb_build_object(
            'name',  coalesce(up.name, up.email, 'New user'),
            'email', coalesce(up.email, '')
          ) order by up.created_at), '[]'::jsonb)
          from public.user_profile up
         where up.user_id <> c.user_id and up.created_at > c.since
           and coalesce(up.is_internal, false) = false)
      else '[]'::jsonb end as new_users,
      case when public.ct_alert_on(c.prefs, 'orgs') then
        (select coalesce(jsonb_agg(jsonb_build_object(
            'name', o.name, 'handle', o.handle
          ) order by o.created_at), '[]'::jsonb)
          from public.organizations o
         where o.status = 'pending' and o.created_at > c.since)
      else '[]'::jsonb end as new_orgs,
      case when public.ct_alert_on(c.prefs, 'tickets') then
        (select coalesce(jsonb_agg(jsonb_build_object(
            'case_id', t.case_id,
            'subject', t.subject,
            'who',     coalesce(nullif(t.name, ''), t.email, 'Someone')
          ) order by t.created_at), '[]'::jsonb)
          from public.tickets t
          left join public.user_profile p on p.user_id = t.user_id
         where t.created_at > c.since
           and coalesce(p.is_internal, false) = false
           and t.user_id is distinct from c.user_id
           -- A check-in WE opened (db/personal_outreach.sql) is not news;
           -- their reply to it is, and arrives as a reply below.
           and coalesce(t.context->>'kind', '') <> 'outreach')
      else '[]'::jsonb end as new_tickets,
      (select coalesce(jsonb_agg(jsonb_build_object(
            'ok',     e.success,
            'file',   coalesce(e.file_name, 'a syllabus'),
            'course', e.course_code,
            'items',  e.items,
            'error',  left(coalesce(e.error, ''), 140),
            'who',    coalesce(p.name, p.email, 'A student')
          ) order by e.finished_at), '[]'::jsonb)
         from public.parse_events e
         left join public.user_profile p on p.user_id = e.user_id
        where e.finished_at > c.since
          and e.success is not null
          and coalesce(p.is_internal, false) = false
          and ((e.success and public.ct_alert_on(c.prefs, 'scans'))
            or (not e.success and public.ct_alert_on(c.prefs, 'scan_failures')))
      ) as new_scans,
      -- A student writing again on a ticket that already exists. The first
      -- message of a ticket IS the ticket (already in new_tickets), so only
      -- messages with an earlier one on the same ticket count.
      case when public.ct_alert_on(c.prefs, 'tickets') then
        (select coalesce(jsonb_agg(jsonb_build_object(
            'case_id', t.case_id,
            'subject', t.subject,
            'who',     coalesce(nullif(m.author_name, ''), nullif(t.name, ''), t.email, 'Someone'),
            'body',    left(m.body, 140)
          ) order by m.created_at), '[]'::jsonb)
          from public.ticket_messages m
          join public.tickets t on t.id = m.ticket_id
          left join public.user_profile p on p.user_id = t.user_id
         where m.created_at > c.since
           and m.author_role = 'user'
           and coalesce(p.is_internal, false) = false
           and m.author_id is distinct from c.user_id
           and exists (select 1 from public.ticket_messages m0
                        where m0.ticket_id = m.ticket_id and m0.created_at < m.created_at))
        -- Replies to an admin's direct note (admin_messages) count too: they
        -- were only visible inside that one person's admin panel.
        || (select coalesce(jsonb_agg(jsonb_build_object(
              'case_id', 'Note',
              'subject', left(am.body, 80),
              'who',     coalesce(up.name, up.email, 'Someone'),
              'body',    left(am.reply, 140)
            ) order by am.replied_at), '[]'::jsonb)
            from public.admin_messages am
            left join public.user_profile up on up.user_id = am.recipient
           where am.replied_at > c.since and am.reply is not null)
      else '[]'::jsonb end as new_replies,
      -- Requests, bugs and request comments, each named. Staff comments and
      -- anything an admin wrote are not news to an admin.
      case when public.ct_alert_on(c.prefs, 'feedback') then
        (select coalesce(jsonb_agg(x.item order by x.at), '[]'::jsonb) from (
            select fr.created_at as at, jsonb_build_object(
                     'kind', 'request', 'title', left(fr.title, 120),
                     'who', coalesce(nullif(fr.author_name, ''), 'Someone')) as item
              from public.feature_requests fr
             where fr.hidden = false and fr.created_at > c.since
               and fr.user_id is distinct from c.user_id
            union all
            select br.created_at, jsonb_build_object(
                     'kind', 'bug', 'title', left(br.title, 120),
                     'who', coalesce(nullif(br.user_email, ''), 'Someone'))
              from public.bug_reports br
             where br.created_at > c.since
               and br.user_id is distinct from c.user_id
            union all
            select fc.created_at, jsonb_build_object(
                     'kind', 'comment', 'title', left(fr.title, 120),
                     'who', coalesce(nullif(fc.author_name, ''), 'Someone'),
                     'body', left(fc.body, 140))
              from public.feature_request_comments fc
              join public.feature_requests fr on fr.id = fc.request_id
             where fc.created_at > c.since
               and fc.hidden = false
               and coalesce(fc.is_staff, false) = false
               and fc.user_id is distinct from c.user_id
               and not exists (select 1 from public.admins a2 where a2.user_id = fc.user_id)
          ) x)
      else '[]'::jsonb end as new_feedback
    from computed c
  ),
  stamped as (
    update public.admins adm set activity_pushed_at = now()
      from data d
     where adm.user_id = d.user_id
    returning adm.user_id
  )
  select d.user_id, d.features::int, d.bugs::int, d.applications::int,
         d.new_users, d.new_orgs, d.new_tickets, d.new_scans, d.new_replies, d.new_feedback
    from data d
   where (d.features + d.bugs + d.applications
          + jsonb_array_length(d.new_users) + jsonb_array_length(d.new_orgs)
          + jsonb_array_length(d.new_tickets) + jsonb_array_length(d.new_scans)
          + jsonb_array_length(d.new_replies) + jsonb_array_length(d.new_feedback)) > 0;
end; $function$;

revoke all on function public.admin_activity_digests() from public, anon, authenticated;
grant execute on function public.admin_activity_digests() to service_role;
