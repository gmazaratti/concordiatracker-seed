-- Saving a post or an event, privately.
--
-- PRIVATE IS THE WHOLE POINT, and it is what separates this from a repost.
-- A repost is a statement — it goes on your profile under your name. A save is
-- a bookmark: nobody is told, the club cannot count it, and it appears only on
-- your own profile. So the RLS is select-OWN, not select-all, and there is no
-- count function anywhere. If a "saves" number ever turns up on a post, this
-- table is the wrong source for it.
--
-- ONE TABLE FOR BOTH KINDS, same shape and same reasoning as `reposts`:
-- `target_id` is text because events carry text ids (`ev-techfair`) and posts
-- carry uuids, and the Saved tab shows them together.
--
-- RUN in the Supabase SQL editor. Safe to re-run.

create table if not exists public.saves (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  target_kind text not null check (target_kind in ('event', 'post')),
  target_id   text not null,
  created_at  timestamptz not null default now()
);

create unique index if not exists saves_unique_idx
  on public.saves (user_id, target_kind, target_id);
create index if not exists saves_user_idx on public.saves (user_id, created_at desc);

alter table public.saves enable row level security;

-- SELECT-OWN. Not "everyone can read, only you can write" — that would let a
-- club count how many people saved a post, which is exactly the signal a
-- bookmark is not supposed to produce.
drop policy if exists saves_select_own on public.saves;
create policy saves_select_own on public.saves
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists saves_insert_own on public.saves;
create policy saves_insert_own on public.saves
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists saves_delete_own on public.saves;
create policy saves_delete_own on public.saves
  for delete to authenticated using (auth.uid() = user_id);

/** Save or unsave. Returns the new state. */
create or replace function public.toggle_save(p_kind text, p_target text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare existing uuid;
begin
  if auth.uid() is null then return false; end if;
  if p_kind not in ('event', 'post') then return false; end if;

  select id into existing from public.saves
   where user_id = auth.uid() and target_kind = p_kind and target_id = p_target;

  if existing is not null then
    delete from public.saves where id = existing;
    return false;
  end if;

  insert into public.saves (user_id, target_kind, target_id) values (auth.uid(), p_kind, p_target);
  return true;
end; $$;
grant execute on function public.toggle_save(text, text) to authenticated;

/** Which of these have I saved — one call for a screenful, so a feed does not
 *  fire a request per card. */
create or replace function public.my_saved(p_kind text, p_targets text[])
returns setof text
language sql stable security definer set search_path = public as $$
  select s.target_id from public.saves s
   where s.user_id = auth.uid() and s.target_kind = p_kind
     and s.target_id = any (p_targets);
$$;
grant execute on function public.my_saved(text, text[]) to authenticated;

/** Everything I have saved, newest first — the Saved tab. */
create or replace function public.saved_list()
returns table (id uuid, target_kind text, target_id text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select s.id, s.target_kind, s.target_id, s.created_at
    from public.saves s
   where s.user_id = auth.uid()
   order by s.created_at desc
   limit 200;
$$;
grant execute on function public.saved_list() to authenticated;
