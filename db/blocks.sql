-- ============================================================================
-- Blocking, and a social graph the admin console can actually read.
--
-- Run in the Supabase SQL editor. Idempotent.
--
-- THREE THINGS, one migration, because they are one subject:
--   1. You can always see your OWN profile. (A real bug: internal accounts
--      were hidden from everyone, including their owner.)
--   2. Blocking — neither person can see or message the other.
--   3. Admin can read who blocked whom and who follows whom.
-- ============================================================================

-- ── 1. The table ────────────────────────────────────────────────────────────
/**
 * A block is stored ONE WAY and applied BOTH ways.
 *
 * One row saying "A blocked B" is the fact. Mirroring it into a second row so
 * each side has its own is two rows to keep in step, and they will eventually
 * disagree — an unblock that only deletes one leaves a block nobody can see or
 * lift. Every read goes through ct_blocked_between(), which checks the pair in
 * either order, so the SYMMETRY lives in one function instead of in the data.
 */
create table if not exists public.profile_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  -- Blocking yourself is not a thing, and would make your own profile vanish.
  constraint profile_blocks_not_self check (blocker_id <> blocked_id)
);

create index if not exists profile_blocks_blocked_idx
  on public.profile_blocks (blocked_id);

alter table public.profile_blocks enable row level security;

/**
 * ONLY THE BLOCKER CAN READ THE ROW.
 *
 * The person who was blocked is never told. To them the other profile simply
 * stops existing — the same answer they would get for a handle nobody ever
 * took — because "you have been blocked by Sarah" is itself a message from
 * someone who asked not to be in contact, and it is what turns a block into
 * an escalation.
 */
drop policy if exists "read own blocks" on public.profile_blocks;
create policy "read own blocks" on public.profile_blocks
  for select using (blocker_id = auth.uid());

-- Writes go through the RPCs below so that blocking can also DISCONNECT in the
-- same breath; a bare insert would leave the friendship and the follow intact.
-- No insert/update/delete policy at all, deliberately.

-- ── 2. The one place the symmetry lives ─────────────────────────────────────
create or replace function public.ct_blocked_between(a uuid, b uuid)
returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.profile_blocks x
     where (x.blocker_id = a and x.blocked_id = b)
        or (x.blocker_id = b and x.blocked_id = a)
  );
$$;

-- ── 3. Block / unblock ──────────────────────────────────────────────────────
/**
 * Blocking DISCONNECTS as well as hides.
 *
 * Leaving the friendship in place would leave a live message thread between
 * two people who cannot see each other, and leaving the follow in place would
 * keep feeding one of them the other's activity. A block that does not undo
 * the connection is a half-block, and the half that is missing is the half
 * that matters.
 */
