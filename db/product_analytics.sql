-- Product analytics: attribution, activation, feature adoption, invites,
-- email engagement, parse health, cohort retention, churn.
--
-- WHAT THIS FILE IS FOR. Eight questions the product cannot answer today,
-- each of which can only be answered from data captured going forward:
-- where a signup came from, whether it reached the point where the product
-- is useful, which features are used, whether club invites turn into active
-- clubs, whether email reaches people, whether parsing works, who comes back,
-- and why people leave.
--
-- FOUR RULES, enforced here rather than in callers:
--
--   1. ONE WRITE PATH. Every event goes through ct_track(), which is the only
--      place that checks the opt-out. A trigger, an RPC and a webhook cannot
--      forget it because none of them insert into analytics_events directly.
--   2. NO CONTENT. Event names are a fixed vocabulary and properties are a
--      per-event allowlist of short values. No message text, no file contents,
--      no URLs, no email addresses, no tokens, no IPs. analytics_events has no
--      column that could hold one.
--   3. OPT-OUT IS REAL. user_profile.analytics_opt_out stops new events,
--      detaches the account from first-party page views (a trigger on
--      site_events, so it holds whatever the browser sends), and turning it on
--      deletes the account's existing analytics rows.
--   4. NO CLIENT READS. analytics_events, email_events and churn_feedback have
--      RLS on and no select policy. Reports are admin-gated functions that
--      exclude internal accounts and opted-out users.
--
-- Anonymous visitor analytics (site_events for signed-out visitors) are NOT
-- changed by this file.
--
-- Idempotent: safe to re-run.

-- ── Columns on the profile ───────────────────────────────────────────────
alter table public.user_profile
  add column if not exists analytics_opt_out boolean not null default false,
  add column if not exists signup_channel text,
  add column if not exists signup_utm_source text,
  add column if not exists signup_utm_medium text,
  add column if not exists signup_utm_campaign text,
  add column if not exists signup_referrer_host text,
  add column if not exists signup_landing_path text,
  add column if not exists first_seen_at timestamptz;

alter table public.user_profile drop constraint if exists user_profile_signup_attr_ck;
alter table public.user_profile add constraint user_profile_signup_attr_ck check (
  (signup_channel is null or signup_channel ~ '^[a-z_]{1,32}$')
  and (signup_utm_source is null or length(signup_utm_source) <= 40)
  and (signup_utm_medium is null or length(signup_utm_medium) <= 40)
  and (signup_utm_campaign is null or length(signup_utm_campaign) <= 40)
  and (signup_referrer_host is null or signup_referrer_host ~ '^[a-z0-9.\-]{1,100}$')
  and (signup_landing_path is null or (length(signup_landing_path) <= 120 and signup_landing_path like '/%'))
) not valid;

-- ── The event store ──────────────────────────────────────────────────────
create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  -- SET NULL, not cascade: a deleted account's history stays as an anonymous
  -- count, which is what a funnel or a retention curve needs and all it needs.
  user_id uuid references auth.users (id) on delete set null,
  name text not null check (name ~ '^[a-z_]{1,48}$'),
  props jsonb not null default '{}'::jsonb
    check (jsonb_typeof(props) = 'object' and pg_column_size(props) < 1000),
  created_at timestamptz not null default now()
);
create index if not exists analytics_events_name_idx on public.analytics_events (name, created_at);
create index if not exists analytics_events_user_idx on public.analytics_events (user_id, name);
alter table public.analytics_events enable row level security;
revoke all on public.analytics_events from anon, authenticated;

-- The vocabulary. Anything else is refused, so a typo in a caller fails
-- loudly instead of inventing an event nobody reports on.
create or replace function public.ct_event_names()
returns text[] language sql immutable as $$
  select array[
    'signup_completed', 'first_course_added', 'first_assignment_completed',
    'feature_used',
    'pro_cancel_scheduled', 'pro_cancelled', 'account_delete_requested'
  ]
$$;

