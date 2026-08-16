-- ============================================================================
-- Populate the course catalogue, then keep it fresh.
-- RUN IN: Supabase SQL Editor. Safe to re-run.
-- Requires db/course_catalog.sql.
--
-- Two things happen here: a weekly job is scheduled, and the sync fires ONCE
-- immediately so the directory has data now rather than on Monday.
--
-- You do NOT need to paste a secret. The reminders job already stores it, and
-- this reads it back out of that job's command rather than asking you to go
-- find it in Vercel and copy it through a terminal. Same pattern as
-- db/reminders.sql, which is how everything else in this project is scheduled.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $outer$
declare
  v_secret text;
  v_url    text := 'https://concordiatracker.com/api/sync-catalog';
begin
  -- Lift CRON_SECRET out of the existing reminders job.
  --
  -- Match everything up to the CLOSING QUOTE, not a list of allowed characters.
  -- An earlier version used [A-Za-z0-9._~+/=-], which silently truncated any
  -- secret containing !@#$%^& at the first one and produced a 401 that looked
  -- like a configuration problem rather than a parsing bug.
  select substring(j.command from 'Bearer ([^'']+)')
    into v_secret
  from cron.job j
  where j.jobname = 'ct-run-reminders'
  limit 1;

  if v_secret is null then
    raise exception
      'Could not read CRON_SECRET from the ct-run-reminders job. Run db/reminders.sql first, or schedule this by hand with the secret from Vercel.';
  end if;

  -- Idempotent: drop a previous copy so re-running does not duplicate the job.
  if exists (select 1 from cron.job where jobname = 'ct-sync-catalog') then
    perform cron.unschedule('ct-sync-catalog');
  end if;

  -- Mondays at 04:00 UTC. The calendar changes about once a year; the only
  -- reason to run it weekly at all is so a course added mid-year appears
  -- without anyone remembering to press anything.
  perform cron.schedule(
    'ct-sync-catalog',
    '0 4 * * 1',
    format(
      $job$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || %L
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 120000
      );
      $job$,
      v_url, v_secret
    )
  );

  -- And run it now, so the catalogue is populated before you leave this page.
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := '{}'::jsonb,
    -- pg_net defaults to a 5 SECOND timeout, which this job always exceeds: it
    -- fetches 1.4MB from Concordia and writes ~7,900 rows in sixteen chunks.
    -- Without this the response records as NULL and the run looks like it
    -- vanished, even though the request was sent and may have succeeded.
    timeout_milliseconds := 120000
  );

  -- The length is enough to spot a truncated read without printing the secret.
  raise notice 'Scheduled ct-sync-catalog and fired one run using a % character secret. Compare that against CRON_SECRET in Vercel if you get a 401.', length(v_secret);
end
$outer$;

-- ============================================================================
-- THEN, about 30 seconds later, run this to see what the sync actually did.
-- net.http_post is asynchronous: the block above queues the request, and the
-- response lands here.
--
--   200 {"fetched":7946,"written":7946}   the catalogue is in
--   502 {"error":"Fetched the catalogue but wrote nothing.", "cause": ...}
--                                          read `cause` - it names the problem
--   401                                    the secret did not match
--
--   select status_code, content
--   from net._http_response
--   order by id desc
--   limit 3;
--
-- And to confirm the mirror is populated:
--
--   select * from public.catalog_status();
-- ============================================================================
