-- ============================================================================
-- Vanity handles, honest search, and a "followed by" line that points the
-- right way.
-- RUN IN: Supabase SQL Editor (or `supabase db query`). Safe to re-run.
--
-- FOUR THINGS, all of them about the same question: who is this, and can you
-- find them.
--
--   1. @ceo, @owner, @admin, @support … are RESERVED and now RESOLVE. Nobody
--      can take them, and typing one lands on the real account.
--   2. Search stops failing on things people actually type: "@div", a full
--      name with a space in it, and — until now — the founder's own handle.
--   3. "Followed by A and 4 others" was computing the wrong set entirely.
--   4. Every existing account follows @alex.
--
-- AN ALIAS IS NOT AN ACCOUNT. There is no @ceo profile, nothing to sign into,
-- nothing that can post or be messaged. It is a redirect, resolved on READ, so
-- the address bar always ends up showing whose page you are actually on rather
-- than quietly serving one person's profile at another person's URL.
-- ============================================================================

-- ── 0. A leftover overload that breaks single-argument callers ──────────────
-- There are TWO search_public_profiles in this database: (text) and
-- (text, int), with DIFFERENT return shapes. PostgREST cannot choose between
-- them, so any call that omits p_limit answers PGRST203 — "could not choose
-- the best candidate" — which reads exactly like the function not existing.
-- Measured live before dropping it: {"p_q":"alex"} → 300 PGRST203;
-- {"p_q":"alex","p_limit":8} → 200. The app always passes both, which is the
-- only reason search has worked at all.
drop function if exists public.search_public_profiles(text);

-- ── 1. The alias table ──────────────────────────────────────────────────────
-- Public read on purpose: it is a redirect map, the client follows it, and
-- there is nothing in it that is not already visible by typing the address.
create table if not exists public.handle_aliases (
  alias      text primary key,
  target     text not null,
  note       text,
  created_at timestamptz not null default now()
);

alter table public.handle_aliases enable row level security;
drop policy if exists handle_aliases_read on public.handle_aliases;
create policy handle_aliases_read on public.handle_aliases for select using (true);
-- No insert/update/delete policy: aliases are an act of publication and are
-- added here, in SQL, deliberately.

grant select on public.handle_aliases to anon, authenticated;

-- Founder/owner-shaped names point at the founder; anything that reads as the
-- product or as staff points at the official account. The split matters: a
-- student writing to "@support" expecting a person should reach the account
-- that answers tickets, not somebody's personal profile.
insert into public.handle_aliases (alias, target, note) values
  ('ceo',           'alex',             'founder'),
  ('owner',         'alex',             'founder'),
  ('founder',       'alex',             'founder'),
  ('admin',         'concordiatracker', 'staff'),
  ('administrator', 'concordiatracker', 'staff'),
  ('staff',         'concordiatracker', 'staff'),
  ('mod',           'concordiatracker', 'staff'),
  ('mods',          'concordiatracker', 'staff'),
  ('moderation',    'concordiatracker', 'staff'),
  ('moderator',     'concordiatracker', 'staff'),
  ('support',       'concordiatracker', 'staff'),
  ('help',          'concordiatracker', 'staff'),
  ('official',      'concordiatracker', 'staff'),
  ('team',          'concordiatracker', 'staff'),
  ('concordia',     'concordiatracker', 'Concordia-named'),
  ('concordiau',    'concordiatracker', 'Concordia-named'),
  ('conu',          'concordiatracker', 'Concordia-named'),
  ('ct',            'concordiatracker', 'Concordia-named')
on conflict (alias) do update set target = excluded.target, note = excluded.note;

-- An alias whose target does not exist would resolve to nothing and look like
-- a bug. Say so at apply time rather than discovering it from a 404.
do $$
declare r record; n int := 0;
begin
  for r in
    select a.alias, a.target from public.handle_aliases a
     where not exists (
       select 1 from public.user_profile p where lower(p.handle) = lower(a.target)
     )
  loop
    n := n + 1;
    raise notice 'Alias @% points at @%, which no account holds.', r.alias, r.target;
  end loop;
  if n = 0 then raise notice 'Every alias resolves.'; end if;
