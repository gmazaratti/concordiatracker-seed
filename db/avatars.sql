-- ============================================================================
-- Google profile pictures in the feedback feed. DEV.
-- The current user's avatar comes from their sign-in metadata (no DB needed).
-- To show OTHER users' avatars on requests/comments (RLS hides their profiles),
-- we denormalize an author_avatar snapshot — exactly like author_name/tier — and
-- have the submit RPCs carry it from user_profile.avatar_url.
-- ============================================================================

alter table public.feature_requests        add column if not exists author_avatar text;
alter table public.feature_request_comments add column if not exists author_avatar text;

-- submit_feature_request — now also snapshots the author's avatar.
create or replace function public.submit_feature_request(p_title text, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); nm text; tier text; av text; new_id uuid;
        t text := trim(coalesce(p_title, '')); b text := coalesce(p_body, '');
begin
  if uid is null then raise exception 'You must be signed in to post.'; end if;
  if length(t) < 3 then raise exception 'Please add a short, clear title.'; end if;
  if (t || ' ' || b) ~* '\m(fuck|shit|cunt|nigger|faggot|retard|bitch)\M' then
    raise exception 'Please keep it respectful — that post was blocked.';
  end if;
  select coalesce(name, split_part(coalesce(email, 'member'), '@', 1)),
         case when plan_status = 'pro' then 'pro' else 'free' end, avatar_url
    into nm, tier, av
    from public.user_profile where user_id = uid order by created_at desc limit 1;
  insert into public.feature_requests (user_id, author_name, author_tier, author_avatar, title, body)
    values (uid, coalesce(nm, 'Member'), coalesce(tier, 'free'), av, left(t, 120), left(b, 2000))
    returning id into new_id;
  return new_id;
end; $$;

-- add_feature_comment — now also snapshots the author's avatar.
create or replace function public.add_feature_comment(p_request_id uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); nm text; tier text; av text; new_id uuid; b text := trim(coalesce(p_body, ''));
begin
  if uid is null then raise exception 'Sign in to comment.'; end if;
  if length(b) < 1 then raise exception 'Write something first.'; end if;
  if b ~* '\m(fuck|shit|cunt|nigger|faggot|retard|bitch)\M' then
    raise exception 'Please keep it respectful — that comment was blocked.';
  end if;
  select coalesce(name, split_part(coalesce(email, 'member'), '@', 1)),
         case when plan_status = 'pro' then 'pro' else 'free' end, avatar_url
    into nm, tier, av
    from public.user_profile where user_id = uid order by created_at desc limit 1;
  insert into public.feature_request_comments (request_id, user_id, author_name, author_tier, author_avatar, is_staff, body)
    values (p_request_id, uid, coalesce(nm, 'Member'), coalesce(tier, 'free'), av, public.is_admin(), left(b, 1000))
    returning id into new_id;
  return new_id;
end; $$;
