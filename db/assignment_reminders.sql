-- ── Assignment reminders: defaults + per-assignment offsets ──────────────────
--
-- WHO SENDS WHAT. The iPhone app schedules its OWN local notifications from
-- these settings (they fire offline, and nothing has to reach a server at the
-- right minute). Browsers cannot do that, so this file gives the cron a way to
-- send the same reminders as web pushes. The sender only ever pushes these to
-- WEB subscriptions, so a phone never gets the same reminder twice.
--
-- The settings live on user_profile.ui_state.assignmentReminders (the client
-- already writes ui_state and the server can read it). Absent = defaults:
-- on, 1 day + 1 hour before, the "cool" voice.
--
-- The OLD per-assignment reminder (public.reminders, kind 'assignment', one
-- lead time each) is copied into the new column below and then ignored by the
-- sender — rows are left in place, not deleted.
--
-- Safe to re-run.

alter table public.assignments
  add column if not exists reminders integer[] not null default '{}';

alter table public.assignments drop constraint if exists assignments_reminders_ck;
alter table public.assignments add constraint assignments_reminders_ck check (
  cardinality(reminders) <= 10
  and 0 < all (reminders)
  and 43200 >= all (reminders)
) not valid;

-- Carry the old single lead time across (once per assignment; re-running adds
-- nothing because the value is already present).
update public.assignments a
   set reminders = array_append(a.reminders, r.offset_minutes)
  from public.reminders r
 where r.kind = 'assignment'
   and r.ref_id = a.id::text
   and r.user_id = a.user_id
   and r.offset_minutes > 0
   and r.offset_minutes <= 43200
   and not (r.offset_minutes = any (a.reminders))
   and cardinality(a.reminders) < 10;

-- What has been sent, so a reminder goes out once. Keyed on the due time too:
-- a moved deadline is a new reminder.
create table if not exists public.assignment_reminder_sends (
  user_id        uuid not null references auth.users (id) on delete cascade,
  item_kind      text not null check (item_kind in ('assignment', 'moodle')),
  item_id        uuid not null,
  offset_minutes integer not null,
  due_at         timestamptz not null,
  sent_at        timestamptz not null default now(),
  primary key (item_kind, item_id, offset_minutes, due_at)
);
alter table public.assignment_reminder_sends enable row level security;
-- No policies: only the service role reads or writes it.
create index if not exists assignment_reminder_sends_sent_idx
  on public.assignment_reminder_sends (sent_at);

-- The reminders whose moment is NOW (within the last p_window), claimed so a
-- second cron run cannot send them again. Returns everything the sender needs
-- to write the words; the words themselves are composed in TypeScript
-- (src/lib/reminder-copy.ts), the same module the phone uses.
create or replace function public.claim_assignment_reminders(p_window interval default interval '20 minutes')
returns table (
  user_id uuid,
  item_kind text,
  item_id uuid,
  title text,
  course text,
  course_id text,
  due_at timestamptz,
  offset_minutes integer,
  tone text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with prefs as (
    select p.user_id as uid,
           coalesce((p.ui_state -> 'assignmentReminders' ->> 'enabled')::boolean, true) as enabled,
           coalesce(
             (select array_agg(x::int) from jsonb_array_elements_text(p.ui_state -> 'assignmentReminders' -> 'defaults') x
               where x ~ '^[0-9]+$'),
             case when p.ui_state -> 'assignmentReminders' ? 'defaults' then '{}'::int[] else array[1440, 60] end
           ) as defaults,
           case when p.ui_state -> 'assignmentReminders' ->> 'tone' = 'formal' then 'formal' else 'cool' end as tone
      from public.user_profile p
  ),
  items as (
    select a.user_id as uid, 'assignment'::text as kind, a.id as iid, a.title as ititle,
           coalesce(c.code, '') as icourse, a.course_id as icourse_id, a.date as idue, a.reminders as own
      from public.assignments a
      left join public.courses c on c.id = a.course_id
     where coalesce(a.deleted, false) = false
       and coalesce(a.done, false) = false
       and coalesce(a.status, 'not-started') in ('not-started', 'in-progress', 'extension')
       and a.date is not null
       and a.date > now()
       and a.date < now() + interval '31 days'
    union all
    select t.user_id, 'moodle', t.id, t.title, '', null, t.due, '{}'::int[]
      from public.todos t
     where t.source = 'moodle'
       and coalesce(t.done, false) = false
       and t.due > now()
       and t.due < now() + interval '31 days'
  ),
  due_now as (
    select i.uid, i.kind, i.iid, i.ititle, i.icourse, i.icourse_id, i.idue, o.off, pr.tone
      from items i
      join prefs pr on pr.uid = i.uid and pr.enabled
      cross join lateral (
        select distinct unnest(pr.defaults || i.own) as off
      ) o
     where o.off > 0
       and i.idue - make_interval(mins => o.off) <= now()
       and i.idue - make_interval(mins => o.off) > now() - p_window
  ),
  claimed as (
    insert into public.assignment_reminder_sends (user_id, item_kind, item_id, offset_minutes, due_at)
    select d.uid, d.kind, d.iid, d.off, d.idue from due_now d
    on conflict do nothing
    returning assignment_reminder_sends.item_kind, assignment_reminder_sends.item_id,
              assignment_reminder_sends.offset_minutes, assignment_reminder_sends.due_at
  )
  select d.uid, d.kind, d.iid, d.ititle, d.icourse, d.icourse_id, d.idue, d.off, d.tone
    from due_now d
    join claimed cl
      on cl.item_kind = d.kind and cl.item_id = d.iid
     and cl.offset_minutes = d.off and cl.due_at = d.idue;
end;
$$;

revoke all on function public.claim_assignment_reminders(interval) from public, anon, authenticated;
grant execute on function public.claim_assignment_reminders(interval) to service_role;
