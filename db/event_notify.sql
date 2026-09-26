-- "Notify followers" on an event, for real. db/event_notify.sql. Idempotent.
--
-- It used to be a stub: a local flag, nothing sent, and a Revert that allowed
-- "sending again". Now:
--   - WHO: the club's owner or an admin-role member, or a human platform
--     admin. Checked here, by the caller's id, not by the screen.
--   - WHAT: one in-app notification per follower, through ct_notify, to the
--     same audience club posts use (ct_post_audience): followers, minus the
--     club's own team, honouring each follower's notify_org_posts setting.
--   - ONCE: event_notifications has one row per event, claimed with
--     INSERT ... ON CONFLICT DO NOTHING before anything is sent, so a
--     double-click, a retry or two tabs cannot send twice.
--   - PRIVATE: only a count comes back, never who the followers are.

create table if not exists public.event_notifications (
  event_id uuid primary key references public.events (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  sent_by uuid references auth.users (id) on delete set null,
  sent_at timestamptz not null default now(),
  recipients int not null default 0
);
alter table public.event_notifications enable row level security;
revoke all on public.event_notifications from anon, authenticated;

create or replace function public.ct_can_notify_org(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.ct_admin_write()
      or exists (select 1 from public.organizations o where o.id = p_org and o.owner_id = auth.uid())
      or exists (select 1 from public.org_members m
                 where m.org_id = p_org and m.user_id = auth.uid()
                   and coalesce(m.status, 'active') = 'active' and m.role in ('owner', 'admin'))
$$;

-- Has this event been announced? For the button's state.
create or replace function public.event_notify_status(p_event uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_org uuid; r record;
begin
  select org_id into v_org from public.events where id = p_event;
  if v_org is null or not public.ct_can_notify_org(v_org) then return null; end if;
  select sent_at, recipients into r from public.event_notifications where event_id = p_event;
  if r.sent_at is null then return jsonb_build_object('status', 'not_sent'); end if;
  return jsonb_build_object('status', 'sent', 'sent_at', r.sent_at, 'recipients', r.recipients);
end $$;

create or replace function public.notify_event_followers(p_event uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  ev record;
  v_org record;
  audience uuid[];
  v_count int;
  claimed uuid;
  prior record;
begin
  select id, org_id, title, start, coalesce(is_draft, false) as is_draft into ev
  from public.events where id = p_event;
  if ev.id is null then raise exception 'That event does not exist.' using errcode = 'P0002'; end if;
  if not public.ct_can_notify_org(ev.org_id) then
    raise exception 'Only the club''s owner or an admin can notify followers.' using errcode = '42501';
  end if;
  if ev.is_draft then raise exception 'Publish the event before notifying followers.' using errcode = '22023'; end if;

  select name, coalesce(status, 'pending') = 'approved' as approved into v_org
  from public.organizations where id = ev.org_id;
  if not v_org.approved then
    raise exception 'Followers can be notified once the club is approved.' using errcode = '22023';
  end if;

  select sent_at, recipients into prior from public.event_notifications where event_id = p_event;
  if prior.sent_at is not null then
    return jsonb_build_object('status', 'already_sent', 'sent_at', prior.sent_at, 'recipients', prior.recipients);
  end if;

  select array_agg(u) into audience from public.ct_post_audience(ev.org_id, auth.uid()) u;
  v_count := coalesce(array_length(audience, 1), 0);
  if v_count = 0 then
    -- Nothing is recorded, so the button still works once followers arrive.
    return jsonb_build_object('status', 'no_audience', 'recipients', 0);
  end if;

  -- The claim. Only the request that inserts this row sends anything.
  insert into public.event_notifications (event_id, org_id, sent_by, recipients)
  values (p_event, ev.org_id, auth.uid(), v_count)
  on conflict (event_id) do nothing
  returning event_id into claimed;
  if claimed is null then
    select sent_at, recipients into prior from public.event_notifications where event_id = p_event;
    return jsonb_build_object('status', 'already_sent', 'sent_at', prior.sent_at, 'recipients', prior.recipients);
  end if;

  perform public.ct_notify(
    audience, 'org_event',
    coalesce(v_org.name, 'A club you follow') || ' posted an event',
    left(ev.title, 120) || coalesce(' · ' || to_char(ev.start at time zone 'America/Montreal', 'Dy Mon FMDD, FMHH12:MI AM'), ''),
    '/app/community?event=' || p_event,
    p_event, v_org.name);

  return jsonb_build_object('status', 'sent', 'sent_at', now(), 'recipients', v_count);
end $$;

grant execute on function public.event_notify_status(uuid) to authenticated;
grant execute on function public.notify_event_followers(uuid) to authenticated;