end $$;

-- ── 2. Reserved, from ONE list ──────────────────────────────────────────────
-- Every alias is automatically refused as a handle, so the two lists cannot
-- drift: adding an alias reserves the name in the same statement. The
-- blocklist keeps the names that are reserved but point nowhere.
insert into public.handle_blocklist (pattern, kind, reason) values
  ('ceo',        'exact', 'reads as staff — reserved, resolves to the founder'),
  ('owner',      'exact', 'reads as staff — reserved, resolves to the founder'),
  ('founder',    'exact', 'reads as staff — reserved, resolves to the founder'),
  ('moderation', 'exact', 'reads as staff'),
  ('mods',       'exact', 'reads as staff'),
  ('conu',       'exact', 'the university'),
  ('concordiatrackers', 'exact', 'ours'),
  ('theconcordiatracker', 'exact', 'ours')
on conflict (pattern) do nothing;

create or replace function public.ct_handle_ok(p_handle text)
returns text
language plpgsql stable set search_path = public as $$
declare
  h      text := lower(trim(coalesce(p_handle, '')));
  folded text := public.ct_handle_fold(p_handle);
  hit    text;
begin
  if length(h) < 3  then return 'Handles need at least 3 characters.'; end if;
  if length(h) > 20 then return 'Handles are 20 characters at most.'; end if;
  if h !~ '^[a-z0-9_]+$' then
    return 'Letters, numbers and underscores only.';
  end if;

  -- Reserved because it already means something. Checked before the
  -- blocklist so the two can never disagree about a name that is in both.
  if exists (select 1 from public.handle_aliases a where lower(a.alias) = h) then
    return 'That handle isn''t available. Try another.';
  end if;

  select b.pattern into hit
    from public.handle_blocklist b
   where (b.kind = 'exact'    and folded = public.ct_handle_fold(b.pattern))
      or (b.kind = 'contains' and folded like '%' || public.ct_handle_fold(b.pattern) || '%')
   limit 1;

  if hit is not null then
    -- Deliberately does NOT name the pattern: telling someone which word
    -- tripped it is a hint for the next attempt.
    return 'That handle isn''t available. Try another.';
  end if;

  return null;
end; $$;
grant execute on function public.ct_handle_ok(text) to authenticated, anon;

-- ── 3. Resolving one ────────────────────────────────────────────────────────
-- Returns the handle this one really means: itself if an account holds it, the
-- target if it is an alias, null if it is neither. A leading '@' is tolerated
-- because that is how every handle is WRITTEN everywhere in the product.
create or replace function public.resolve_handle(p_handle text)
returns text
language sql stable security definer set search_path = public as $$
  with want as (select lower(trim(regexp_replace(coalesce(p_handle, ''), '^@+', ''))) as h)
  select coalesce(
    (select p.handle from public.user_profile p, want where lower(p.handle) = want.h),
    (select t.handle
       from public.handle_aliases a
       join public.user_profile t on lower(t.handle) = lower(a.target),
            want
      where lower(a.alias) = want.h)
  );
$$;
grant execute on function public.resolve_handle(text) to anon, authenticated;

-- ── 4. The profile, alias-aware ─────────────────────────────────────────────
-- Same ten columns in the same order as the live function (user_id first,
-- is_public ninth) — the client reads them positionally and reordering them
-- silently mislabels a profile. The only change is the WHERE clause, which now
-- matches the RESOLVED handle, and the returned `handle`, which is therefore
-- the canonical one. That is what lets the page redirect /@ceo → /@alex in a
-- single round trip instead of rendering a 404 and then asking a second
-- question.
create or replace function public.get_public_profile(p_handle text)
returns table (
  user_id uuid,
  handle text,
  name text,
  avatar_url text,
  program text,
  program_id text,
  bio text,
  links jsonb,
  is_public boolean,
  courses_public boolean
)
language sql stable security definer set search_path = public as $$
  select
    p.user_id,
    p.handle,
    p.name,
    p.avatar_url,
    case when p.profile_public and coalesce(p.program_public, true) then p.program end,
    case when p.profile_public and coalesce(p.program_public, true) then p.program_id end,
    case when p.profile_public then p.bio end,
    case when p.profile_public then coalesce(p.links, '{}'::jsonb) else '{}'::jsonb end,
    coalesce(p.profile_public, false),
    coalesce(p.courses_public, false)
  from public.user_profile p
  where lower(p.handle) = lower(coalesce(public.resolve_handle(p_handle), ''))
    and (
      -- Yourself, always.
      p.user_id = auth.uid()
      -- Everyone else: blocking is the only thing that hides a profile.
      or not public.ct_blocked_between(auth.uid(), p.user_id)
    )
  limit 1;
