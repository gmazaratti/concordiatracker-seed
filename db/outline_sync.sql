-- ============================================================================
-- eConcordia outline sync — schema + schedule.
-- RUN IN: Supabase SQL Editor. Safe to re-run.
--
-- What this supports: /api/sync-outlines walks eConcordia's public course
-- catalogue, downloads each course's published outline PDF, extracts the
-- assessment scheme, and writes it into `shared_blueprints` as a verified
-- blueprint. `outline_sources` is the bookkeeping that makes that repeatable:
-- what we found, when we last looked, and what the PDF hashed to, so an
-- unchanged outline costs one GET and no model call.
--
-- ADDITIVE ONLY. One new table, one new nullable column. Nothing existing
-- changes shape, so the user-upload path and every current blueprint keep
-- working exactly as they do today.
-- ============================================================================

-- ── Where a blueprint came from ─────────────────────────────────────────────
-- A verified badge you can click through to the university's own PDF is worth
-- more than one you have to take on trust. Null for everything else — a
-- student's upload has no public URL and must not pretend to.
alter table public.shared_blueprints
  add column if not exists source_url text;

-- ── The scrape ledger ───────────────────────────────────────────────────────
create table if not exists public.outline_sources (
  slug           text primary key,             -- thumbnail filename = outline filename
  semester       text not null,                -- eConcordia's own id: 118..123
  term           text,                         -- "Fall 2026", read off the page
  course_codes   text[] not null default '{}', -- cross-listed cards carry two
  title          text,
  pdf_url        text not null,
  -- pending | ok | missing | no_text | parse_failed
  status         text not null default 'pending',
  content_hash   text,                         -- sha256 of the PDF bytes
  last_error     text,
  discovered_at  timestamptz not null default now(),
  last_checked_at timestamptz,
  last_parsed_at  timestamptz
);

create index if not exists outline_sources_status_idx
  on public.outline_sources (status, last_checked_at nulls first);
create index if not exists outline_sources_term_idx on public.outline_sources (term);

alter table public.outline_sources enable row level security;

-- Readable by anyone signed in: coverage is not a secret, and the admin
-- console shows it. Writes are service-role only — there is deliberately no
-- insert/update/delete policy, so the only writer is the sync job.
drop policy if exists "outline_sources_read" on public.outline_sources;
create policy "outline_sources_read" on public.outline_sources for select using (true);

-- ── Coverage, in one row ────────────────────────────────────────────────────
create or replace function public.outline_coverage()
returns table (term text, total bigint, ok bigint, missing bigint, failed bigint, pending bigint)
language sql security definer set search_path = public stable as $$
  select coalesce(s.term, 'unknown'),
         count(*),
         count(*) filter (where s.status = 'ok'),
         count(*) filter (where s.status = 'missing'),
         count(*) filter (where s.status in ('parse_failed', 'no_text')),
         count(*) filter (where s.status = 'pending')
    from public.outline_sources s
   group by 1
   order by 1;
$$;
grant execute on function public.outline_coverage() to authenticated;

-- ── Schedule (OPTIONAL — this file is useful without it) ────────────────────
--
-- The schema above is the part that matters: it is what /api/sync-outlines and
-- db/outlines_econcordia_fall2026.sql need. Scheduling is a convenience on top.
--
-- An earlier version of this file RAISED when it could not find CRON_SECRET,
-- which aborted the whole migration — so a missing cron job stopped the tables
-- from being created at all. That was backwards. It now reports and skips, and
-- everything above is already committed by the time it runs.
--
-- The secret is lifted out of an existing job rather than pasted through a
-- terminal. If no job carries one, see "SCHEDULE BY HAND" at the bottom.

do $outer$
declare
  v_secret text;
  v_url    text := 'https://concordiatracker.com/api/sync-catalog?job=outlines';
  v_has_cron boolean;
begin
  -- pg_cron may not be installed on this project at all.
  select exists (select 1 from pg_extension where extname = 'pg_cron') into v_has_cron;
  if not v_has_cron then
    begin
      create extension if not exists pg_cron;
      create extension if not exists pg_net;
      v_has_cron := true;
    exception when others then
      raise notice 'SKIPPED scheduling: pg_cron is not available here (%). The tables above are created; run the sync from Vercel Cron or by hand.', sqlerrm;
      return;
    end;
  end if;

  -- Any of our jobs will do — whichever one exists carries the same secret.
  select substring(j.command from 'Bearer ([^'']+)')
    into v_secret
  from cron.job j
  where j.command like '%Bearer %'
  order by (j.jobname = 'ct-run-reminders') desc
  limit 1;

  if v_secret is null then
    raise notice '────────────────────────────────────────────────────────────';
    raise notice 'TABLES CREATED. Scheduling SKIPPED: no existing cron job to read CRON_SECRET from.';
    raise notice 'Nothing is broken — /api/sync-outlines just will not fire on its own yet.';
    raise notice 'To schedule it, copy the SCHEDULE BY HAND block at the bottom of this';
    raise notice 'file and paste your CRON_SECRET from Vercel into it.';
    raise notice 'Existing jobs right now: %', coalesce((select string_agg(jobname, ', ') from cron.job), '(none)');
    raise notice '────────────────────────────────────────────────────────────';
    return;
  end if;

  if exists (select 1 from cron.job where jobname = 'ct-sync-outlines') then
    perform cron.unschedule('ct-sync-outlines');
  end if;

  -- Every 6 hours. Each run discovers the catalogue and parses a SMALL BATCH,
  -- because 45 PDFs through a model does not fit in one function invocation.
  -- At the start of a term that converges over a day; for the rest of it the
  -- same schedule is the re-check, since an unchanged PDF costs one GET.
  perform cron.schedule(
    'ct-sync-outlines',
    '20 */6 * * *',
    format(
      $job$
      select net.http_post(
        url     := %L,
        headers := jsonb_build_object('Content-Type', 'application/json',
                                      'Authorization', 'Bearer ' || %L),
        body    := '{}'::jsonb
      );
      $job$, v_url, v_secret)
  );
  raise notice 'Scheduled ct-sync-outlines (every 6 hours).';
end
$outer$;

-- ── SCHEDULE BY HAND ────────────────────────────────────────────────────────
-- Only needed if the block above said it skipped. Replace PASTE_SECRET_HERE
-- with CRON_SECRET from your Vercel environment variables, uncomment, run.
--
--   select cron.schedule(
--     'ct-sync-outlines',
--     '20 */6 * * *',
--     $job$
--     select net.http_post(
--       url     := 'https://concordiatracker.com/api/sync-catalog?job=outlines',
--       headers := jsonb_build_object('Content-Type', 'application/json',
--                                     'Authorization', 'Bearer PASTE_SECRET_HERE'),
--       body    := '{}'::jsonb
--     );
--     $job$
--   );

-- Check:
--   select * from public.outline_coverage();
--   select status, count(*) from public.outline_sources group by 1;
--   select jobname, schedule from cron.job;            -- is it scheduled?
