-- ============================================================================
-- Saved schedules: several drafts of a term, and a link to show someone.
-- RUN IN: Supabase SQL Editor. Safe to re-run.
--
-- The chosen sections are stored as JSON rather than as rows pointing at the
-- catalogue. A schedule is a SNAPSHOT of a decision: it should still open next
-- year when the section has been renumbered, the course renamed, or the seat
-- counts long since changed. Normalising it would make it rot.
-- ============================================================================

create table if not exists public.saved_schedules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null default 'Untitled schedule',
  term_code   text,
  /** [{ code, classNumber, section, component, meetingTimes, location, ... }] */
  sections    jsonb not null default '[]'::jsonb,
  /** Times the student has blocked out: [{ day, start, end, label }] */
  blocks      jsonb not null default '[]'::jsonb,
  /** Set only when they choose to share. NULL means the link does not exist,
   *  which is the difference between private-by-default and
   *  private-until-someone-guesses. */
  share_token text unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists saved_schedules_user_idx on public.saved_schedules (user_id);

alter table public.saved_schedules enable row level security;

drop policy if exists "schedules_select_own" on public.saved_schedules;
drop policy if exists "schedules_insert_own" on public.saved_schedules;
drop policy if exists "schedules_update_own" on public.saved_schedules;
drop policy if exists "schedules_delete_own" on public.saved_schedules;

-- Owner-only through the table. A shared schedule is readable ONLY through the
-- token function below, never by widening this policy: an "or share_token is
-- not null" policy would let anyone enumerate every shared schedule on the
-- platform, which is not what sharing one link means.
create policy "schedules_select_own" on public.saved_schedules for select using (auth.uid() = user_id);
create policy "schedules_insert_own" on public.saved_schedules for insert with check (auth.uid() = user_id);
create policy "schedules_update_own" on public.saved_schedules for update using (auth.uid() = user_id);
create policy "schedules_delete_own" on public.saved_schedules for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.saved_schedules to authenticated;

/**
 * Read a shared schedule by its token.
 *
 * SECURITY DEFINER so it can see past the owner-only policy, and deliberately
 * narrow: it takes the token, returns the schedule, and returns NOTHING that
 * identifies the owner. A share link says "here is a timetable", not "here is
 * whose timetable".
 */
create or replace function public.schedule_by_token(p_token text)
returns table (name text, term_code text, sections jsonb, blocks jsonb, created_at timestamptz)
language sql security definer set search_path = public stable as $$
  select s.name, s.term_code, s.sections, s.blocks, s.created_at
  from public.saved_schedules s
  where s.share_token = p_token
    and coalesce(trim(p_token), '') <> '';
$$;
grant execute on function public.schedule_by_token(text) to anon, authenticated;

/** Mint a share token, or return the existing one so a link stays stable. */
create or replace function public.share_schedule(p_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_token text;
begin
  select share_token into v_token
  from public.saved_schedules
  where id = p_id and user_id = auth.uid();

  if not found then
    raise exception 'Schedule not found.';
  end if;

  if v_token is null then
    -- gen_random_uuid() is built in; gen_random_bytes() needs pgcrypto, which
    -- is one more thing that has to be enabled for a share link to work.
    v_token := replace(gen_random_uuid()::text, '-', '');
    update public.saved_schedules
       set share_token = v_token, updated_at = now()
     where id = p_id and user_id = auth.uid();
  end if;

  return v_token;
end $$;
grant execute on function public.share_schedule(uuid) to authenticated;

/** Revoke a link. The schedule stays; the URL stops working. */
create or replace function public.unshare_schedule(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.saved_schedules
     set share_token = null, updated_at = now()
   where id = p_id and user_id = auth.uid();
$$;
grant execute on function public.unshare_schedule(uuid) to authenticated;