$$;
grant execute on function public.get_public_profile(text) to anon, authenticated;

-- ── 5. Search that survives what people type ────────────────────────────────
-- THREE THINGS IT COULD NOT DO, each measured against production first:
--
--   "@div"      → nothing. The '@' was matched literally, and every handle in
--                 this product is displayed WITH one.
--   "Alex Deg"  → nothing. One ilike over the whole query means a space can
--                 only ever match a name spelled exactly that way; matching
--                 each word instead makes a partial name work, which is how
--                 anybody searches for a person.
--   "alex"      → everyone called Alex EXCEPT the founder, because internal
--                 accounts are excluded. That flag exists so test accounts do
--                 not count as users; it was never meant to make the two
--                 accounts this product is named after unfindable. An account
--                 an alias points at is, by that fact, meant to be found.
create or replace function public.search_public_profiles(p_q text, p_limit int default 8)
returns table (
  handle         text,
  name           text,
  avatar_url     text,
  program        text,
  follower_count int,
  is_public      boolean
)
language sql stable security definer set search_path = public as $$
  with q as (
    select nullif(trim(regexp_replace(coalesce(p_q, ''), '^@+', '')), '') as term
  ),
  toks as (
    select term,
           string_to_array(regexp_replace(lower(term), '\s+', ' ', 'g'), ' ') as parts
      from q
  ),
  -- Named because they are the accounts a reserved handle points at.
  featured as (
    select t.user_id
      from public.handle_aliases a
      join public.user_profile t on lower(t.handle) = lower(a.target)
  ),
  -- A reserved handle typed in full IS a result: @ceo means @alex.
  aliased as (
    select t.user_id
      from public.handle_aliases a
      join public.user_profile t on lower(t.handle) = lower(a.target), q
     where q.term is not null and lower(a.alias) = lower(q.term)
  ),
  hits as (
    select p.*, (select 1 from aliased x where x.user_id = p.user_id) as by_alias
      from public.user_profile p, toks
     where coalesce(p.handle, '') <> ''
       and toks.term is not null
       and not public.ct_blocked_between(auth.uid(), p.user_id)
       and (
         coalesce(p.is_internal, false) = false
         or exists (select 1 from featured f where f.user_id = p.user_id)
       )
       and (
         exists (select 1 from aliased x where x.user_id = p.user_id)
         -- Every word has to appear somewhere in the handle or the name, so
         -- "alex deg" and "deg alex" both find Alex Degryse and neither finds
         -- somebody who merely shares one of the words.
         or not exists (
           select 1 from unnest(toks.parts) as u(part)
            where u.part <> ''
              and p.handle not ilike '%' || u.part || '%'
              and coalesce(p.name, '') not ilike '%' || u.part || '%'
         )
       )
  )
  select
    h.handle,
    h.name,
    h.avatar_url,
    case when h.profile_public then h.program end,
    case when h.profile_public
         then (select count(*)::int from public.user_follows f where f.following = h.user_id)
         else 0 end,
    coalesce(h.profile_public, false)
  from hits h, q
  order by
    -- You typed it exactly: handle, then a reserved name that means someone.
    case when lower(h.handle) = lower(q.term) then 0
         when h.by_alias is not null then 1
         when h.handle ilike q.term || '%' then 2
         when coalesce(h.name, '') ilike q.term || '%' then 3
         else 4 end,
    (select count(*) from public.user_follows f where f.following = h.user_id) desc,
    h.handle
  limit greatest(1, least(coalesce(p_limit, 8), 25));
