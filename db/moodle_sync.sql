-- ============================================================================
-- Moodle calendar sync.
-- RUN IN: Supabase SQL Editor. Safe to re-run.
--
-- A student pastes ONE link from Moodle (Calendar → Export → Get calendar
-- URL) and their Moodle deadlines appear in ConcordiaTracker, re-checked
-- every night.
--
-- THE SECURITY PROBLEM THIS FILE EXISTS TO SOLVE
-- ----------------------------------------------
-- That link is a CAPABILITY URL. It looks like:
--
--   https://moodle.concordia.ca/moodle/calendar/export_execute.php
--     ?userid=12345&authtoken=<40 hex chars>&preset_what=all&...
--
-- Anyone holding it can read that person's entire Moodle calendar, forever,
-- with no login. It is not a password — it cannot change their marks or read
-- their mail — but it is a credential, and it must be treated as one.
--
-- So the URL is stored in a column that **nobody can SELECT through the API,
-- not even the person it belongs to**. Row-level security cannot do that: RLS
-- filters ROWS. Column-level GRANTs can, and that is what is used below —
-- `authenticated` is granted select on every column EXCEPT `ics_url`.
--
-- The only reader is the server, using the service role, at sync time. The
-- client sees status, last sync, error and counts: everything needed to show
-- the state of the connection and nothing that could leak the token.
-- ============================================================================

create table if not exists public.moodle_connections (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  -- The capability URL. NEVER granted to `authenticated` (see the revoke below).
  ics_url       text not null,
  -- Shown to the student so a silent failure is visible rather than mysterious.
  status        text not null default 'active'
                check (status in ('active', 'error', 'paused')),
  last_sync_at  timestamptz,
  last_error    text,
  event_count   integer not null default 0,
  created_at    timestamptz not null default now()
);

alter table public.moodle_connections enable row level security;

-- Own row only, both directions.
drop policy if exists "moodle_select_own" on public.moodle_connections;
create policy "moodle_select_own" on public.moodle_connections
  for select using (auth.uid() = user_id);

drop policy if exists "moodle_delete_own" on public.moodle_connections;
create policy "moodle_delete_own" on public.moodle_connections
  for delete using (auth.uid() = user_id);

-- NO insert or update policy. Connecting goes through the server, which
-- validates the URL and proves it works before storing anything — a client
-- that could insert directly could store a link to any host it liked and make
-- our server fetch it (a server-side request forgery, using us as the proxy).

-- ── The column-level grant: this is the whole point ─────────────────────────
-- Take everything away, then hand back each column BY NAME except ics_url.
-- A `select *` by the owner returns every other column and omits this one;
-- asking for it directly is a permission error. The token cannot be read back
-- out of the API by anyone, which also means a compromised session cannot
-- exfiltrate it.
revoke all on public.moodle_connections from authenticated, anon;
grant select (user_id, status, last_sync_at, last_error, event_count, created_at)
  on public.moodle_connections to authenticated;
grant delete on public.moodle_connections to authenticated;

-- ── Synced items live in `todos`, tagged so a re-sync is idempotent ─────────
-- Moodle deadlines land in the personal-calendar layer the app already has,
-- rather than becoming assessments: an assessment carries a WEIGHT and counts
-- toward a grade, and Moodle does not tell us the weight. Inventing a zero
-- would quietly distort the grade breakdown.
alter table public.todos
  add column if not exists source      text,   -- null = the student typed it
  add column if not exists external_id text;   -- the iCalendar UID

-- One row per (person, Moodle event). This index is what makes the sync
-- idempotent: the nightly run upserts on it, so re-reading the same calendar
-- updates in place instead of adding a duplicate every night.
--
-- IT MUST NOT BE PARTIAL. The first version carried `where external_id is not
-- null`, which reads as the careful choice and breaks the only thing the index
-- exists for: Postgres refuses `ON CONFLICT (user_id, external_id)` against a
-- partial index unless the statement repeats the index predicate, and
-- PostgREST has no way to add one. The sync failed with
--   42P10: there is no unique or exclusion constraint matching the ON CONFLICT
-- A FULL unique index is correct AND safe here, because unique indexes treat
-- NULLs as distinct: a student can still have any number of hand-typed todos,
-- all with external_id null. (Verified in Postgres both ways before changing.)
drop index if exists public.todos_external_uid_idx;
create unique index if not exists todos_external_uid_idx
  on public.todos (user_id, external_id);

-- When a synced deadline MOVES, we keep the date it moved from.
--
-- Silently rewriting the date would be the worst version of this feature: the
-- student looks at their calendar, sees a different day than they remember,
-- and cannot tell whether the professor moved it or they misread it. Keeping
-- the old value lets the item say "moved from Oct 12" and lets them clear the
-- note once they have seen it. Null means it has never moved.
alter table public.todos
  add column if not exists moved_from timestamptz;

-- Clear the note once it has been read. Scoped to the caller's own rows.
create or replace function public.ack_todo_move(p_id uuid)
returns void
language sql security definer set search_path = public as $$
  update public.todos set moved_from = null
   where id = p_id and user_id = auth.uid();
$$;
grant execute on function public.ack_todo_move(uuid) to authenticated;

create index if not exists todos_source_idx on public.todos (user_id, source)
  where source is not null;

-- ── Status for the UI ───────────────────────────────────────────────────────
-- A plain view would re-expose ics_url to anyone who could select it, so this
-- is a function that returns only the safe columns plus a derived `connected`.
create or replace function public.my_moodle_status()
returns jsonb
language sql security definer set search_path = public stable as $$
  select coalesce(
    (select jsonb_build_object(
       'connected',   true,
       'status',      c.status,
       'last_sync_at', c.last_sync_at,
       'last_error',  c.last_error,
       'event_count', c.event_count,
       'created_at',  c.created_at,
       -- How many of those items are still ahead of them. The count of events
       -- in the feed is a fact about Moodle; this is the one they care about.
       'upcoming',    (select count(*) from public.todos t
                        where t.user_id = c.user_id
                          and t.source = 'moodle'
                          and t.due > now())
     )
     from public.moodle_connections c
     where c.user_id = auth.uid()),
    jsonb_build_object('connected', false)
  );
$$;
grant execute on function public.my_moodle_status() to authenticated;

-- Disconnecting removes the synced items too. Leaving them behind would mean
-- deadlines from a source you have deliberately unplugged, with no way left to
-- refresh or remove them in bulk.
create or replace function public.disconnect_moodle()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  removed integer;
begin
  if uid is null then return 0; end if;
  delete from public.todos where user_id = uid and source = 'moodle';
  get diagnostics removed = row_count;
  delete from public.moodle_connections where user_id = uid;
  return removed;
end;
$$;
grant execute on function public.disconnect_moodle() to authenticated;

-- Check:
--   select * from public.my_moodle_status();
--   -- this must FAIL for a normal signed-in user, and that is the point:
--   select ics_url from public.moodle_connections;
