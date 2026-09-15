-- ============================================================================
-- Message requests — say one thing to somebody you are not connected to.
-- RUN IN: Supabase SQL Editor. Safe to re-run. Requires db/social.sql.
--
-- Today messaging requires an accepted friendship (`messages_insert_to_friend`),
-- which is the right default and stays exactly as it is. The gap it leaves:
-- you find a classmate in your section, you want to ask about the midterm, and
-- your only move is a bare connection request with no way to say why. People
-- ignore those, so the feature fails quietly.
--
-- THE SHAPE OF THE ANSWER: one message, before they accept, under conditions
-- strict enough that a spammer gets nothing out of it.
--
--   • NO INSERT POLICY IS ADDED. The `messages` table still refuses a write to
--     a non-friend. This goes through a SECURITY DEFINER function, which is the
--     only place the limits can be enforced — an RLS policy cannot count what
--     you sent yesterday.
--   • ONE request per person, ever, until they answer it. Not one per day.
--   • A DAILY CAP across everyone. Ten is generous for a person and useless for
--     a bot.
--   • NO LINKS. Checked in the database, not the browser, because a client-side
--     check is a suggestion. This is the single biggest reason unsolicited
--     messaging turns into a phishing channel, and a first message to a
--     stranger never needs a URL.
--   • The recipient does not have to do anything. An unanswered request is not
--     a notification they owe a reply to.
-- ============================================================================

-- Marks a message as sent before the two of you were connected. Null/false for
-- every existing row, so nothing already sent changes meaning.
alter table public.messages
  add column if not exists is_request boolean not null default false;

create index if not exists messages_requests_idx
  on public.messages (recipient, created_at desc) where is_request;

/**
 * Does this text contain a link?
 *
 * Deliberately BROAD. It catches bare domains ("bit.ly/x", "grab-crypto.io")
 * as well as http(s), because the obvious pattern is not the one a spammer
 * uses. It will occasionally refuse an innocent message mentioning a site,
 * which is the right way round: the cost is one rephrase, and the alternative
 * is a link-delivery channel aimed at strangers.
 */
create or replace function public.ct_has_link(p_text text)
returns boolean
language sql immutable as $$
  select p_text ~* '(https?://|www\.|\m[a-z0-9-]+\.(com|net|org|io|co|ly|me|gg|xyz|ru|cn|info|biz|link|app|site|shop|club|online|top)\M)';
$$;

/**
 * Send one message to somebody you are not connected to.
 *
 * Returns jsonb: { ok } or { ok: false, reason, detail }. Reasons are distinct
 * so the UI can say WHICH rule stopped it — "you have already messaged them"
 * and "you have sent too many today" need different answers from the person.
 */
create or replace function public.send_message_request(p_handle text, p_body text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid       uuid := auth.uid();
  target    uuid;
  body      text := trim(coalesce(p_body, ''));
  daily_cap int  := 10;
  sent_today int;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'reason', 'auth');
  end if;

  if length(body) < 2 then
    return jsonb_build_object('ok', false, 'reason', 'empty');
  end if;
  -- Short on purpose. A request is "here is who I am and what I want", and a
  -- wall of text from a stranger is itself a red flag.
  if length(body) > 500 then
    return jsonb_build_object('ok', false, 'reason', 'too_long');
  end if;
  if public.ct_has_link(body) then
    return jsonb_build_object('ok', false, 'reason', 'link');
  end if;

  select user_id into target from public.user_profile
   where lower(handle) = lower(trim(leading '@' from p_handle));
  if target is null then
    return jsonb_build_object('ok', false, 'reason', 'no_user');
  end if;
  if target = uid then
    return jsonb_build_object('ok', false, 'reason', 'self');
  end if;

  -- Already connected → this is just a message; use the normal path, which has
  -- no limits and allows links.
  if public.are_friends(uid, target) then
    return jsonb_build_object('ok', false, 'reason', 'already_friends');
  end if;

  -- One per person until they answer. "Answered" means they have written back
  -- or accepted — either way you are no longer a stranger asking.
  if exists (
    select 1 from public.messages
     where sender = uid and recipient = target and is_request
  ) then
    return jsonb_build_object('ok', false, 'reason', 'already_sent');
  end if;

  select count(*) into sent_today from public.messages
   where sender = uid and is_request and created_at > now() - interval '24 hours';
  if sent_today >= daily_cap then
    return jsonb_build_object('ok', false, 'reason', 'rate', 'detail', daily_cap);
  end if;

  insert into public.messages (sender, recipient, body, is_request)
  values (uid, target, body, true);

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.send_message_request(text, text) from anon;
grant execute on function public.send_message_request(text, text) to authenticated;
grant execute on function public.ct_has_link(text) to authenticated;

-- Check:
--   select public.ct_has_link('hey, are you in section EC?');        -- false
--   select public.ct_has_link('check bit.ly/free');                  -- true
--   select public.send_message_request('someone', 'hi from COMM 305');
