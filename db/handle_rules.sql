-- Handle rules: length, reserved names, and slurs — enforced by the DATABASE.
--
-- WHAT WAS WRONG. `HANDLE_RE` (3–20, lowercase) lives in the client, and the
-- only server-side rule was uniqueness. So the length was a suggestion, and
-- nothing anywhere stopped somebody registering a racial slur as their
-- @handle — reported after it was tried, and `handle_available` cheerfully
-- said it was free. On a product about to onboard a few hundred students,
-- with handles that appear in a public feed next to Concordia's name, that
-- is the failure that ends the product rather than annoys somebody.
--
-- ENFORCED IN ONE PLACE, CALLED FROM THREE. `ct_handle_ok()` is the rule;
-- `handle_available` consults it (so the live "available" tick is honest),
-- and a BEFORE trigger on user_profile enforces it on every write (so a
-- crafted request cannot route around the form). The client keeps its regex
-- for instant feedback — it is a courtesy, not the boundary.
--
-- THE LISTS LIVE IN A TABLE, not in this file's logic, so additions do not
-- need a deploy: the moment somebody finds a handle that should have been
-- refused, it is one INSERT.
--
-- RUN in the Supabase SQL editor. Safe to re-run.

create table if not exists public.handle_blocklist (
  pattern text primary key,
  -- 'exact'    — the whole handle must not equal this (reserved names).
  -- 'contains' — the handle must not contain it anywhere (slurs, which get
  --              padded: "xxnwordxx" is the same problem as the bare word).
  kind    text not null default 'contains' check (kind in ('exact', 'contains')),
  reason  text,
  added_at timestamptz not null default now()
);

alter table public.handle_blocklist enable row level security;
-- No policies: the rule function is SECURITY DEFINER and reads it; nobody
-- else needs to. Publishing the list would just be a checklist of what to
-- try with a zero swapped in.

-- ── Reserved: ours, Concordia's, and anything that reads as staff ────────────
-- "concordia" is claimed here rather than by parking a fake account on it —
-- a reservation cannot be deleted by accident, and does not put a hollow
-- profile in search.
insert into public.handle_blocklist (pattern, kind, reason) values
  ('concordia',        'exact', 'the university'),
  ('concordiau',       'exact', 'the university'),
  ('concordiatracker', 'exact', 'ours — the real account holds it'),
  ('ct',               'exact', 'ours'),
  ('admin',            'exact', 'reads as staff'),
  ('administrator',    'exact', 'reads as staff'),
  ('moderator',        'exact', 'reads as staff'),
  ('mod',              'exact', 'reads as staff'),
  ('staff',            'exact', 'reads as staff'),
  ('support',          'exact', 'reads as staff'),
  ('help',             'exact', 'reads as staff'),
  ('official',         'exact', 'reads as staff'),
  ('team',             'exact', 'reads as staff'),
  ('security',         'exact', 'reads as staff'),
  ('billing',          'exact', 'reads as staff'),
  ('root',             'exact', 'reads as staff'),
  ('system',           'exact', 'reads as staff'),
  ('everyone',         'exact', 'reads as broadcast'),
  ('here',             'exact', 'reads as broadcast'),
  ('csu',              'exact', 'student union — reserve until they claim it'),
  ('jmsb',             'exact', 'faculty — reserve until they claim it'),
  ('ginacody',         'exact', 'faculty — reserve until they claim it')
on conflict (pattern) do nothing;

