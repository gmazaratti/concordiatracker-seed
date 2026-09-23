-- ============================================================================
-- Onboarding a club: claiming a handle, and saying what you actually do there.
-- RUN IN: Supabase SQL Editor. Safe to re-run.
--
-- TWO SMALL THINGS, both because the setup wizard now asks questions it used
-- to assume the answer to.
--
--  1. `org_handle_problem` — whether a handle can be claimed, and WHY NOT when
--     it cannot. The wizard lets a club edit the handle it was invited under,
--     which it could not before, so it needs to be able to say "taken" before
--     the save rather than after a unique-violation.
--
--  2. `org_members.title` — the words somebody uses for their own job ("VP
--     Internal", "Communications"). The `role` column is the PERMISSION level
--     and has exactly three values; a title is not a permission and squeezing
--     one into the other would mean either inventing roles that grant nothing
--     or losing the answer to a question we just asked.
-- ============================================================================

-- ── 1. Can this club have this handle? ──────────────────────────────────────
--
-- IT CHECKS PEOPLE TOO, and that is the point rather than an over-reach. A
-- club calling itself the same thing as a student is the impersonation this
-- costs nothing to prevent, and `ct_handle_ok` already holds the length, the
-- character set, the reserved aliases and the blocklist — so the rules a club
-- is held to are the same rules, written once.
--
-- The stored value keeps its leading `@` (organisations always have, people
-- never have), so everything is compared with it stripped.
create or replace function public.org_handle_problem(p_handle text, p_org uuid default null)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  with bare as (select lower(regexp_replace(trim(coalesce(p_handle, '')), '^@+', '')) as h)
  select coalesce(
    public.ct_handle_ok((select h from bare)),
    case
      when exists (
        select 1 from public.organizations o, bare
         where lower(regexp_replace(o.handle, '^@+', '')) = bare.h
           and (p_org is null or o.id <> p_org)
      ) then 'Another club already has that handle.'
      when exists (
        select 1 from public.user_profile u, bare
         where lower(coalesce(u.handle, '')) = bare.h
      ) then 'Someone already has that handle.'
    end
  );
$$;

revoke all on function public.org_handle_problem(text, uuid) from public;
grant execute on function public.org_handle_problem(text, uuid) to authenticated;

-- ── 2. What somebody calls their own job ────────────────────────────────────
alter table public.org_members add column if not exists title text;

comment on column public.org_members.title is
  'Self-described job ("VP Internal"). NOT a permission — `role` is the level.';

-- ── Checks ──────────────────────────────────────────────────────────────────
--   select public.org_handle_problem('ab');            -- too short
--   select public.org_handle_problem('reggiesmtl');    -- taken by a club
--   select public.org_handle_problem('@reggiesmtl');   -- same, with the sign
--   select public.org_handle_problem('a-brand-new-1'); -- 'Letters, numbers…'
--   select public.org_handle_problem('freshclub2026'); -- null = available
