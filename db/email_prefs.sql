-- Email preferences that actually save, and the weekly digest (2026-11-10).
--
-- The Settings switches were screen state only: nothing was stored and no
-- email existed. Now:
--   email_digest   the Monday "your week ahead" email. ON by default: it is
--                  about the student's own coursework, the service they signed
--                  up for, and it is one switch away.
--   email_product  occasional product news. OFF by default: that is
--                  promotional mail, which needs a yes first (CASL).
-- digest_sent_at stops a second Monday email if the cron runs twice.

alter table public.user_profile add column if not exists email_digest boolean not null default true;
alter table public.user_profile add column if not exists email_product boolean not null default false;
alter table public.user_profile add column if not exists digest_sent_at timestamptz;

-- Who gets this week's digest, claimed in one statement so two overlapping
-- cron runs cannot both send it. Monday, 7:00 to 11:59 in Montreal.
create or replace function public.claim_weekly_digests()
returns table (user_id uuid, email text, name text)
language sql
security definer
set search_path to 'public'
as $$
  with due as (
    select up.user_id
      from public.user_profile up
     where up.email_digest
       and coalesce(up.is_internal, false) = false
       and (up.digest_sent_at is null or up.digest_sent_at < now() - interval '6 days')
       and extract(isodow from now() at time zone 'America/Montreal') = 1
       and extract(hour from now() at time zone 'America/Montreal') between 7 and 11
     limit 200
  ),
  stamped as (
    update public.user_profile up set digest_sent_at = now()
      from due where up.user_id = due.user_id
    returning up.user_id, up.name
  )
  select s.user_id, u.email::text, s.name
    from stamped s join auth.users u on u.id = s.user_id
   where u.email is not null
$$;

revoke all on function public.claim_weekly_digests() from public, anon, authenticated;
grant execute on function public.claim_weekly_digests() to service_role;

-- Product-update recipients, for the admin "email an update" action.
create or replace function public.product_update_recipients()
returns table (user_id uuid, email text, name text)
language sql
security definer
set search_path to 'public'
as $$
  select up.user_id, u.email::text, up.name
    from public.user_profile up join auth.users u on u.id = up.user_id
   where up.email_product and coalesce(up.is_internal, false) = false and u.email is not null
$$;
revoke all on function public.product_update_recipients() from public, anon, authenticated;
grant execute on function public.product_update_recipients() to service_role;
