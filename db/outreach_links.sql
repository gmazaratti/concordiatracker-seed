-- Outreach links: what was sent, whether it was opened, whether it converted.
--
-- WHY A REGISTRY AND NOT JUST ANALYTICS. `site_events` already records every
-- view with a per-browser `visitor_id` and the `utm_campaign` off the URL, so
-- a link that gets CLICKED is already measurable. The thing it cannot tell
-- you is the denominator: a link nobody opened leaves no rows at all, so
-- "sent and ignored" and "never sent" look identical, and those are the two
-- answers an outreach wave is actually asking about. This table is the list
-- of what went out. Everything else is derived from it.
--
-- PRIVACY IS INHERITED, NOT RELAXED. The rollup below counts distinct
-- `visitor_id`, which is a random string a browser generated for itself —
-- it identifies a browser, never a person, and the analytics table holds no
-- IP, no user agent and no fingerprint. "Unique" here means unique BROWSER,
-- and the admin panel says so rather than implying it counted people.
--
-- RUN in the Supabase SQL editor. Safe to re-run.

create table if not exists public.outreach_links (
  -- The campaign code that travels in the URL (?utm_campaign=<code>).
  code        text primary key,
  -- Who it was sent to, in your words: "HackConcordia", "CSU exec".
  label       text not null,
  -- Where it points, so one registry can cover organizer / teacher / student.
  target      text not null default '/organizer',
  -- WHEN IT WENT OUT — set by you, not by the row's creation, because a link
  -- is often minted in a batch and sent later. Null = minted, not yet sent.
  sent_at     timestamptz,
  note        text,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table public.outreach_links enable row level security;
-- No policies at all: this is an admin surface, reached only through the
-- SECURITY DEFINER functions below, which check is_admin() themselves.

-- Which link an organization came from. Stamped at creation from the campaign
-- the browser remembered; null for every org that predates this or arrived
-- some other way, which is honest — an unattributed signup is not a signup
-- from the link you happen to be looking at.
alter table public.organizations
  add column if not exists ref_code text;

create index if not exists organizations_ref_code_idx
  on public.organizations (ref_code) where ref_code is not null;

create index if not exists site_events_campaign_idx
  on public.site_events (utm_campaign, created_at) where utm_campaign is not null;

-- ── The rollup ───────────────────────────────────────────────────────────────
-- One row per link you sent, with the whole funnel on it.
create or replace function public.outreach_rollup()
returns table (
  code           text,
  label          text,
  target         text,
  sent_at        timestamptz,
  days_out       int,
  opens          int,
  unique_opens   int,
  first_open_at  timestamptz,
  last_open_at   timestamptz,
  signed_up      boolean,
  org_handle     text,
  org_name       text,
  activated_at   timestamptz,
  org_status     text
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return query
  select
    l.code,
    l.label,
    l.target,
    l.sent_at,
    -- Days since it went out. Null until you mark it sent, because "0 days"
    -- and "not sent yet" are different answers and only one of them is bad.
    case when l.sent_at is null then null
         else greatest(0, extract(day from (now() - l.sent_at))::int) end,
    coalesce(e.opens, 0),
    coalesce(e.uniques, 0),
    e.first_at,
    e.last_at,
    (o.id is not null),
    o.handle,
    o.name,
    o.created_at,
    o.status
  from public.outreach_links l
  -- Views are only counted from when it was SENT. A link you opened yourself
  -- while writing the email is not interest.
  left join lateral (
    select count(*)::int                       as opens,
           count(distinct ev.visitor_id)::int  as uniques,
           min(ev.created_at)                  as first_at,
           max(ev.created_at)                  as last_at
      from public.site_events ev
     where ev.utm_campaign = l.code
       and ev.kind = 'view'
       and (l.sent_at is null or ev.created_at >= l.sent_at)
  ) e on true
  -- The first org that came from this link. More than one would mean the link
  -- was forwarded, which is a good problem and not one this column models.
  left join lateral (
    select og.id, og.handle, og.name, og.created_at, og.status
      from public.organizations og
     where og.ref_code = l.code
     order by og.created_at
     limit 1
  ) o on true
  order by l.sent_at desc nulls last, l.created_at desc;
end; $$;

revoke all on function public.outreach_rollup() from public, anon, authenticated;
grant execute on function public.outreach_rollup() to authenticated;

-- ── Writes (admin only, through functions — the table has no policies) ───────
create or replace function public.outreach_add(
  p_code text, p_label text, p_target text default '/organizer', p_note text default null
) returns text
language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  -- Normalised so the code in the URL and the code in the table cannot differ
  -- by a capital letter and silently stop matching.
  v_code := lower(regexp_replace(coalesce(p_code, ''), '[^a-zA-Z0-9_-]', '-', 'g'));
  if length(v_code) < 2 then raise exception 'code too short'; end if;
  insert into public.outreach_links (code, label, target, note, created_by)
  values (v_code, coalesce(nullif(trim(p_label), ''), v_code), p_target, p_note, auth.uid())
  on conflict (code) do update set label = excluded.label, target = excluded.target;
  return v_code;
end; $$;

create or replace function public.outreach_mark_sent(p_code text, p_sent boolean default true)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.outreach_links
     set sent_at = case when p_sent then coalesce(sent_at, now()) else null end
   where code = p_code;
end; $$;

create or replace function public.outreach_delete(p_code text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  delete from public.outreach_links where code = p_code;
end; $$;

revoke all on function public.outreach_add(text, text, text, text) from public, anon;
revoke all on function public.outreach_mark_sent(text, boolean) from public, anon;
revoke all on function public.outreach_delete(text) from public, anon;
grant execute on function public.outreach_add(text, text, text, text) to authenticated;
grant execute on function public.outreach_mark_sent(text, boolean) to authenticated;
grant execute on function public.outreach_delete(text) to authenticated;
