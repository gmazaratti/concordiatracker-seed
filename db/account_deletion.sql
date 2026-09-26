-- Real account deletion, per-person schedule sharing, and enforced retention.
--
-- 1. ct_delete_account(user) removes every row that identifies or describes a
--    person, INCLUDING the rows whose foreign key is SET NULL (tickets, bug
--    reports, survey answers, invite trails, audit rows), which is where an
--    email or a name would otherwise survive the account. What stays is
--    anonymous by construction: a per-day deleted-accounts count, churn
--    answers without an id or free text, and aggregate analytics rows whose
--    user id is null. The caller (api/_delete-account.ts) deletes the storage
--    files this function lists and then the auth user, which cascades the rest.
-- 2. schedule_grants: "let THIS person see my schedule", instead of the old
--    all-friends switch being the only answer to one person's request.
-- 3. ct_prune_analytics(), scheduled daily, so the retention the policy states
--    is actually enforced.
--
-- Idempotent: safe to re-run.

-- ── Anonymous deletion count ─────────────────────────────────────────────
create table if not exists public.deleted_accounts_daily (
  day date not null,
  plan text not null default 'free',
  n int not null default 0,
  primary key (day, plan)
);
alter table public.deleted_accounts_daily enable row level security;
revoke all on public.deleted_accounts_daily from anon, authenticated;

-- Replaces the churn "system" row: a count per day and plan is all a deletion
-- should leave behind.
create or replace function public.ct_on_profile_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(old.is_internal, false) then
    insert into public.deleted_accounts_daily (day, plan, n)
    values (current_date, case when old.plan_status ~ '^[a-z_]{1,24}$' then old.plan_status else 'free' end, 1)
    on conflict (day, plan) do update set n = public.deleted_accounts_daily.n + 1;
  end if;
  return old;
end $$;

-- ── The deletion itself ──────────────────────────────────────────────────
create or replace function public.ct_delete_account(p_user uuid)
returns jsonb language plpgsql security definer set search_path = public, auth, storage as $$
declare
  v_emails text[];
  v_name text;
  v_handle text;
  v_requests uuid[];
  v_survey_files jsonb;
  v_files jsonb;
  out jsonb := '{}'::jsonb;
  c int;
