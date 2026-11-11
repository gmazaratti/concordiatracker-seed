-- Suggestion status notifications, reworded (2026-11-10).
--
-- The old one put the whole suggestion in the title ("Dark mode for the
-- calendar is now shipped") and explained itself with "You asked for this, or
-- backed someone who did", which never said which of the two you were.
--
-- Now: a short title that fits one line and says whose it is, and the
-- suggestion itself in the body.
--   author  -> "Your suggestion is live"
--   backer  -> "A suggestion you backed is live"
-- Backers are people who reacted or commented, minus the author.

create or replace function public.ct_request_status_word(p_status text)
returns text language sql immutable as $$
  select case p_status
    when 'shipped'     then 'live'
    when 'in-progress' then 'in progress'
    when 'planned'     then 'planned'
    when 'open'        then 'reopened'
    else replace(coalesce(p_status, 'updated'), '-', ' ')
  end
$$;

create or replace function public.ct_request_status_title(p_status text, p_author boolean)
returns text language sql immutable as $$
  select case
    when p_author then 'Your suggestion is ' || public.ct_request_status_word(p_status)
    when p_status = 'in-progress' then 'One you backed is in progress'
    else 'A suggestion you backed is ' || public.ct_request_status_word(p_status)
  end
$$;

create or replace function public.ct_request_status_body(p_title text, p_status text)
returns text language sql immutable as $$
  select '"' || left(p_title, 120) || '"' || case p_status
    when 'shipped'     then ' is now in the app. Thanks for helping make it better.'
    when 'in-progress' then ' is being worked on now.'
    when 'planned'     then ' is on our list to build.'
    when 'open'        then ' is open again.'
    else ' was updated.'
  end
$$;

create or replace function public.ct_on_request_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare audience uuid[]; author uuid := new.user_id;
begin
  if new.status is not distinct from old.status then return new; end if;

  select array_agg(u) into audience
    from public.ct_request_audience(new.id, auth.uid()) u;
  if audience is null then return new; end if;

  if author is not null and author = any(audience) then
    perform public.ct_notify(array[author], 'request_status',
      public.ct_request_status_title(new.status, true),
      public.ct_request_status_body(new.title, new.status),
      '/feedback?request=' || new.id::text, new.id, null);
  end if;

  audience := array_remove(audience, author);
  if coalesce(array_length(audience, 1), 0) > 0 then
    perform public.ct_notify(audience, 'request_status',
      public.ct_request_status_title(new.status, false),
      public.ct_request_status_body(new.title, new.status),
      '/feedback?request=' || new.id::text, new.id, null);
  end if;
  return new;
end $$;

-- Reword the ones already sent, so the bell does not show two styles side by
-- side. Old titles were "<suggestion> is now <status>"; the status is read off
-- the end of that title, so each row keeps the status it was actually about.
update public.notifications n
   set title = public.ct_request_status_title(s.status, n.user_id = s.author),
       body  = public.ct_request_status_body(s.rtitle, s.status)
  from (select x.id, r.user_id as author, r.title as rtitle,
               substring(x.title from ' is now ([a-z-]+)$') as status
          from public.notifications x
          join public.feature_requests r on r.id = x.subject_id
         where x.kind = 'request_status') s
 where n.id = s.id
   and s.status is not null;
