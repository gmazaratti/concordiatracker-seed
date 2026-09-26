-- Scenario test for db/product_analytics.sql, against the real database.
-- Runs inside one transaction that is ROLLED BACK, so nothing persists:
--   npm run db:analytics
-- Creates three throwaway auth users (ct-probe-pa-*), exercises every trigger,
-- the opt-out, the refusals, and runs the reports as a human admin and as a
-- non-admin. Read the final select: each result should match its label.
create temp table r(step text, result text) on commit drop;
grant all on r to authenticated;

insert into auth.users (id, email, aud, role, instance_id) values
 ('77777777-0000-0000-0000-00000000000a', 'ct-probe-pa-a@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
 ('77777777-0000-0000-0000-00000000000b', 'ct-probe-pa-b@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
 ('77777777-0000-0000-0000-00000000000c', 'ct-probe-pa-c@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
insert into public.user_profile (user_id, email, name, signup_channel) values
 ('77777777-0000-0000-0000-00000000000a', 'ct-probe-pa-a@example.com', 'Probe A', 'instagram'),
 ('77777777-0000-0000-0000-00000000000b', 'ct-probe-pa-b@example.com', 'Probe B', 'reddit'),
 ('77777777-0000-0000-0000-00000000000c', 'ct-probe-pa-c@example.com', 'Probe C', null);

-- activation
update public.user_profile set onboarding_completed = true where user_id = '77777777-0000-0000-0000-00000000000a';
insert into public.courses (id, user_id, code, name, term, source) values
 ('pa-course-1', '77777777-0000-0000-0000-00000000000a', 'COMP 248', 'x', 'Fall 2026', 'catalogue'),
 ('pa-course-2', '77777777-0000-0000-0000-00000000000a', 'COMP 249', 'y', 'Fall 2026', null);
insert into public.assignments (id, user_id, course_id, title, done) values
 ('77777777-0000-0000-0000-0000000000f1', '77777777-0000-0000-0000-00000000000a', 'pa-course-1', 'A1', false);
update public.assignments set done = true where id = '77777777-0000-0000-0000-0000000000f1';
insert into r select 'activation events for A', string_agg(name || coalesce(' ' || props::text, ''), ' | ' order by id)
  from public.analytics_events where user_id = '77777777-0000-0000-0000-00000000000a';

-- server-side feature triggers
insert into public.org_follows (user_id, org_id) select '77777777-0000-0000-0000-00000000000a', id from public.organizations where status = 'approved' limit 1;
insert into public.calendar_feeds (user_id, token) values ('77777777-0000-0000-0000-00000000000a', 'pa' || md5('x'));
insert into r select 'server feature events', string_agg(props->>'feature', ',' order by props->>'feature')
  from public.analytics_events where user_id = '77777777-0000-0000-0000-00000000000a' and name = 'feature_used';

-- client door, as A
select set_config('request.jwt.claims', '{"sub":"77777777-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select public.track_feature('quick_links');
select public.track_feature('quick_links');
select public.track_feature('syllabus_upload');
select public.track_feature('not_a_feature');
do $$ begin perform count(*) from public.analytics_events; insert into r values ('A can read analytics_events', 'ALLOWED'); exception when others then insert into r values ('A can read analytics_events', 'refused'); end $$;
do $$ begin perform public.ct_track('77777777-0000-0000-0000-00000000000a', 'feature_used', '{}'); insert into r values ('A calls ct_track directly', 'ALLOWED'); exception when others then insert into r values ('A calls ct_track directly', 'refused'); end $$;
insert into r select 'churn survey A (first, second)', public.submit_churn_feedback('pro_cancel', 'too_expensive', 'costs too much')::text || ',' || public.submit_churn_feedback('pro_cancel', 'other', null)::text;
do $$ begin perform public.admin_product_analytics(30); insert into r values ('A runs admin report', 'ALLOWED'); exception when others then insert into r values ('A runs admin report', 'refused'); end $$;
reset role;
insert into r select 'client features for A (quick_links once, nothing else)', string_agg(props->>'feature', ',' order by props->>'feature')
  from public.analytics_events where user_id = '77777777-0000-0000-0000-00000000000a' and name = 'feature_used';

-- opt-out, as B
insert into public.analytics_events (user_id, name) values ('77777777-0000-0000-0000-00000000000b', 'signup_completed');
insert into public.site_events (session_id, visitor_id, user_id, kind, path) values ('s', 'v', '77777777-0000-0000-0000-00000000000b', 'view', '/app');
select set_config('request.jwt.claims', '{"sub":"77777777-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select public.set_analytics_opt_out(true);
select public.track_feature('quick_links');
insert into r select 'B survey after opt-out', public.submit_churn_feedback('account_delete', 'privacy', null)::text;
reset role;
insert into public.courses (id, user_id, code, name, term) values ('pa-course-3', '77777777-0000-0000-0000-00000000000b', 'COMP 250', 'z', 'Fall 2026');
insert into public.site_events (session_id, visitor_id, user_id, kind, path) values ('s2', 'v2', '77777777-0000-0000-0000-00000000000b', 'view', '/app');
insert into r select 'B analytics rows after opt-out', count(*)::text from public.analytics_events where user_id = '77777777-0000-0000-0000-00000000000b';
insert into r select 'B site_events linked to account', count(*)::text from public.site_events where user_id = '77777777-0000-0000-0000-00000000000b';
insert into r select 'B site_events still counted anonymously', count(*)::text from public.site_events where visitor_id in ('v', 'v2');
insert into r select 'B churn row stored without id', (select count(*) from public.churn_feedback where kind = 'account_delete' and source = 'survey' and user_id is null and reason = 'privacy')::text;

-- email events
insert into r select 'email event first/dup', public.record_email_event('msg_1', 'em_1', 'club_invite', 'delivered', '77777777-0000-0000-0000-00000000000a', now())::text
  || ',' || public.record_email_event('msg_1', 'em_1', 'club_invite', 'delivered', '77777777-0000-0000-0000-00000000000a', now())::text;
select public.record_email_event('msg_2', 'em_2', 'Bad Name!', 'opened', '77777777-0000-0000-0000-00000000000b', now());
insert into r select 'email rows (template,user kept?)', string_agg(template || ':' || (user_id is not null)::text, ',' order by id) from public.email_events where webhook_id in ('msg_1', 'msg_2');

-- props allowlist and vocabulary
insert into r select 'clean props', public.ct_clean_props('feature_used', '{"feature":"quick_links","email":"a@b.c","feature2":"x"}')::text;
insert into r select 'clean props rejects long/odd', public.ct_clean_props('feature_used', '{"feature":"https://x.y/?token=abc"}')::text;
do $$ begin perform public.ct_track('77777777-0000-0000-0000-00000000000a', 'made_up', '{}'); insert into r values ('unknown event name', 'ALLOWED'); exception when others then insert into r values ('unknown event name', 'refused'); end $$;

-- churn triggers
update public.user_profile set cancel_at_period_end = true, plan_status = 'semester' where user_id = '77777777-0000-0000-0000-00000000000a';
update public.user_profile set subscription_status = 'active' where user_id = '77777777-0000-0000-0000-00000000000a';
update public.user_profile set subscription_status = 'canceled' where user_id = '77777777-0000-0000-0000-00000000000a';
insert into r select 'churn events for A', string_agg(name || props::text, ' | ' order by id) from public.analytics_events
  where user_id = '77777777-0000-0000-0000-00000000000a' and name like 'pro_%';
delete from public.user_profile where user_id = '77777777-0000-0000-0000-00000000000c';
insert into r select 'profile deletion leaves anonymous churn row', count(*)::text from public.churn_feedback where source = 'system' and created_at > now() - interval '1 minute';

-- reports as a human admin
select set_config('request.jwt.claims', '{"sub":"33512c0e-3586-4582-8a35-e2cbabe15512","role":"authenticated"}', true);
set local role authenticated;
insert into r select 'report: product (activation)', (public.admin_product_analytics(30)->'activation')::text;
insert into r select 'report: product (adoption A in MAU?)', (public.admin_product_analytics(30)->'adoption'->>'monthly_active');
insert into r select 'report: invites', left(public.admin_invite_funnel(365)::text, 300);
insert into r select 'report: email', left(public.admin_email_engagement(30)::text, 300);
insert into r select 'report: parse', left(public.admin_parse_analytics(365)::text, 400);
insert into r select 'report: cohorts', left(public.admin_cohort_retention(4)::text, 300);
insert into r select 'report: churn', left(public.admin_churn(30)::text, 300);
reset role;

select step, result from r;