begin
  if not exists (select 1 from auth.users where id = p_user) then
    raise exception 'No such account.' using errcode = 'P0002';
  end if;

  -- Every address this person is known by: the sign-in email and the profile copy.
  select array_remove(array_agg(distinct lower(e)), null) into v_emails from (
    select email e from auth.users where id = p_user
    union all select email from public.user_profile where user_id = p_user
  ) x;
  v_emails := coalesce(v_emails, '{}');
  select name, lower(handle) into v_name, v_handle from public.user_profile where user_id = p_user;
  select array_agg(distinct request_id) into v_requests from public.feature_request_comments where user_id = p_user;

  -- Files to remove from storage (the caller deletes them through the Storage
  -- API, since deleting the storage row leaves the file behind). A file a
  -- surviving CLUB still shows is the club's content, and is kept.
  select coalesce(jsonb_agg(jsonb_build_object('bucket', o.bucket_id, 'name', o.name)), '[]'::jsonb) into v_files
    from storage.objects o
   where (o.owner_id = p_user::text or o.name like p_user::text || '/%')
     and not exists (select 1 from public.organizations g
                      where coalesce(g.owner_id, '00000000-0000-0000-0000-000000000000'::uuid) <> p_user
                        and (g.logo like '%' || o.name or g.banner like '%' || o.name))
     and not exists (select 1 from public.org_posts op where not coalesce(op.deleted, false) and op.media::text like '%' || o.name || '%')
     and not exists (select 1 from public.org_stories s where s.image_url like '%' || o.name)
     and not exists (select 1 from public.events ev where ev.image like '%' || o.name);
  select coalesce(jsonb_agg(f), '[]'::jsonb) into v_survey_files
    from public.public_survey ps, jsonb_array_elements(case when jsonb_typeof(ps.outline_files) = 'array' then ps.outline_files else '[]'::jsonb end) f
   where lower(ps.email) = any (v_emails) or ps.redeemed_by = p_user;

  -- Rows that would otherwise survive with the person's email, name or words.
  delete from public.ticket_messages where author_id = p_user; get diagnostics c = row_count; out := out || jsonb_build_object('ticket_messages_authored', c);
  delete from public.tickets where user_id = p_user or lower(email) = any (v_emails); get diagnostics c = row_count; out := out || jsonb_build_object('tickets', c);
  delete from public.bug_reports where user_id = p_user or lower(user_email) = any (v_emails); get diagnostics c = row_count; out := out || jsonb_build_object('bug_reports', c);
  delete from public.data_reports where user_id = p_user; get diagnostics c = row_count; out := out || jsonb_build_object('data_reports', c);
  delete from public.access_requests where user_id = p_user or lower(email) = any (v_emails); get diagnostics c = row_count; out := out || jsonb_build_object('access_requests', c);
  delete from public.public_survey where lower(email) = any (v_emails) or redeemed_by = p_user; get diagnostics c = row_count; out := out || jsonb_build_object('public_survey', c);
  delete from public.survey_response where user_id = p_user; get diagnostics c = row_count; out := out || jsonb_build_object('survey_response', c);
  delete from public.org_invite_events where user_id = p_user or lower(email) = any (v_emails); get diagnostics c = row_count; out := out || jsonb_build_object('org_invite_events', c);
  delete from public.org_invites where coalesce(kind, 'link') in ('email', 'user')
     and (recipient_user = p_user or lower(recipient_email) = any (v_emails));
  get diagnostics c = row_count; out := out || jsonb_build_object('direct_invites', c);
  update public.org_invites set last_opened_email = null where lower(last_opened_email) = any (v_emails);
  update public.org_invites set recipient_email = null where lower(recipient_email) = any (v_emails);
  delete from public.org_members where user_id = p_user or invited_user = p_user or lower(email) = any (v_emails);
  get diagnostics c = row_count; out := out || jsonb_build_object('org_members', c);
  -- The club's activity log keeps what happened, not who did it.
  -- actor_email is NOT NULL, so it is blanked rather than nulled.
  update public.org_activity set actor_user = null, actor_email = '', actor_name = 'Deleted account'
   where actor_user = p_user or lower(actor_email) = any (v_emails);
  get diagnostics c = row_count; out := out || jsonb_build_object('org_activity_anonymised', c);
  delete from public.org_activity a where exists (select 1 from unnest(v_emails) e
    where coalesce(a.before::text, '') ilike '%' || e || '%' or coalesce(a.after::text, '') ilike '%' || e || '%');
  get diagnostics c = row_count; out := out || jsonb_build_object('org_activity_snapshots', c);
  delete from public.admin_audit_log where target_id = p_user or lower(target_email) = any (v_emails);
  get diagnostics c = row_count; out := out || jsonb_build_object('admin_audit_log', c);
  update public.admin_audit_log set actor_email = null where actor_id = p_user;
  delete from public.course_reviews where user_id = p_user; get diagnostics c = row_count; out := out || jsonb_build_object('course_reviews', c);
  delete from public.shared_blueprints where user_id = p_user; get diagnostics c = row_count; out := out || jsonb_build_object('shared_blueprints', c);
  delete from public.teacher_course_tas where user_id = p_user or lower(email) = any (v_emails);
  get diagnostics c = row_count; out := out || jsonb_build_object('teacher_course_tas', c);
  update public.announcements set author_name = null where author_id = p_user;
  -- Other people's notifications that name this person.
  delete from public.notifications n
   where (v_handle is not null and n.kind = 'follow' and n.link = '/@' || v_handle)
      or (v_name is not null and n.kind = 'request_comment' and n.actor_name = v_name
          and exists (select 1 from unnest(coalesce(v_requests, '{}')) r where n.link like '%' || r::text || '%'));
  get diagnostics c = row_count; out := out || jsonb_build_object('notifications_naming_them', c);
  delete from public.handle_aliases where v_handle is not null and lower(target) = v_handle;
  update public.organizations set email = null where lower(email) = any (v_emails);
  update public.organizations o set application = null
   where o.application is not null and exists (select 1 from unnest(v_emails) e where o.application::text ilike '%' || e || '%');
  delete from public.email_events where user_id = p_user; get diagnostics c = row_count; out := out || jsonb_build_object('email_events', c);
  delete from public.schedule_grants where owner = p_user or grantee = p_user;
  -- Kept: why they left, as structured answers only, with no id and no free text.
  update public.churn_feedback set user_id = null, detail = null where user_id = p_user;
  get diagnostics c = row_count; out := out || jsonb_build_object('churn_anonymised', c);

  return jsonb_build_object('deleted', out, 'files', v_files, 'survey_files', v_survey_files);
end $$;
revoke all on function public.ct_delete_account(uuid) from public, anon, authenticated;

-- ── Per-person schedule sharing ──────────────────────────────────────────
create table if not exists public.schedule_grants (
  owner uuid not null references auth.users (id) on delete cascade,
  grantee uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner, grantee),
  check (owner <> grantee)
);
alter table public.schedule_grants enable row level security;
drop policy if exists schedule_grants_read on public.schedule_grants;
create policy schedule_grants_read on public.schedule_grants for select to authenticated
  using (owner = auth.uid() or grantee = auth.uid());
revoke insert, update, delete on public.schedule_grants from anon, authenticated;