create or replace function public.ct_feature_names()
returns text[] language sql immutable as $$
  select array[
    'quick_links', 'blueprint_preview', 'blueprint_import', 'syllabus_upload',
    'club_follow', 'notifications_open', 'calendar_sync', 'moodle_connect'
  ]
$$;

create or replace function public.ct_analytics_ok(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_user is not null and exists (
    select 1 from public.user_profile p
     where p.user_id = p_user and not coalesce(p.analytics_opt_out, false))
$$;

-- Keep only the properties this event is allowed to carry, each a short
-- scalar. Everything else is dropped rather than refused, so adding a field
-- in a caller never breaks the thing being measured.
create or replace function public.ct_clean_props(p_name text, p_props jsonb)
returns jsonb language plpgsql immutable as $$
declare
  allowed text[] := case p_name
    when 'first_course_added' then array['days_since_signup', 'source']
    when 'signup_completed' then array['channel']
    when 'first_assignment_completed' then array['days_since_signup']
    when 'feature_used' then array['feature']
    when 'pro_cancel_scheduled' then array['plan']
    when 'pro_cancelled' then array['plan']
    else array[]::text[] end;
  out jsonb := '{}'::jsonb;
  k text; v jsonb;
begin
  for k, v in select * from jsonb_each(coalesce(p_props, '{}'::jsonb)) loop
    continue when not (k = any (allowed));
    if jsonb_typeof(v) = 'number' then
      out := out || jsonb_build_object(k, v);
    elsif jsonb_typeof(v) = 'string' and (v #>> '{}') ~ '^[a-z0-9_\-]{1,32}$' then
      out := out || jsonb_build_object(k, v);
    end if;
  end loop;
  return out;
end $$;

-- THE write path. Internal only.
create or replace function public.ct_track(p_user uuid, p_name text, p_props jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (p_name = any (public.ct_event_names())) then
    raise exception 'Unknown analytics event %', p_name using errcode = '22023';
  end if;
  if not public.ct_analytics_ok(p_user) then return; end if;
  insert into public.analytics_events (user_id, name, props)
  values (p_user, p_name, public.ct_clean_props(p_name, p_props));
end $$;

create or replace function public.ct_track_once(p_user uuid, p_name text, p_props jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null then return; end if;
  -- Serialise the check and the insert per person and event: two concurrent
  -- calls (two tabs, a double mount) would otherwise both see "not yet" and
  -- both insert. Released at the end of the transaction.
  perform pg_advisory_xact_lock(hashtextextended(p_user::text || ':' || p_name, 0));
  if exists (select 1 from public.analytics_events where user_id = p_user and name = p_name) then return; end if;
  perform public.ct_track(p_user, p_name, p_props);
end $$;

-- One "used it" per person per feature per day: adoption is about how many
-- people, not how many clicks, and it keeps a busy feature from filling the table.
create or replace function public.ct_track_feature(p_user uuid, p_feature text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null or not (p_feature = any (public.ct_feature_names())) then return; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text || ':feature:' || p_feature, 0));
  if exists (
    select 1 from public.analytics_events
     where user_id = p_user and name = 'feature_used' and props->>'feature' = p_feature
       and created_at >= date_trunc('day', now())) then return; end if;
  perform public.ct_track(p_user, 'feature_used', jsonb_build_object('feature', p_feature));
end $$;

revoke all on function public.ct_track(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.ct_track_once(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.ct_track_feature(uuid, text) from public, anon, authenticated;

-- The one client door: features only visible in the browser (opening a panel,
-- previewing an outline). Everything else is recorded where it happens.
create or replace function public.track_feature(p_feature text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if not (p_feature = any (array['quick_links', 'blueprint_preview', 'blueprint_import', 'notifications_open'])) then
    return;
  end if;
  perform public.ct_track_feature(auth.uid(), p_feature);
end $$;
revoke all on function public.track_feature(text) from public, anon;
grant execute on function public.track_feature(text) to authenticated;

-- ── Opt-out ──────────────────────────────────────────────────────────────
create or replace function public.set_analytics_opt_out(p_on boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  update public.user_profile set analytics_opt_out = coalesce(p_on, false) where user_id = uid;
  if coalesce(p_on, false) then
    -- Withdrawing consent covers what was already collected, not only what comes next.
    delete from public.analytics_events where user_id = uid;
    update public.site_events set user_id = null where user_id = uid;
    update public.user_profile
       set signup_channel = null, signup_utm_source = null, signup_utm_medium = null,
           signup_utm_campaign = null, signup_referrer_host = null, signup_landing_path = null,
           first_seen_at = null
     where user_id = uid;
    if to_regclass('public.email_events') is not null then
      execute 'update public.email_events set user_id = null where user_id = $1' using uid;
    end if;
  end if;
  return coalesce(p_on, false);
end $$;
grant execute on function public.set_analytics_opt_out(boolean) to authenticated;

-- Page views keep counting an opted-out person as an anonymous visitor, the
-- way they count anyone signed out. Enforced here so it holds for any client.
create or replace function public.ct_site_events_opt_out()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is not null and exists (
    select 1 from public.user_profile p where p.user_id = new.user_id and p.analytics_opt_out) then
    new.user_id := null;
  end if;
  return new;
end $$;
drop trigger if exists ct_site_events_opt_out on public.site_events;
create trigger ct_site_events_opt_out before insert on public.site_events
  for each row execute function public.ct_site_events_opt_out();

-- ── Activation ───────────────────────────────────────────────────────────
create or replace function public.ct_days_since_signup(p_user uuid)
returns int language sql stable security definer set search_path = public as $$
  select floor(extract(epoch from now() - p.created_at) / 86400)::int
    from public.user_profile p where p.user_id = p_user
$$;

create or replace function public.ct_on_profile_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.onboarding_completed and not coalesce(old.onboarding_completed, false) then
    perform public.ct_track_once(new.user_id, 'signup_completed',
      jsonb_build_object('channel', coalesce(new.signup_channel, 'unknown')));
  end if;
  if new.cancel_at_period_end and not coalesce(old.cancel_at_period_end, false) then
    perform public.ct_track(new.user_id, 'pro_cancel_scheduled',
      jsonb_build_object('plan', coalesce(new.plan_status, 'unknown')));
  end if;
  if new.subscription_status = 'canceled'
     and coalesce(old.subscription_status, '') in ('active', 'trialing', 'past_due') then
    perform public.ct_track(new.user_id, 'pro_cancelled',
      jsonb_build_object('plan', coalesce(old.plan_status, 'unknown')));
  end if;
  return new;
end $$;
drop trigger if exists ct_on_profile_change on public.user_profile;
create trigger ct_on_profile_change
  after update of onboarding_completed, cancel_at_period_end, subscription_status on public.user_profile
  for each row execute function public.ct_on_profile_change();

create or replace function public.ct_on_course_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- A finished course added to the record is history, not starting to use the product.
  if not coalesce(new.archived, false) then
    perform public.ct_track_once(new.user_id, 'first_course_added', jsonb_build_object(
      'days_since_signup', public.ct_days_since_signup(new.user_id),
      'source', coalesce(nullif(lower(new.source), ''), 'manual')));
  end if;
  return new;
end $$;
drop trigger if exists ct_on_course_insert on public.courses;
create trigger ct_on_course_insert after insert on public.courses
  for each row execute function public.ct_on_course_insert();

create or replace function public.ct_on_assignment_done()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (coalesce(new.done, false) and not coalesce(old.done, false))
     or (new.status = 'done' and coalesce(old.status, '') <> 'done') then
    perform public.ct_track_once(new.user_id, 'first_assignment_completed',
      jsonb_build_object('days_since_signup', public.ct_days_since_signup(new.user_id)));
  end if;
  return new;
end $$;
drop trigger if exists ct_on_assignment_done on public.assignments;
create trigger ct_on_assignment_done after update of done, status on public.assignments
  for each row execute function public.ct_on_assignment_done();

-- ── Feature adoption recorded where it happens ───────────────────────────
create or replace function public.ct_feature_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.ct_track_feature(new.user_id, tg_argv[0]);
  return new;
end $$;

drop trigger if exists ct_feature_club_follow on public.org_follows;
create trigger ct_feature_club_follow after insert on public.org_follows
  for each row execute function public.ct_feature_trigger('club_follow');
drop trigger if exists ct_feature_calendar_sync on public.calendar_feeds;
create trigger ct_feature_calendar_sync after insert on public.calendar_feeds
  for each row execute function public.ct_feature_trigger('calendar_sync');
drop trigger if exists ct_feature_moodle on public.moodle_connections;
create trigger ct_feature_moodle after insert on public.moodle_connections
  for each row execute function public.ct_feature_trigger('moodle_connect');
drop trigger if exists ct_feature_syllabus on public.parse_events;
create trigger ct_feature_syllabus after insert on public.parse_events
  for each row execute function public.ct_feature_trigger('syllabus_upload');

-- ── Email engagement (Resend webhooks) ───────────────────────────────────
create table if not exists public.email_events (
  id bigint generated always as identity primary key,
  -- The webhook delivery id: Resend retries, and a retry must not count twice.
  webhook_id text not null unique check (length(webhook_id) <= 100),
  email_id text not null check (length(email_id) <= 100),
  template text not null check (template ~ '^[a-z0-9_]{1,40}$'),
  event text not null check (event in
    ('sent', 'delivered', 'delivery_delayed', 'opened', 'clicked', 'bounced', 'complained', 'failed')),
  -- Set only when the send carried the account's id and the account has not
  -- opted out. No address, no subject, no link, no IP is ever stored.
  user_id uuid references auth.users (id) on delete set null,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists email_events_template_idx on public.email_events (template, event, occurred_at);
alter table public.email_events enable row level security;
revoke all on public.email_events from anon, authenticated;

create or replace function public.record_email_event(
  p_webhook_id text, p_email_id text, p_template text, p_event text, p_user uuid, p_at timestamptz)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.email_events (webhook_id, email_id, template, event, user_id, occurred_at)
  values (p_webhook_id, p_email_id,
          case when p_template ~ '^[a-z0-9_]{1,40}$' then p_template else 'other' end,
          p_event,
          case when public.ct_analytics_ok(p_user) then p_user end,
          coalesce(p_at, now()))
  on conflict (webhook_id) do nothing;
  get diagnostics n = row_count;
  return n > 0;
end $$;
revoke all on function public.record_email_event(text, text, text, text, uuid, timestamptz) from public, anon, authenticated;

-- ── Churn ────────────────────────────────────────────────────────────────
create table if not exists public.churn_feedback (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('pro_cancel', 'account_delete')),
  -- 'survey' = the person answered; 'system' = recorded when it happened, no answer.
  source text not null default 'survey' check (source in ('survey', 'system')),
  reason text check (reason in (
    'too_expensive', 'not_using', 'missing_feature', 'found_alternative',
    'graduating', 'technical_issues', 'privacy', 'other')),
  detail text check (detail is null or length(detail) <= 500),
  plan text check (plan is null or plan ~ '^[a-z_]{1,24}$'),
  created_at timestamptz not null default now()
);
create index if not exists churn_feedback_kind_idx on public.churn_feedback (kind, created_at);
alter table public.churn_feedback enable row level security;
revoke all on public.churn_feedback from anon, authenticated;

create or replace function public.submit_churn_feedback(p_kind text, p_reason text, p_detail text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v_plan text;
begin
  if uid is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if p_kind not in ('pro_cancel', 'account_delete') then
    raise exception 'Unknown kind.' using errcode = '22023';
  end if;
  -- One answer per person per kind per day: a double-click is not two opinions.
  if exists (select 1 from public.churn_feedback
              where user_id = uid and kind = p_kind and created_at > now() - interval '1 day') then
    return false;
  end if;
  select plan_status into v_plan from public.user_profile where user_id = uid;
  insert into public.churn_feedback (user_id, kind, source, reason, detail, plan)
  values (
    -- Someone who opted out can still tell us why; it is stored without their id.
    case when public.ct_analytics_ok(uid) then uid end,
    p_kind, 'survey',
    case when p_reason in ('too_expensive', 'not_using', 'missing_feature', 'found_alternative',
                           'graduating', 'technical_issues', 'privacy', 'other') then p_reason end,
    nullif(left(btrim(coalesce(p_detail, '')), 500), ''),
    case when v_plan ~ '^[a-z_]{1,24}$' then v_plan end);
  if p_kind = 'account_delete' then
    perform public.ct_track(uid, 'account_delete_requested', '{}'::jsonb);
  end if;
  return true;
end $$;
grant execute on function public.submit_churn_feedback(text, text, text) to authenticated;

-- A deleted account leaves one anonymous row: that it happened, and on what plan.
create or replace function public.ct_on_profile_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(old.is_internal, false) then
    insert into public.churn_feedback (user_id, kind, source, plan)
    values (null, 'account_delete', 'system',
            case when old.plan_status ~ '^[a-z_]{1,24}$' then old.plan_status end);
  end if;
  return old;
end $$;
drop trigger if exists ct_on_profile_delete on public.user_profile;
create trigger ct_on_profile_delete before delete on public.user_profile
  for each row execute function public.ct_on_profile_delete();

-- ── Reports (admin only; internal and opted-out accounts excluded) ───────
create or replace function public.ct_counted_users()
returns table (user_id uuid, created_at timestamptz, signup_channel text)
language sql stable security definer set search_path = public as $$
  select p.user_id, p.created_at, coalesce(p.signup_channel, 'unknown')
    from public.user_profile p
   where not coalesce(p.is_internal, false) and not coalesce(p.analytics_opt_out, false)
$$;
revoke all on function public.ct_counted_users() from public, anon, authenticated;

create or replace function public.admin_product_analytics(p_days int default 90)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  d int := greatest(1, least(coalesce(p_days, 90), 365));
  since timestamptz := now() - make_interval(days => d);
  tracked_since timestamptz;
  r jsonb;
begin
  if not public.is_admin() then raise exception 'Not authorized.' using errcode = '42501'; end if;
  select min(created_at) into tracked_since from public.analytics_events;

  with users as (select * from public.ct_counted_users()),
  cohort as (select * from users where created_at >= greatest(since, coalesce(tracked_since, now()))),
  ev as (select e.* from public.analytics_events e join users u using (user_id)),
  firsts as (
    select c.user_id, c.created_at, c.signup_channel,
      (select min(e.created_at) from ev e where e.user_id = c.user_id and e.name = 'signup_completed') onboarded,
      (select min(e.created_at) from ev e where e.user_id = c.user_id and e.name = 'first_course_added') course,
      (select min(e.created_at) from ev e where e.user_id = c.user_id and e.name = 'first_assignment_completed') done
    from cohort c
  ),
  active_30 as (
    select distinct s.user_id from public.site_events s join users u using (user_id)
     where s.created_at > now() - interval '30 days'
    union
    select distinct e.user_id from ev e where e.created_at > now() - interval '30 days'
  )
  select jsonb_build_object(
    'days', d,
    'tracking_since', tracked_since,
    'activation', jsonb_build_object(
      'signups', (select count(*) from firsts),
      'signup_completed', (select count(*) from firsts where onboarded is not null),
      'first_course_added', (select count(*) from firsts where course is not null),
      'first_assignment_completed', (select count(*) from firsts where done is not null),
      'aha_course_within_7d', (select count(*) from firsts where course is not null and course <= created_at + interval '7 days'),
      'median_hours_to_first_course', (select round((percentile_cont(0.5) within group (
          order by extract(epoch from course - created_at) / 3600))::numeric, 1) from firsts where course is not null)
    ),
    'channels', coalesce((select jsonb_agg(x order by x->>'signups' desc) from (
        select jsonb_build_object('channel', signup_channel, 'signups', count(*),
               'aha', count(*) filter (where course is not null and course <= created_at + interval '7 days')) x
          from firsts group by signup_channel) q), '[]'::jsonb),
    'adoption', jsonb_build_object(
      'monthly_active', (select count(*) from active_30),
      'features', coalesce((select jsonb_agg(jsonb_build_object('feature', f, 'users', (
          select count(distinct e.user_id) from ev e
           where e.name = 'feature_used' and e.props->>'feature' = f
             and e.created_at > now() - interval '30 days'
             and e.user_id in (select user_id from active_30)))
        order by f) from unnest(public.ct_feature_names()) f), '[]'::jsonb)
    )
  ) into r;
  return r;
end $$;
grant execute on function public.admin_product_analytics(int) to authenticated;

create or replace function public.admin_invite_funnel(p_days int default 90)
returns jsonb language sql stable security definer set search_path = public as $$
  with inv as (
    select i.*, o.setup_completed_at,
      (i.opened_count > 0 or exists (select 1 from public.org_invite_events x
         where x.invite_id = i.id and x.kind = 'open')) as opened,
      (i.claimed_at is not null) as claimed,
      (i.claimed_at is not null and o.setup_completed_at is not null and (
         exists (select 1 from public.org_posts p where p.org_id = i.org_id
                  and not coalesce(p.is_draft, false) and not coalesce(p.deleted, false)
                  and p.created_at >= i.claimed_at)
         or exists (select 1 from public.events e where e.org_id = i.org_id
                  and not coalesce(e.is_draft, false) and e.created_at >= i.claimed_at))) as active
    from public.org_invites i
    left join public.organizations o on o.id = i.org_id
    where i.created_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 90), 365)))
  )
  select case when not public.is_admin() then null else jsonb_build_object(
    'definition', 'active = claimed, setup finished, and at least one published post or event after the claim',
    'modes', coalesce((select jsonb_agg(x order by x->>'mode') from (
        select jsonb_build_object(
          'mode', mode, 'sent', count(*), 'opened', count(*) filter (where opened),
          'claimed', count(*) filter (where claimed), 'org_active', count(*) filter (where active)) x
        from inv group by mode) q), '[]'::jsonb)
  ) end
$$;
grant execute on function public.admin_invite_funnel(int) to authenticated;

create or replace function public.admin_email_engagement(p_days int default 30)
returns jsonb language sql stable security definer set search_path = public as $$
  with e as (
    select * from public.email_events
     where occurred_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)))
  )
  select case when not public.is_admin() then null else jsonb_build_object(
    'note', 'Opened and clicked are only recorded if tracking is on for the domain in Resend. '
            || 'Apple Mail Privacy Protection preloads images, so opens overstate real reads.',
    'templates', coalesce((select jsonb_agg(x order by x->>'template') from (
        select jsonb_build_object(
          'template', template,
          'sent', count(distinct email_id) filter (where event = 'sent'),
          'delivered', count(distinct email_id) filter (where event = 'delivered'),
          'opened', count(distinct email_id) filter (where event = 'opened'),
          'clicked', count(distinct email_id) filter (where event = 'clicked'),
          'bounced', count(distinct email_id) filter (where event = 'bounced'),
          'complained', count(distinct email_id) filter (where event = 'complained')) x
        from e group by template) q), '[]'::jsonb)
  ) end
$$;
grant execute on function public.admin_email_engagement(int) to authenticated;

-- The reason a parse failed, as a category. The raw error text stays in
-- parse_events for the Parses tab; only the category leaves it.
create or replace function public.ct_parse_reason(p_error text)
returns text language sql immutable as $$
  select case
    -- A failure with no reason written down (a killed function leaves none) is
    -- its own category, not a missing row in the report.
    when p_error is null then 'unrecorded'
    when p_error ~* 'timeout' then 'timeout'
    when p_error ~* 'currently|overloaded|unavailable|high demand|503|429' then 'model_unavailable'
    when p_error ~* 'rate|cooldown|limit' then 'rate_limited'
    when p_error ~* 'not a pdf|magic|file type|pages|too large|size' then 'bad_file'
    when p_error ~* 'unreadable|no text|could not read|scan' then 'unreadable'
    when p_error ~* 'no assess|zero|0 items|nothing' then 'no_items'
    when p_error ~* 'gemini|model|upstream' then 'model_error'
    else 'other' end
$$;

create or replace function public.admin_parse_analytics(p_days int default 90)
returns jsonb language sql stable security definer set search_path = public as $$
  with p as (
    select e.*,
      coalesce(lower(substring(e.file_name from '\.([A-Za-z0-9]{1,6})$')), 'unknown') file_type,
      coalesce(nullif(split_part(e.path, ':', 1), ''), 'unknown') read_path
    from public.parse_events e
    join public.ct_counted_users() u using (user_id)
    -- A refunded failure still failed (the refund only excuses the cooldown),
    -- so it counts; a parse still running has no outcome yet and does not.
    where e.created_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 90), 365)))
      and e.success is not null
  )
  select case when not public.is_admin() then null else jsonb_build_object(
    'note', 'Known outcomes only. Contains no file contents; reasons are categories.',
    'total', (select count(*) from p),
    'succeeded', (select count(*) from p where success),
    'by_file_type', coalesce((select jsonb_agg(jsonb_build_object('file_type', file_type,
        'total', n, 'succeeded', ok) order by n desc) from (
        select file_type, count(*) n, count(*) filter (where success) ok from p group by 1) x), '[]'::jsonb),
    'by_read_path', coalesce((select jsonb_agg(jsonb_build_object('read_path', read_path,
        'total', n, 'succeeded', ok) order by n desc) from (
        select read_path, count(*) n, count(*) filter (where success) ok from p group by 1) x), '[]'::jsonb),
    'failure_reasons', coalesce((select jsonb_agg(jsonb_build_object('reason', reason, 'count', n)
        order by n desc) from (
        select public.ct_parse_reason(error) reason, count(*) n from p where not success group by 1) x), '[]'::jsonb)
  ) end
