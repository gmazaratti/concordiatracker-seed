-- ============================================================================
-- Why is the catalogue sync getting a 401?
-- RUN IN: Supabase SQL Editor. Reads only; changes nothing.
--
-- The auto-extract in db/sync_catalog_cron.sql lifts CRON_SECRET out of the
-- reminders job. A 401 means the value it sent is not the value Vercel holds.
-- This says which of the three causes it is, without printing the secret.
-- ============================================================================

-- ── STEP 1 ──────────────────────────────────────────────────────────────────
-- What is actually stored, and does it even look like a secret?
select
  j.jobname,
  case when j.command like '%Bearer%' then 'yes' else 'NO - no Bearer token in this job' end
    as has_bearer,
  length(substring(j.command from 'Bearer ([^'']+)'))          as secret_length,
  -- The single most likely cause: db/reminders.sql ships with a placeholder,
  -- and running it unedited stores the placeholder rather than a real secret.
  case
    when substring(j.command from 'Bearer ([^'']+)') = '__CRON_SECRET__'
      then 'PLACEHOLDER NEVER REPLACED - this is the problem'
    when substring(j.command from 'Bearer ([^'']+)') is null
      then 'could not read a token'
    else 'looks like a real value'
  end                                                          as verdict,
  -- Enough to compare against Vercel by eye, not enough to leak it.
  left(substring(j.command from 'Bearer ([^'']+)'), 3) || '...' ||
    right(substring(j.command from 'Bearer ([^'']+)'), 3)      as masked,
  j.schedule,
  j.active
from cron.job j
where j.command like '%concordiatracker.com/api/%'
order by j.jobname;

-- ── STEP 2 ──────────────────────────────────────────────────────────────────
-- Have the REMINDERS been failing too? If the stored secret is wrong, every
-- reminder push has been 401ing on the same credential, silently, since it was
-- set up. This is the more important question of the two.
--
-- pg_net keeps only recent responses, so an empty result here means "nothing
-- recent", not "no failures ever".
select
  r.status_code,
  count(*)                as responses,
  max(r.created)          as most_recent
from net._http_response r
group by r.status_code
order by responses desc;

-- ============================================================================
-- WHAT TO DO WITH THE ANSWER
--
-- verdict = PLACEHOLDER NEVER REPLACED
--   The reminders job has never authenticated. Fix both at once with STEP 3.
--
-- verdict = looks like a real value, but you still get 401
--   The database and Vercel disagree. Compare `secret_length` and `masked`
--   against CRON_SECRET in Vercel (Settings, Environment Variables, reveal).
--   Whichever you decide is correct, STEP 3 sets the database to match.
--
-- has_bearer = NO, or no rows at all
--   The reminders job was never scheduled. STEP 3 still works; it does not
--   read the old job.
-- ============================================================================

-- ── STEP 3 ──────────────────────────────────────────────────────────────────
-- Set both jobs from the secret you paste, and fire one sync immediately.
-- Replace __PASTE_CRON_SECRET_HERE__ with the value from Vercel, then run.
--
-- Uncomment and run:
--
-- do $outer$
-- declare
--   -- Dollar-quoted, so a secret containing quotes or backslashes pastes
--   -- safely. Replace only the text between the $secret$ markers.
--   v_secret text := $secret$__PASTE_CRON_SECRET_HERE__$secret$;
-- begin
--   if v_secret like '__PASTE%CRON_SECRET_HERE__' then
--     raise exception 'Paste the real CRON_SECRET from Vercel first.';
--   end if;
--
--   if exists (select 1 from cron.job where jobname = 'ct-sync-catalog') then
--     perform cron.unschedule('ct-sync-catalog');
--   end if;
--   if exists (select 1 from cron.job where jobname = 'ct-run-reminders') then
--     perform cron.unschedule('ct-run-reminders');
--   end if;
--
--   perform cron.schedule('ct-sync-catalog', '0 4 * * 1', format(
--     $job$
--     select net.http_post(
--       url := 'https://concordiatracker.com/api/sync-catalog',
--       headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || %L),
--       body := '{}'::jsonb
--     );
--     $job$, v_secret));
--
--   perform cron.schedule('ct-run-reminders', '*/15 * * * *', format(
--     $job$
--     select net.http_post(
--       url := 'https://concordiatracker.com/api/run-reminders',
--       headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || %L),
--       body := '{}'::jsonb
--     );
--     $job$, v_secret));
--
--   -- Fire the sync now rather than waiting for Monday.
--   perform net.http_post(
--     url := 'https://concordiatracker.com/api/sync-catalog',
--     headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || v_secret),
--     body := '{}'::jsonb
--   );
-- end
-- $outer$;

-- ── STEP 4, about 30 seconds later ──────────────────────────────────────────
--   select status_code, content from net._http_response order by id desc limit 3;
--   select * from public.catalog_status();