create or replace function public.grant_schedule(p_grantee uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if p_grantee is null or p_grantee = auth.uid() then return false; end if;
  if public.ct_blocked_between(auth.uid(), p_grantee) then return false; end if;
  insert into public.schedule_grants (owner, grantee) values (auth.uid(), p_grantee) on conflict do nothing;
  return true;
end $$;
create or replace function public.revoke_schedule(p_grantee uuid)
returns boolean language sql security definer set search_path = public as $$
  delete from public.schedule_grants where owner = auth.uid() and grantee = p_grantee returning true
$$;
grant execute on function public.grant_schedule(uuid) to authenticated;
grant execute on function public.revoke_schedule(uuid) to authenticated;

-- A schedule is visible to friends when the owner shares with friends, OR to
-- one person the owner granted it to. Blocking ends both.
create or replace function public.ct_can_see_schedule_of(p_owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and p_owner is not null
     and not public.ct_blocked_between(auth.uid(), p_owner)
     and (
       exists (select 1 from public.user_profile p where p.user_id = p_owner
                and p.schedule_visibility = 'friends' and public.are_friends(auth.uid(), p_owner))
       or exists (select 1 from public.schedule_grants g where g.owner = p_owner and g.grantee = auth.uid())
     )
$$;

create or replace function public.can_see_schedule(p_handle text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select public.ct_can_see_schedule_of(p.user_id) from public.user_profile p
                    where lower(p.handle) = lower(trim(p_handle)) limit 1), false)
$$;

create or replace function public.get_friend_schedule(p_handle text)
returns table (code text, title text, color text, term text, meeting_times text, location text)
language sql stable security definer set search_path = public as $$
  select c.code, c.name, c.color, c.term, c.time, c.location
  from public.courses c
  join public.user_profile p on p.user_id = c.user_id
  where lower(p.handle) = lower(trim(p_handle))
    and public.ct_can_see_schedule_of(p.user_id)
    and coalesce(c.archived, false) = false
  order by c.code;
$$;

-- ── Retention, enforced ──────────────────────────────────────────────────
create or replace function public.ct_prune_analytics()
returns jsonb language plpgsql security definer set search_path = public as $$
declare a int; b int; c int; d int; e int;
begin
  -- Page views: pings 7 days, views 180 days (the policy's numbers).
  delete from public.site_events
   where (kind = 'ping' and created_at < now() - interval '7 days') or created_at < now() - interval '180 days';
  get diagnostics a = row_count;
  -- Product events: 13 months, so a one-year report still has a full year.
  delete from public.analytics_events where created_at < now() - interval '395 days'; get diagnostics b = row_count;
  -- Email events: 180 days.
  delete from public.email_events where occurred_at < now() - interval '180 days'; get diagnostics c = row_count;
  -- Churn answers (already anonymous once the account is gone): 2 years.
  delete from public.churn_feedback where created_at < now() - interval '730 days'; get diagnostics d = row_count;
  -- Device history: 90 days, as stated, whether or not its owner opens the app.
  delete from public.user_device_history where last_seen < now() - interval '90 days'; get diagnostics e = row_count;
  return jsonb_build_object('site_events', a, 'analytics_events', b, 'email_events', c, 'churn_feedback', d, 'device_history', e);
end $$;
revoke all on function public.ct_prune_analytics() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'ct-prune-analytics';
    perform cron.schedule('ct-prune-analytics', '40 4 * * *', 'select public.ct_prune_analytics()');
  else
    raise notice 'pg_cron is not installed: schedule public.ct_prune_analytics() daily by hand.';
  end if;
end $$;

-- admin_churn reads deletions from the counter now.
create or replace function public.admin_churn(p_days int default 90)
returns jsonb language sql stable security definer set search_path = public as $$
  with c as (
    select * from public.churn_feedback
     where created_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 90), 365)))
  ),
  ev as (
    select e.name from public.analytics_events e join public.ct_counted_users() u using (user_id)
     where e.created_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 90), 365)))
  )
  select case when not public.is_admin() then null else jsonb_build_object(
    'pro_cancel_scheduled', (select count(*) from ev where name = 'pro_cancel_scheduled'),
    'pro_cancelled', (select count(*) from ev where name = 'pro_cancelled'),
    'account_delete_requested', (select count(*) from ev where name = 'account_delete_requested'),
    'accounts_deleted', (select coalesce(sum(n), 0) from public.deleted_accounts_daily
                          where day > current_date - greatest(1, least(coalesce(p_days, 90), 365))),
    'reasons', coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'reason', coalesce(reason, 'none'), 'count', n)
        order by n desc) from (select kind, reason, count(*) n from c where source = 'survey' group by 1, 2) x), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'reason', reason,
        'detail', detail, 'plan', plan, 'at', created_at) order by created_at desc)
        from (select * from c where source = 'survey' and detail is not null order by created_at desc limit 20) x), '[]'::jsonb)
  ) end
$$;
