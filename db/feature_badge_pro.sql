-- The Pro badge on feature requests and comments reads the one Pro check
-- (ct_is_pro: paid, manual or team), not plan_status alone. Idempotent.

CREATE OR REPLACE FUNCTION public.add_feature_comment(p_request_id uuid, p_body text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare uid uuid := auth.uid(); nm text; tier text; av text; hdl text; new_id uuid; b text := trim(coalesce(p_body, ''));
begin
  if uid is null then raise exception 'Sign in to comment.'; end if;
  if length(b) < 1 then raise exception 'Write something first.'; end if;
  if b ~* '\m(fuck|shit|cunt|nigger|faggot|retard|bitch)\M' then
    raise exception 'Please keep it respectful — that comment was blocked.';
  end if;
  select coalesce(name, split_part(coalesce(email, 'member'), '@', 1)),
         case when public.ct_is_pro(uid) then 'pro' else 'free' end, avatar_url, handle
    into nm, tier, av, hdl
    from public.user_profile where user_id = uid order by created_at desc limit 1;
  insert into public.feature_request_comments (request_id, user_id, author_name, author_tier, author_avatar, author_handle, is_staff, body)
    values (p_request_id, uid, coalesce(nm, 'Member'), coalesce(tier, 'free'), av, hdl, public.is_admin(), left(b, 1000))
    returning id into new_id;
  return new_id;
end; $function$;

CREATE OR REPLACE FUNCTION public.submit_feature_request(p_title text, p_body text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare uid uuid := auth.uid(); nm text; tier text; av text; hdl text; new_id uuid;
        t text := trim(coalesce(p_title, '')); b text := coalesce(p_body, '');
begin
  if uid is null then raise exception 'You must be signed in to post.'; end if;
  if length(t) < 3 then raise exception 'Please add a short, clear title.'; end if;
  if (t || ' ' || b) ~* '\m(fuck|shit|cunt|nigger|faggot|retard|bitch)\M' then
    raise exception 'Please keep it respectful — that post was blocked.';
  end if;
  select coalesce(name, split_part(coalesce(email, 'member'), '@', 1)),
         case when public.ct_is_pro(uid) then 'pro' else 'free' end, avatar_url, handle
    into nm, tier, av, hdl
    from public.user_profile where user_id = uid order by created_at desc limit 1;
  insert into public.feature_requests (user_id, author_name, author_tier, author_avatar, author_handle, title, body)
    values (uid, coalesce(nm, 'Member'), coalesce(tier, 'free'), av, hdl, left(t, 120), left(b, 2000))
    returning id into new_id;
  return new_id;
end; $function$;

