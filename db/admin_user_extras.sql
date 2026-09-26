-- Admin → Users → Overview: the rest of the picture on one account.
-- db/admin_user_extras.sql. Admin-only (is_admin()), read-only. Idempotent.
--
-- The profile as they set it (handle, bio, public or private, linked socials,
-- who may message them), where they are signed in (live sessions and the
-- 90-day history from db/devices.sql), whether Moodle sync is on and how it
-- is doing, and why they have Pro (db/team_pro.sql).
--
-- NEVER the Moodle calendar link: it is a credential (anyone holding it reads
-- that calendar), so only its status leaves the table.

create or replace function public.admin_user_extras(p_user uuid)
returns jsonb
language sql stable security definer set search_path = public, auth as $$
  select case when not public.is_admin() then null else jsonb_build_object(
    'profile', (
      select jsonb_build_object(
        'handle', p.handle,
        'bio', p.bio,
        'profile_public', coalesce(p.profile_public, false),
        'links', coalesce(p.links, '{}'::jsonb),
        'dm_policy', p.dm_policy,
        'schedule_visibility', p.schedule_visibility,
        'avatar_url', p.avatar_url
      )
      from public.user_profile p where p.user_id = p_user
    ),
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'user_agent', s.user_agent,
               'ip', host(s.ip),
               'signed_in', s.created_at,
               'last_active', greatest(s.created_at, coalesce(s.refreshed_at::timestamptz, s.updated_at, s.created_at))
             ) order by coalesce(s.refreshed_at::timestamptz, s.updated_at, s.created_at) desc)
      from auth.sessions s where s.user_id = p_user
    ), '[]'::jsonb),
    'past_devices', coalesce((
      select jsonb_agg(jsonb_build_object(
               'user_agent', h.user_agent,
               'ip', host(h.ip),
               'last_active', h.last_seen,
               'ended_at', h.ended_at
             ) order by h.last_seen desc)
      from (select * from public.user_device_history
            where user_id = p_user and ended_at is not null
            order by last_seen desc limit 20) h
    ), '[]'::jsonb),
    'moodle', (
      select jsonb_build_object(
        'status', m.status,
        'connected_at', m.created_at,
        'last_sync_at', m.last_sync_at,
        'event_count', m.event_count,
        'last_error', m.last_error
      )
      from public.moodle_connections m where m.user_id = p_user
    ),
    'pro', (
      select jsonb_build_object('paid', ps.paid, 'manual', ps.manual, 'team_clubs', to_jsonb(ps.team_clubs))
      from public.admin_pro_sources() ps where ps.user_id = p_user
    )
  ) end
$$;
grant execute on function public.admin_user_extras(uuid) to authenticated;
