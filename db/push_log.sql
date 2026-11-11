-- Push notifications an admin sent, and whether each was opened (2026-11-10).
-- A send writes one row per person; the link inside the push carries ?pn=<id>,
-- and opening it marks the row (mark_push_opened). Open rate = opened / sent.
create table if not exists public.push_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null default 'admin',
  title      text not null,
  body       text,
  url        text,
  sent_by    uuid,
  sent_at    timestamptz not null default now(),
  devices    int not null default 0,
  delivered  int not null default 0,
  opened_at  timestamptz
);
create index if not exists push_log_user_idx on public.push_log (user_id, sent_at desc);
alter table public.push_log enable row level security;
-- No policies: written by the server with the service key, read by admins
-- through the functions below, and marked opened by its own recipient.

create or replace function public.mark_push_opened(p_id uuid)
returns void language sql security definer set search_path to 'public' as $$
  update public.push_log set opened_at = now()
   where id = p_id and user_id = auth.uid() and opened_at is null
$$;
revoke all on function public.mark_push_opened(uuid) from public, anon;
grant execute on function public.mark_push_opened(uuid) to authenticated;

-- One person's devices and the pushes they were sent.
create or replace function public.admin_user_push(p_user uuid)
returns jsonb language plpgsql security definer set search_path to 'public' stable as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  return jsonb_build_object(
    'devices', (select coalesce(jsonb_agg(jsonb_build_object(
        'kind', coalesce(s.kind, 'web'), 'user_agent', s.user_agent, 'created_at', s.created_at, 'apns_env', s.apns_env
      ) order by s.created_at desc), '[]'::jsonb) from public.push_subscriptions s where s.user_id = p_user),
    'pushes', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', l.id, 'title', l.title, 'body', l.body, 'sent_at', l.sent_at, 'delivered', l.delivered,
        'devices', l.devices, 'opened_at', l.opened_at
      ) order by l.sent_at desc), '[]'::jsonb) from (select * from public.push_log where user_id = p_user order by sent_at desc limit 50) l)
  );
end $$;
revoke all on function public.admin_user_push(uuid) from public, anon;
grant execute on function public.admin_user_push(uuid) to authenticated;

-- Totals for the open rate, and per send (title + time) so a campaign can be compared.
create or replace function public.admin_push_stats()
returns jsonb language plpgsql security definer set search_path to 'public' stable as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  return jsonb_build_object(
    'sent', (select count(*) from public.push_log where delivered > 0),
    'opened', (select count(*) from public.push_log where opened_at is not null),
    'with_devices', (select count(distinct user_id) from public.push_subscriptions),
    'sends', (select coalesce(jsonb_agg(x order by x->>'at' desc), '[]'::jsonb) from (
        select jsonb_build_object('title', title, 'at', min(sent_at), 'people', count(*),
               'delivered', count(*) filter (where delivered > 0), 'opened', count(*) filter (where opened_at is not null)) x
          from public.push_log group by title, date_trunc('minute', sent_at) order by min(sent_at) desc limit 30) s)
  );
end $$;
revoke all on function public.admin_push_stats() from public, anon;
grant execute on function public.admin_push_stats() to authenticated;
