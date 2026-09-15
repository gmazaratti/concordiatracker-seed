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

-- ── Schedule ────────────────────────────────────────────────────────────────
-- Same pattern as db/sync_catalog_cron.sql: the secret is lifted out of the
-- reminders job rather than pasted through a terminal.
--
-- Cadence: every 6 hours. Each run discovers the catalogue and then parses a
-- SMALL BATCH, because 45 PDFs through a model does not fit in one function
-- invocation. At the start of a term that converges over a day; for the rest
-- of it the same schedule is the weekly-ish re-check the brief asks for, since
-- an unchanged PDF costs one GET and stops.
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $outer$
declare
  v_secret text;
  v_url    text := 'https://concordiatracker.com/api/sync-outlines';
begin
  select substring(j.command from 'Bearer ([^'']+)')
    into v_secret
  from cron.job j
  where j.jobname = 'ct-run-reminders'
  limit 1;

  if v_secret is null then
    raise exception
      'Could not read CRON_SECRET from the ct-run-reminders job. Run db/reminders.sql first, or schedule this by hand with the secret from Vercel.';
  end if;

  if exists (select 1 from cron.job where jobname = 'ct-sync-outlines') then
    perform cron.unschedule('ct-sync-outlines');
  end if;

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
end
$outer$;

-- Check:
--   select * from public.outline_coverage();
--   select status, count(*) from public.outline_sources group by 1;
