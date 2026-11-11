-- "Something was done to your account for you" is worth a push (2026-11-10):
-- an outline support added, or a parent accepting a family invite. Until now
-- only club posts, follows, suggestion updates and moderation were pushed, so
-- a student whose outline was rebuilt only found out by opening the bell.
-- Same opt-out as the rest: push_prefs ->> 'account' (missing = on).
create or replace function public.ct_push_category(p_kind text)
returns text language sql immutable as $function$
  select case p_kind
    when 'org_post' then 'club_posts'
    when 'follow' then 'follows'
    when 'request_status' then 'feature_requests'
    when 'request_comment' then 'feature_requests'
    when 'block_report' then 'moderation'
    when 'syllabus_added' then 'account'
    when 'guardian_joined' then 'account'
    else null
  end
$function$;
