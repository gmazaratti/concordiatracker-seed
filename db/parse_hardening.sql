-- ============================================================================
-- Parser hardening: an hourly ceiling on syllabus parses, for every plan.
--
-- start_parse already had a per-upload cooldown, a free monthly cap and a Pro
-- daily abuse stop. What it lacked was a short window that applies to EVERYONE,
-- so one account (or a stolen session) could spend the shared Gemini key's
-- quota in bursts. Ten model calls an hour, counting failures that were not
-- refunded, is more than a real first-day-of-term session needs.
--
-- The body is pg_get_functiondef of the LIVE function with the hourly block
-- added, not a rewrite from memory. Re-runnable.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ct_start_parse(p_uid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

declare

  uid uuid := p_uid;

  pro boolean;

  cooldown int;              -- seconds between uploads, set from the last attempt

  monthly_limit int;         -- successful parses / calendar month; null = no cap

  daily_ceiling int := 40;   -- Pro only: an abuse stop, not a product limit
  hourly_ceiling int := 10;  -- EVERYONE: a burst stop on the shared model quota
  hour_used int;

  month_start timestamptz := date_trunc('month', now());

  last_at timestamptz;

  last_ok boolean;

  used int;

  today_used int;

  new_id uuid;

begin

  if uid is null then

    return jsonb_build_object('allowed', false, 'reason', 'auth');

  end if;



  -- Serialize concurrent requests from the same user (kills the check→insert race).

  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));



  -- The cooldown exists to stop someone hammering the shared model quota, and

  -- it still does: what it must NOT do is punish a student whose upload failed.

  -- A failed attempt costs 20s, enough to keep a script slow, short enough that

  -- a person who just got an error can fix the file and try again.

  select created_at, success into last_at, last_ok

    from public.parse_events where user_id = uid

    order by created_at desc limit 1;

  /**

   * Pro pays for this; free is rationed.

   *

   * Free keeps the old numbers: 180s after a success is a real brake on the

   * shared model quota, and 20s after a failure so a person who just got an

   * error can fix the file and retry.

   *

   * Pro gets 5s, which is not a rationing device -- it stops a double-click

   * and a runaway loop and nothing else. The ceiling that protects the quota

   * for a paying account is the DAILY one below, because a per-upload wait

   * punishes the one genuine burst that happens (adding six classes on the

   * first day of term) while doing nothing about a script.

   */

  pro := public.ct_parse_is_pro(uid);

  cooldown := case

                when pro then 5

                when coalesce(last_ok, false) then 180

                else 20

              end;

  monthly_limit := case when pro then null else 5 end;



  if last_at is not null and last_at > now() - make_interval(secs => cooldown) then

    return jsonb_build_object(

      'allowed', false,

      'reason', 'cooldown',

      'retry_after', greatest(1, ceil(extract(epoch from (last_at + make_interval(secs => cooldown) - now()))))

    );

  end if;



  -- The hourly ceiling applies to every plan and counts every MODEL CALL that
  -- was not handed back (refunded), successful or not: a failed parse still
  -- spent quota. Ten covers the real burst (a whole term of classes on the
  -- first day) and stops one account from draining the key for everybody.
  select count(*) into hour_used from public.parse_events
    where user_id = uid and not coalesce(refunded, false)
      and created_at >= now() - interval '1 hour';
  if hour_used >= hourly_ceiling then
    return jsonb_build_object(
      'allowed', false, 'reason', 'hourly', 'used', hour_used, 'limit', hourly_ceiling,
      'retry_after', greatest(60, ceil(extract(epoch from (
        (select min(w.created_at) from (
           select created_at from public.parse_events
            where user_id = uid and not coalesce(refunded, false)
              and created_at >= now() - interval '1 hour'
            order by created_at desc limit hourly_ceiling) w)
        + interval '1 hour' - now()))))
    );
  end if;

  select count(*) into used from public.parse_events

    where user_id = uid and success and created_at >= month_start;



  if monthly_limit is not null and used >= monthly_limit then

    return jsonb_build_object(

      'allowed', false, 'reason', 'monthly',

      'used', used, 'limit', monthly_limit, 'resets_at', month_start + interval '1 month'

    );

  end if;



  -- Pro's only ceiling, and it is set where no real student will ever meet it:

  -- forty successful parses in a day is not a term's worth of syllabi, it is a

  -- script. The refusal says so rather than claiming they used up an allowance

  -- they were told they did not have.

  if pro then

    select count(*) into today_used from public.parse_events

      where user_id = uid and success and created_at >= now() - interval '24 hours';

    if today_used >= daily_ceiling then

      return jsonb_build_object(

        'allowed', false, 'reason', 'daily',

        'used', today_used, 'limit', daily_ceiling

      );

    end if;

  end if;



  insert into public.parse_events (user_id) values (uid) returning id into new_id;

  return jsonb_build_object(

    'allowed', true, 'event_id', new_id, 'used', used,

    'limit', monthly_limit, 'pro', pro

  );

end;

$function$;

-- The limiter's ONE body, keyed on a user id, so the website (a session) and
-- the personal API (a token, running as the service role, where auth.uid() is
-- null) are held to exactly the same rules. Server-only.
revoke all on function public.ct_start_parse(uuid) from public, anon, authenticated;

create or replace function public.start_parse()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.ct_start_parse(auth.uid());
$$;
grant execute on function public.start_parse() to authenticated;

-- How a server-side caller (the personal API) closes an attempt: records the
-- reason, and hands the attempt back when the failure was ours, exactly as the
-- website's fail_parse + cancel_parse pair does.
create or replace function public.ct_finish_parse(p_event uuid, p_error text, p_refund boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update public.parse_events
     set success = false,
         error = left(coalesce(p_error, 'unknown'), 500),
         refunded = coalesce(p_refund, false)
   where id = p_event;
$$;
revoke all on function public.ct_finish_parse(uuid, text, boolean) from public, anon, authenticated;