-- ── Slurs and the obvious obscenities ────────────────────────────────────────
-- A FLOOR, NOT A CEILING, and it is meant to be added to. Substring matching
-- with the letters-as-digits swaps folded out first (see ct_handle_fold), so
-- "n1gger" and "f4ggot" do not walk past it. It will not catch everything a
-- determined person can spell; it catches what an ordinary person types, and
-- the rest is what the report button and this table's INSERT are for.
insert into public.handle_blocklist (pattern, kind, reason) values
  ('nigger', 'contains', 'slur'),
  ('nigga',  'contains', 'slur'),
  ('faggot', 'contains', 'slur'),
  ('fagot',  'contains', 'slur'),
  ('retard', 'contains', 'slur'),
  ('tranny', 'contains', 'slur'),
  ('kike',   'contains', 'slur'),
  ('spic',   'contains', 'slur'),
  ('chink',  'contains', 'slur'),
  ('wetback','contains', 'slur'),
  ('coon',   'contains', 'slur'),
  ('paki',   'contains', 'slur'),
  ('hitler', 'contains', 'hate'),
  ('nazi',   'contains', 'hate'),
  ('rape',   'contains', 'violence'),
  ('rapist', 'contains', 'violence'),
  ('pedo',   'contains', 'violence'),
  ('cunt',   'contains', 'obscenity'),
  ('fuck',   'contains', 'obscenity'),
  ('shit',   'contains', 'obscenity'),
  ('bitch',  'contains', 'obscenity'),
  ('whore',  'contains', 'obscenity'),
  ('slut',   'contains', 'obscenity'),
  ('dick',   'contains', 'obscenity'),
  ('cock',   'contains', 'obscenity'),
  ('penis',  'contains', 'obscenity'),
  ('vagina', 'contains', 'obscenity')
on conflict (pattern) do nothing;

-- Digits and underscores are how a blocklist gets walked past, so they come
-- out before the comparison: n_i_g_g_e_r and n1gg3r both fold to the word.
create or replace function public.ct_handle_fold(p text)
returns text
language sql immutable set search_path = public as $$
  select translate(
           regexp_replace(lower(coalesce(p, '')), '[^a-z0-9]', '', 'g'),
           '013457',
           'oieast'
         );
$$;

/**
 * Is this handle allowed? Returns null when it is, or a reason when it is not
 * — a reason the UI can show, because "that handle is not available" when the
 * real answer is "pick something else" wastes somebody's afternoon.
 */
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

-- ── The live check now tells the truth ───────────────────────────────────────
create or replace function public.handle_available(p_handle text)
returns boolean
language sql security definer set search_path = public as $$
  select public.ct_handle_ok(p_handle) is null
     and not exists (
       select 1 from public.user_profile
       where lower(handle) = lower(trim(p_handle))
         and user_id <> auth.uid()
     );
$$;
grant execute on function public.handle_available(text) to authenticated;

-- And why, for a form that wants to say something useful.
create or replace function public.handle_problem(p_handle text)
returns text
language sql security definer set search_path = public as $$
  select coalesce(
    public.ct_handle_ok(p_handle),
    case when exists (
      select 1 from public.user_profile
       where lower(handle) = lower(trim(p_handle))
         and user_id <> auth.uid()
    ) then 'That handle is taken.' end
  );
$$;
grant execute on function public.handle_problem(text) to authenticated;

-- ── The boundary ─────────────────────────────────────────────────────────────
-- The client's regex is a courtesy. This is the rule: any write of a handle,
-- through any path, is checked. Admins are exempt so a handle can be fixed by
-- hand — including one that predates this file.
create or replace function public.ct_guard_handle()
returns trigger
language plpgsql security definer set search_path = public as $$
declare problem text;
begin
  if new.handle is null or new.handle = '' then return new; end if;
  if tg_op = 'UPDATE' and new.handle is not distinct from old.handle then
    return new;  -- untouched; do not re-litigate a handle already in use
  end if;
  if public.is_admin() then return new; end if;

  problem := public.ct_handle_ok(new.handle);
  if problem is not null then
    raise exception '%', problem using errcode = 'check_violation';
  end if;
  return new;
end; $$;

drop trigger if exists ct_guard_handle on public.user_profile;
create trigger ct_guard_handle
  before insert or update of handle on public.user_profile
  for each row execute function public.ct_guard_handle();

-- ── Anything already through the door ────────────────────────────────────────
do $$
declare r record; n int := 0;
begin
  for r in
    select p.handle, public.ct_handle_ok(p.handle) as problem
      from public.user_profile p
     where p.handle is not null and public.ct_handle_ok(p.handle) is not null
  loop
    n := n + 1;
    raise notice 'Existing handle would now be refused: @% (%)', r.handle, r.problem;
  end loop;
  if n = 0 then
    raise notice 'No existing handle breaks the new rules.';
  else
    raise notice '% existing handle(s) above. They keep working; rename them by hand if you want to.', n;
  end if;
end $$;