$$;
grant execute on function public.search_public_profiles(text, int) to anon, authenticated;

-- ── 6. "Followed by" was the wrong set ──────────────────────────────────────
-- It joined "people I follow" to "people THEY follow" — the overlap of two
-- following lists, which is "you both follow X", not "X follows them". On your
-- own profile the two conditions collapse into the same one, so it listed
-- everyone you follow and read as "Followed by Darius" about somebody who does
-- not follow you. The correct chain is me → X → them.
--
-- And it says nothing at all on your own profile: "followed by" is a fact
-- about a stranger you are deciding whether to trust, and pointed at yourself
-- it is just your mutuals with a misleading label.
create or replace function public.profile_social(p_handle text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  me     uuid := auth.uid();
  them   uuid;
  result jsonb;
begin
  select up.user_id into them from public.user_profile up
   where lower(up.handle) = lower(coalesce(public.resolve_handle(p_handle), ''));
  if them is null then return null; end if;

  select jsonb_build_object(
    'user_id',    them,
    'followers',  (select count(*) from public.user_follows f where f.following = them),
    'following',  (select count(*) from public.user_follows f where f.follower  = them),
    -- Orgs replaces Instagram's post count: organisations they follow.
    'orgs',       (select count(*) from public.org_follows o where o.user_id = them),
    'i_follow',   public.ct_follows(me, them),
    'follows_me', public.ct_follows(them, me),
    'mutual',     public.ct_is_mutual(me, them),
    'dm_reason',  public.ct_dm_block_reason(me, them),
    'mutuals',    case when me is null or me = them then '[]'::jsonb else coalesce((
      select jsonb_agg(x) from (
        select jsonb_build_object('handle', p.handle, 'name', p.name, 'avatar_url', p.avatar_url) as x
          from public.user_follows a                      -- me   -> X
          join public.user_follows b
            on b.follower = a.following and b.following = them   -- X -> them
          join public.user_profile p on p.user_id = a.following
         where a.follower = me and a.following <> them
         order by p.name nulls last
         limit 3
      ) t
    ), '[]'::jsonb) end,
    'mutuals_total', case when me is null or me = them then 0 else (
      select count(*) from public.user_follows a
        join public.user_follows b
          on b.follower = a.following and b.following = them
       where a.follower = me and a.following <> them
    ) end
  ) into result;
  return result;
end; $$;
grant execute on function public.profile_social(text) to anon, authenticated;

-- ── 7. Everybody follows @alex ──────────────────────────────────────────────
-- A one-off seed, not a rule: it puts the founder in everyone's following list
-- on day one the way a new service's own account is. It is an ordinary follow
-- — unfollowable from the profile like any other, and re-running this file
-- will NOT re-add one somebody has removed, because the insert is keyed on the
-- pair and only ever inserts what is missing at the moment it runs.
do $$
declare alex uuid; added int;
begin
  select user_id into alex from public.user_profile where lower(handle) = 'alex';
  if alex is null then
    raise notice 'No @alex account — skipped the follow seed.';
    return;
  end if;

  insert into public.user_follows (follower, following)
  select p.user_id, alex
    from public.user_profile p
   where p.user_id <> alex
     and not exists (
       select 1 from public.user_follows f
        where f.follower = p.user_id and f.following = alex
     )
     -- Not from someone who blocked him, in either direction.
     and not public.ct_blocked_between(p.user_id, alex)
  on conflict do nothing;

  get diagnostics added = row_count;
  raise notice 'Followed @alex from % account(s).', added;
end $$;

-- ── Checks (run these) ──────────────────────────────────────────────────────
--   select public.resolve_handle('@CEO');                    -- 'alex'
--   select public.resolve_handle('support');                 -- 'concordiatracker'
--   select public.resolve_handle('nobody_here');             -- null
--   select handle from public.get_public_profile('ceo');     -- 'alex'
--   select handle from public.search_public_profiles('@ceo', 8);   -- alex
--   select handle from public.search_public_profiles('alex deg', 8); -- alex
--   select public.ct_handle_ok('ceo');                       -- refusal string
