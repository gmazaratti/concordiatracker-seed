-- ── Activity notes: a line above your face saying what you are up to ────────
--
-- The row of small bubbles above the conversation list. Here it is not "a
-- note" in the abstract, it is WHAT YOU ARE DOING — "At the library", "In
-- class till 4", "Free after 3" — because that is the question the people in
-- this list actually want answered about each other, and it is the one thing
-- a campus messenger can say that a general one cannot.
--
-- IT EXPIRES, and that is the feature rather than a limitation. A status with
-- no end becomes a bio: nobody updates it, everybody stops reading it, and
-- the row turns into decoration. Twenty-four hours means every note on the
-- row was written today.
--
-- WHO SEES IT: people you are connected to, meaning a mutual follow, and
-- nobody else. Not followers, not the public. Saying where you are on campus
-- is a different thing from posting, and it should reach exactly the people
-- you would have told.
--
-- Writes go through the RPCs, so there is no insert/update/delete policy at
-- all: `user_id` is taken from the session and can never be supplied.
--
-- RUN in the Supabase SQL editor. Safe to re-run.

create table if not exists public.user_notes (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);

do $$ begin
  alter table public.user_notes
    add constraint user_notes_body_len check (char_length(btrim(body)) between 1 and 60);
exception when duplicate_object then null; end $$;

create index if not exists user_notes_live_idx on public.user_notes (expires_at);

alter table public.user_notes enable row level security;

-- Your own row, so a client can tell whether you have one without asking the
-- feed. Everyone else's arrives through notes_feed(), which applies the
-- mutual check; a plain select policy here could not.
drop policy if exists user_notes_read_own on public.user_notes;
create policy user_notes_read_own on public.user_notes
  for select to authenticated using (user_id = auth.uid());

/** Write or replace your note. Re-posting restarts the 24 hours. */
create or replace function public.set_my_note(p_body text)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v_body text := btrim(coalesce(p_body, '')); v_exp timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;
  if v_body = '' then
    raise exception 'A note needs some words.' using errcode = '22023';
  end if;
  if char_length(v_body) > 60 then
    raise exception 'A note can be at most 60 characters.' using errcode = '22023';
  end if;

  insert into public.user_notes (user_id, body, created_at, expires_at)
  values (auth.uid(), v_body, now(), now() + interval '24 hours')
  on conflict (user_id) do update
    set body = excluded.body, created_at = now(), expires_at = now() + interval '24 hours'
  returning expires_at into v_exp;

  return v_exp;
end;
$$;
grant execute on function public.set_my_note(text) to authenticated;

create or replace function public.clear_my_note()
returns void
language sql security definer set search_path = public as $$
  delete from public.user_notes where user_id = auth.uid();
$$;
grant execute on function public.clear_my_note() to authenticated;

/**
 * Your note first, then your connections', newest first.
 *
 * Yours leads whether or not you have written one — the row's first slot is
 * how you set it, so it cannot be sorted away by somebody else being more
 * recent. The caller renders an empty first slot as the prompt.
 */
create or replace function public.notes_feed()
returns table (
  user_id    uuid,
  handle     text,
  name       text,
  avatar_url text,
  body       text,
  created_at timestamptz,
  is_mine    boolean
)
language sql stable security definer set search_path = public as $$
  select n.user_id, p.handle, p.name, p.avatar_url, n.body, n.created_at,
         n.user_id = auth.uid()
    from public.user_notes n
    join public.user_profile p on p.user_id = n.user_id
   where n.expires_at > now()
     and auth.uid() is not null
     and (n.user_id = auth.uid() or public.ct_is_mutual(auth.uid(), n.user_id))
   order by (n.user_id = auth.uid()) desc, n.created_at desc
   limit 50;
$$;
grant execute on function public.notes_feed() to authenticated;