$$;
grant execute on function public.admin_parse_analytics(int) to authenticated;

create or replace function public.admin_cohort_retention(p_weeks int default 8)
returns jsonb language sql stable security definer set search_path = public as $$
  with w as (select greatest(1, least(coalesce(p_weeks, 8), 26)) n),
  users as (select * from public.ct_counted_users()),
  cohorts as (
    select user_id, date_trunc('week', created_at) wk from users
     where created_at >= date_trunc('week', now()) - make_interval(weeks => (select n from w) - 1)
  ),
  activity as (
    select s.user_id, date_trunc('week', s.created_at) wk from public.site_events s
     where s.user_id in (select user_id from cohorts)
    union
    select e.user_id, date_trunc('week', e.created_at) from public.analytics_events e
     where e.user_id in (select user_id from cohorts)
  )
  select case when not public.is_admin() then null else jsonb_build_object(
    'note', 'Active = at least one signed-in page view or product event that week.',
    'cohorts', coalesce((select jsonb_agg(jsonb_build_object(
        'week', c.wk::date,
        'size', (select count(*) from cohorts x where x.wk = c.wk),
        'active', (select jsonb_agg((
            select count(distinct a.user_id) from activity a join cohorts x using (user_id)
             where x.wk = c.wk and a.wk = c.wk + make_interval(weeks => k))
          order by k)
          from generate_series(0, (extract(epoch from date_trunc('week', now()) - c.wk) / 604800)::int) k))
      order by c.wk) from (select distinct wk from cohorts) c), '[]'::jsonb)
  ) end
$$;
grant execute on function public.admin_cohort_retention(int) to authenticated;

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
    'accounts_deleted', (select count(*) from c where kind = 'account_delete' and source = 'system'),
    'reasons', coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'reason', coalesce(reason, 'none'), 'count', n)
        order by n desc) from (select kind, reason, count(*) n from c where source = 'survey' group by 1, 2) x), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'reason', reason,
        'detail', detail, 'plan', plan, 'at', created_at) order by created_at desc)
        from (select * from c where source = 'survey' and detail is not null order by created_at desc limit 20) x), '[]'::jsonb)
  ) end
$$;
grant execute on function public.admin_churn(int) to authenticated;
