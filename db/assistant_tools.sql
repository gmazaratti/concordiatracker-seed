-- Assistant key housekeeping + per-org stats. db/assistant_tools.sql
--
-- NOTHING HERE WIDENS WHAT THE ASSISTANT MAY DO. Its reach is still
-- db/assistant_grant.sql. This adds:
--   1. admin_rotate_assistant_token: revoke one key and mint its replacement
--      in ONE transaction, so there is never a moment with zero working keys
--      or two.
--   2. The default key label is "alfred-assistant".
--   3. org_stats(p_org): aggregate counts for one org, readable by whoever can
--      already act for it (its team, a platform admin, the assistant). Counts
--      only: which students followed, liked or watched is never returned.
--
-- Idempotent: safe to re-run.

create or replace function public.admin_create_assistant_token(p_name text)
returns table (id uuid, token text, prefix text)
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_token text;
begin
  if not public.ct_admin_write() then
    raise exception 'Only a human admin can create an assistant token.' using errcode = '42501';
  end if;
  select g.user_id into v_owner from public.assistant_grant g order by g.granted_at limit 1;
  if v_owner is null then
    raise exception 'There is no assistant identity to issue it to.' using errcode = '22023';
  end if;
  v_token := public.ct_new_api_token('assistant');
  insert into public.api_tokens (user_id, scope, name, token_hash, prefix)
  values (v_owner, 'assistant', left(coalesce(nullif(btrim(p_name), ''), 'alfred-assistant'), 60),
          public.ct_hash_api_token(v_token), left(v_token, 15))
  returning api_tokens.id into id;
  token := v_token;
  prefix := left(v_token, 15);
  return next;
end $$;

-- Rotate: same label, new secret, old one dead, all at once.
create or replace function public.admin_rotate_assistant_token(p_id uuid)
returns table (id uuid, token text, prefix text)
language plpgsql security definer set search_path = public as $$
declare
  v_old   public.api_tokens%rowtype;
  v_token text;
begin
  if not public.ct_admin_write() then
    raise exception 'Only a human admin can rotate an assistant token.' using errcode = '42501';
  end if;
  select * into v_old from public.api_tokens t
   where t.id = p_id and t.scope = 'assistant' and t.revoked_at is null
   for update;
  if not found then
    raise exception 'No active assistant token with that id.' using errcode = 'P0002';
  end if;
  update public.api_tokens set revoked_at = now() where api_tokens.id = p_id;
  v_token := public.ct_new_api_token('assistant');
  insert into public.api_tokens (user_id, scope, name, token_hash, prefix)
  values (v_old.user_id, 'assistant', v_old.name, public.ct_hash_api_token(v_token), left(v_token, 15))
  returning api_tokens.id into id;
  token := v_token;
  prefix := left(v_token, 15);
  return next;
end $$;

revoke all on function public.admin_rotate_assistant_token(uuid) from public, anon;
grant execute on function public.admin_rotate_assistant_token(uuid) to authenticated;

create or replace function public.org_stats(p_org uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  result jsonb;
begin
  if not (public.ct_can_act_as_org(p_org) or public.is_admin()) then
    raise exception 'Not authorized for this organisation.' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'followers',          (select count(*) from public.org_follows f where f.org_id = p_org),
    'new_followers_30d',  (select count(*) from public.org_follows f where f.org_id = p_org and f.created_at > now() - interval '30 days'),
    'posts',              (select count(*) from public.org_posts p where p.org_id = p_org and not p.deleted and not p.is_draft),
    'post_likes',         (select count(*) from public.post_likes l join public.org_posts p on p.id = l.post_id where p.org_id = p_org and not p.deleted),
    'post_comments',      (select count(*) from public.post_comments c join public.org_posts p on p.id = c.post_id where p.org_id = p_org and not p.deleted),
    'reposts',            (select count(*) from public.reposts r where r.actor_org = p_org),
    'stories_live',       (select count(*) from public.org_stories s where s.org_id = p_org and not s.is_draft and s.expires_at > now()),
    'story_views',        (select count(*) from public.story_views v join public.org_stories s on s.id = v.story_id where s.org_id = p_org),
    'events_total',       (select count(*) from public.events e where e.org_id = p_org and not e.is_draft),
    'events_upcoming',    (select count(*) from public.events e where e.org_id = p_org and not e.is_draft and e.start > now()),
    'event_reminders',    (select count(*) from public.event_reminders r join public.events e on e.id = r.event_id where e.org_id = p_org),
    'not_tracked',        jsonb_build_array('post_views', 'event_rsvps')
  ) into result;
  return result;
end $$;

revoke all on function public.org_stats(uuid) from public, anon;
grant execute on function public.org_stats(uuid) to authenticated;
