-- ============================================================================
-- Personal calendar: notes you can actually write, a checklist, and repeats.
-- Run in the SQL editor. Idempotent.
--
-- `todos` already had `note` and has since Phase 4 — it was readable in the
-- calendar row and there was no way in the entire UI to put anything in it.
-- Nothing here replaces that column; two of its three gaps were in the client.
-- ============================================================================

-- A checklist lives ON the task rather than in a second table. A step has no
-- date, no notification, no identity worth referencing from anywhere else —
-- it is a line in one item, and a table would buy a join and a second RLS
-- policy for nothing. If a step ever needs a due date of its own it is a task.
alter table public.todos add column if not exists steps jsonb not null default '[]'::jsonb;

-- Marks the occurrences created by one "repeat until" as a series, so the
-- whole run can be removed together. Materialised rows rather than a rule
-- evaluated at render, for the reason the Reggies night is: the calendar and
-- Today have to show and TICK a specific day, and a rule cannot be ticked.
alter table public.todos add column if not exists repeat_group text;

create index if not exists todos_repeat_group_idx on public.todos (repeat_group)
  where repeat_group is not null;

-- Shape-check the checklist so a malformed write cannot reach the client as a
-- crash. Same discipline as valid_translations().
create or replace function public.ct_valid_steps(v jsonb) returns boolean
language sql immutable as $$
  select v is null
      or (jsonb_typeof(v) = 'array'
          and not exists (
            select 1 from jsonb_array_elements(v) e
             where jsonb_typeof(e) <> 'object'
                or jsonb_typeof(e -> 'text') <> 'string'
                or jsonb_typeof(e -> 'done') <> 'boolean'))
$$;

alter table public.todos drop constraint if exists todos_steps_shape;
alter table public.todos add constraint todos_steps_shape check (public.ct_valid_steps(steps));

-- Deleting a repeat means deleting the ones that have NOT happened yet.
-- Removing days you already ticked off would erase a record of work done, and
-- "stop reminding me" is never a request to rewrite the past.
create or replace function public.delete_todo_series(p_group text, p_from timestamptz default now())
returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from public.todos
   where user_id = auth.uid()
     and repeat_group = p_group
     and (due is null or due >= p_from);
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.delete_todo_series(text, timestamptz) from public;
grant execute on function public.delete_todo_series(text, timestamptz) to authenticated;