create or replace function public.block_user(p_handle text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_me     uuid := auth.uid();
  v_them   uuid;
begin
  if v_me is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;

  select p.user_id into v_them
    from public.user_profile p
   where lower(p.handle) = lower(trim(p_handle))
   limit 1;

  if v_them is null then
    raise exception 'No account with that handle.' using errcode = 'P0002';
  end if;
  if v_them = v_me then
    raise exception 'You cannot block yourself.' using errcode = '22023';
  end if;

  insert into public.profile_blocks (blocker_id, blocked_id)
  values (v_me, v_them)
  on conflict (blocker_id, blocked_id) do nothing;

  -- Both directions of both relationships. A block is not a request.
  -- Column names measured against production: requester / addressee, NOT
  -- requester_id / addressee_id.
  delete from public.friendships f
   where (f.requester = v_me and f.addressee = v_them)
      or (f.requester = v_them and f.addressee = v_me);

  -- user_follows, NOT profile_follows. Two migrations created a table for
  -- the same job; measured against production, user_follows is the one the
  -- app writes to and profile_follows has 0 rows. Its columns are
  -- follower / following, without the _id.
  delete from public.user_follows f
   where (f.follower = v_me and f.following = v_them)
      or (f.follower = v_them and f.following = v_me);

  return jsonb_build_object('blocked', true, 'handle', lower(trim(p_handle)));
end $$;

create or replace function public.unblock_user(p_handle text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_me   uuid := auth.uid();
  v_them uuid;
begin
  if v_me is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;

  select p.user_id into v_them
    from public.user_profile p
   where lower(p.handle) = lower(trim(p_handle))
   limit 1;

  if v_them is null then
    raise exception 'No account with that handle.' using errcode = 'P0002';
  end if;

  -- Unblocking restores NOTHING. The friendship and the follow were deleted,
  -- not suspended; getting them back is a fresh request, which is the honest
  -- shape — the other person agreed to the first one, not to its revival.
  delete from public.profile_blocks x
   where x.blocker_id = v_me and x.blocked_id = v_them;

  return jsonb_build_object('blocked', false, 'handle', lower(trim(p_handle)));
end $$;

/** Did I block this handle? Used to render Block vs Unblock. */
create or replace function public.have_i_blocked(p_handle text)
returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1
      from public.profile_blocks x
      join public.user_profile p on p.user_id = x.blocked_id
     where x.blocker_id = auth.uid()
       and lower(p.handle) = lower(trim(p_handle))
  );
$$;

/** The people I have blocked, for a Settings list that can undo it. */
create or replace function public.my_blocks()
returns table (handle text, name text, avatar_url text, created_at timestamptz)
language sql security definer set search_path = public stable as $$
  select p.handle, p.name, p.avatar_url, x.created_at
    from public.profile_blocks x
    join public.user_profile p on p.user_id = x.blocked_id
   where x.blocker_id = auth.uid()
   order by x.created_at desc;
$$;

grant execute on function public.block_user(text)    to authenticated;
grant execute on function public.unblock_user(text)  to authenticated;
grant execute on function public.have_i_blocked(text) to authenticated;
grant execute on function public.my_blocks()         to authenticated;
revoke all on function public.ct_blocked_between(uuid, uuid) from anon, authenticated;

-- ── 4. THE BUG: you could not see your own profile ──────────────────────────
/**
 * An internal account was hidden from EVERYONE, including its owner.
 *
 * `and coalesce(p.is_internal, false) = false` was added so test and staff
 * accounts are not findable by students — which is right — but the profile
 * page reads the same function, so the owner of an internal account opened
 * Community -> You and was told "@sarah isn't here". Flipping the profile to
 * public changed nothing, because the filter was never about public.
 *
 * THE RULE: you can always see yourself. Discovery rules are about other
 * people; they are not a reason to hide someone from their own account.
 * Blocking is checked here too, so a blocked profile reads exactly like a
 * handle that was never registered.
 */
create or replace function public.get_public_profile(p_handle text)
returns table (
  handle text,
  is_public boolean,
  name text,
  avatar_url text,
  program text,
  program_id text,
  bio text,
  links jsonb,
  courses_public boolean
)
language sql security definer set search_path = public stable as $$
  select
    p.handle,
    coalesce(p.profile_public, false) as is_public,
    p.name,
    p.avatar_url,
    -- `or mine` on every gated field: looking at your own profile shows you
    -- YOUR data, not the redacted version a stranger would get. Without it a
    -- private account opens its own page onto a name and nothing else, which
    -- reads as broken rather than as private.
    case when p.profile_public or p.user_id = auth.uid() then p.program end,
    case when p.profile_public or p.user_id = auth.uid() then p.program_id end,
    case when p.profile_public or p.user_id = auth.uid() then p.bio end,
    case when p.profile_public or p.user_id = auth.uid()
         then coalesce(p.links, '{}'::jsonb) else '{}'::jsonb end,
    coalesce(p.courses_public, false)
  from public.user_profile p
  where lower(p.handle) = lower(trim(p_handle))
    -- Yourself, always — whatever the flags say.
    and (
      p.user_id = auth.uid()
      or (
        coalesce(p.is_internal, false) = false
        and not public.ct_blocked_between(auth.uid(), p.user_id)
      )
    )
  limit 1;
$$;
grant execute on function public.get_public_profile(text) to anon, authenticated;

create or replace function public.get_public_courses(p_handle text)
returns table (code text, title text, color text, term text)
language sql security definer set search_path = public stable as $$
  select c.code, c.name as title, c.color, c.term
  from public.courses c
  join public.user_profile p on p.user_id = c.user_id
  where lower(p.handle) = lower(trim(p_handle))
    and coalesce(c.archived, false) = false
    and (
      -- Your own classes do not need the switch on to be shown to you.
      p.user_id = auth.uid()
      or (
        coalesce(p.courses_public, false) = true
        and coalesce(p.is_internal, false) = false
        and not public.ct_blocked_between(auth.uid(), p.user_id)
      )
    )
  order by c.term desc, c.code;
$$;
grant execute on function public.get_public_courses(text) to anon, authenticated;

-- ── 5. A blocked person is not in your search results ───────────────────────
create or replace function public.search_public_profiles(p_q text, p_limit int default 8)
returns table (
  handle         text,
  name           text,
  avatar_url     text,
  program        text,
  follower_count int,
  is_public      boolean
)
language sql security definer set search_path = public stable as $$
  select
    p.handle,
    p.name,
    p.avatar_url,
    case when p.profile_public then p.program end,
    -- WAS profile_follows, which is empty, so every follower count in search
    -- read 0 no matter who you were looking at. The app follows through
    -- user_follows.
    case when p.profile_public
         then (select count(*)::int from public.user_follows f where f.following = p.user_id)
         else 0 end,
    coalesce(p.profile_public, false)
  from public.user_profile p
  where coalesce(p.handle, '') <> ''
    and coalesce(p.is_internal, false) = false
    and not public.ct_blocked_between(auth.uid(), p.user_id)
    and length(coalesce(trim(p_q), '')) > 0
    and (p.handle ilike '%' || trim(p_q) || '%' or p.name ilike '%' || trim(p_q) || '%')
  order by
    case when lower(p.handle) = lower(trim(p_q)) then 0 else 1 end,
    case when p.handle ilike trim(p_q) || '%' then 0 else 1 end,
    p.handle
  limit greatest(1, least(coalesce(p_limit, 8), 25));
$$;
grant execute on function public.search_public_profiles(text, int) to anon, authenticated;

-- ── 6. What the admin console reads ─────────────────────────────────────────
/**
 * The social graph, as COUNTS plus a recent list.
 *
 * Admin-gated in the function, not on the screen. Blocks are the sensitive
 * half: a block is a statement one student made about another, and it is
 * readable here only because moderating harassment is impossible without it.
 * It is never shown to the blocked person and never leaves this console.
 */
create or replace function public.admin_social_graph(p_limit int default 50)
returns jsonb
language sql security definer set search_path = public stable as $$
  select case when public.is_admin() then jsonb_build_object(
    'generated_at', now(),
    'counts', jsonb_build_object(
      'blocks',      (select count(*)::int from public.profile_blocks),
      'follows',     (select count(*)::int from public.user_follows),
      'friendships', (select count(*)::int from public.friendships where status = 'accepted'),
      'pending',     (select count(*)::int from public.friendships where status = 'pending')
    ),
    'blocks', coalesce((
      select jsonb_agg(row_to_json(r))
      from (
        select
          br.handle as blocker_handle, br.name as blocker_name,
          bd.handle as blocked_handle, bd.name as blocked_name,
          x.created_at
        from public.profile_blocks x
        join public.user_profile br on br.user_id = x.blocker_id
        join public.user_profile bd on bd.user_id = x.blocked_id
        order by x.created_at desc
        limit greatest(1, least(coalesce(p_limit, 50), 200))
      ) r
    ), '[]'::jsonb),
    'follows', coalesce((
      select jsonb_agg(row_to_json(r))
      from (
        select
          fr.handle as follower_handle, fr.name as follower_name,
          fg.handle as following_handle, fg.name as following_name,
          f.created_at
        from public.user_follows f
        join public.user_profile fr on fr.user_id = f.follower
        join public.user_profile fg on fg.user_id = f.following
        order by f.created_at desc nulls last
        limit greatest(1, least(coalesce(p_limit, 50), 200))
      ) r
    ), '[]'::jsonb),
    -- Who is blocked MOST. One person collecting blocks is the signal that
    -- matters; a single block between two people usually is not.
    'most_blocked', coalesce((
      select jsonb_agg(row_to_json(r))
      from (
        select p.handle, p.name, count(*)::int as blocked_by
        from public.profile_blocks x
        join public.user_profile p on p.user_id = x.blocked_id
        group by p.handle, p.name
        having count(*) > 1
        order by count(*) desc
        limit 20
      ) r
    ), '[]'::jsonb)
  ) else '{}'::jsonb end;
$$;
grant execute on function public.admin_social_graph(int) to authenticated;

-- ── Check ───────────────────────────────────────────────────────────────────
--   select * from public.get_public_profile('<your own handle>');  -- a row, always
--   select public.ct_blocked_between('<a>','<b>');
--   select jsonb_pretty(public.admin_social_graph(10));
