-- My programme has never worked for a single student. Here is why.
--
-- THERE ARE TWO PROGRAMME REGISTRIES AND THEY SHARE NO IDS.
--   src/data/programs.ts  — 162 programmes, ids are slug(name)-slug(credential)
--                           ("finance-bcomm"). This is what the picker writes
--                           to user_profile.program_id, and its own header
--                           says the slug is FROZEN because changing it would
--                           orphan every stored selection.
--   public.programs       — 54 rows, ids are faculty-prefixed ("bcomm-finance",
--                           "as-psychology"). Invented by the degree-audit work.
--
-- Measured against production: of the 22 students who have set a programme,
-- ZERO hold an id that exists in `programs`. `finance-bcomm` vs
-- `bcomm-finance` is the same programme written backwards; `psychology-ba-bsc`
-- vs `as-psychology` likewise. So `loadProgram(their id)` has always returned
-- null and the audit has always been empty. Not a missing feature — a join
-- that could never match.
--
-- THE FIX IS AN ALIAS, NOT A RENAME. The picker's slug is frozen and
-- `program_groups.program_id` points at these ids, so either side renaming
-- breaks the other. `alt_ids` lets one row answer to both names.
--
-- ONLY THE ONES THAT CARRY REQUIREMENTS, AND ONLY BY HAND. Twelve programmes
-- have groups seeded; the other 42 rows have none, so an alias for them buys
-- nothing. Automatic name-matching was tried and REJECTED: it matched the
-- 90-credit Computer Science degree to "computer-science-minor" and Theatre
-- to "theatre-minor". Attaching the wrong degree's requirements to a real
-- student is the confidently-wrong answer this product exists to avoid, so
-- every pair below was checked against the registry one at a time.
--
-- NOT MAPPED, deliberately:
--   bcomm                    — the registry has no "Commerce" umbrella entry,
--                              and it does not need one: every major carries
--                              parent_id = 'bcomm' and loadProgram unions the
--                              two, so a Finance student already gets the
--                              JMSB core. Checked, not assumed.
--   bcomm-business-analytics — no registry entry, so no student can hold it.

alter table public.programs
  add column if not exists alt_ids text[] not null default '{}';

comment on column public.programs.alt_ids is
  'Other ids this programme answers to — chiefly the frozen slug from src/data/programs.ts that user_profile.program_id stores.';

update public.programs set alt_ids = v.alt from (values
  ('bcompsc',                      array['computer-science-bcompsc']),
  ('bcomm-finance',                array['finance-bcomm']),
  ('bcomm-accountancy',            array['accountancy-bcomm']),
  ('bcomm-marketing',              array['marketing-bcomm']),
  ('bcomm-btm',                    array['business-technology-management-bcomm']),
  ('bcomm-economics',              array['economics-bcomm']),
  ('bcomm-hrm',                    array['human-resource-management-bcomm']),
  ('bcomm-international-business', array['international-business-bcomm']),
  ('bcomm-management',             array['management-bcomm']),
  ('bcomm-scom',                   array['supply-chain-operations-management-bcomm'])
) as v(id, alt) where public.programs.id = v.id;

create index if not exists programs_alt_ids_idx on public.programs using gin (alt_ids);

-- Resolve either vocabulary to one row. Used by loadProgram, so a student who
-- picked their programme in onboarding reaches the requirements without ever
-- knowing two id schemes existed.
create or replace function public.program_by_any_id(p_id text)
returns setof public.programs
language sql stable set search_path = public as $$
  select * from public.programs p
   where p.id = p_id or p_id = any(p.alt_ids)
   limit 1;
$$;

grant execute on function public.program_by_any_id(text) to anon, authenticated;
