-- ============================================================================
-- Bilingual publishing — teachers and organizations can publish an English and
-- a French version of what students read.
-- RUN IN: Supabase → SQL Editor → paste → Run. Safe to re-run.
--
-- WHY A jsonb COLUMN AND NOT title_fr / body_fr SIBLINGS:
--   • One migration per table no matter how many fields become translatable.
--     Adding "location" later is a client change, not a schema change.
--   • A third language is zero schema work.
--   • The auto-translation idea writes into exactly this shape.
--   • Nothing sorts or filters on a translated field — it's display only — so
--     the usual argument for real columns (indexes) doesn't apply here.
--
-- Shape: { "fr": { "title": "…", "body": "…" } }
-- The BASE columns stay the English/default copy and are still required, so a
-- row is never blank: a missing or empty French field falls back to the base.
-- That's a deliberate choice — half-translated content should show English for
-- the parts nobody translated, not gaps.
-- ============================================================================

alter table public.announcements
  add column if not exists translations jsonb not null default '{}'::jsonb;

alter table public.events
  add column if not exists translations jsonb not null default '{}'::jsonb;

alter table public.organizations
  add column if not exists translations jsonb not null default '{}'::jsonb;

-- Guard against a malformed write turning into a client crash: the value must
-- be an object, and each language must map to an object of strings.
create or replace function public.valid_translations(v jsonb)
returns boolean language sql immutable as $$
  select v is null
      or (jsonb_typeof(v) = 'object' and not exists (
            select 1 from jsonb_each(v) e
             where jsonb_typeof(e.value) <> 'object'
                or exists (
                     select 1 from jsonb_each(e.value) f
                      where jsonb_typeof(f.value) not in ('string', 'null')
                   )
          ));
$$;

alter table public.announcements  drop constraint if exists announcements_translations_shape;
alter table public.announcements  add  constraint announcements_translations_shape
  check (public.valid_translations(translations));

alter table public.events         drop constraint if exists events_translations_shape;
alter table public.events         add  constraint events_translations_shape
  check (public.valid_translations(translations));

alter table public.organizations  drop constraint if exists organizations_translations_shape;
alter table public.organizations  add  constraint organizations_translations_shape
  check (public.valid_translations(translations));

-- ── Reporting helper ─────────────────────────────────────────────────────────
-- How much of an organization's output actually has a French version. Drives
-- the coverage hint in the portal, and would be the metric an org tier is
-- eventually sold against.
create or replace function public.org_translation_coverage(p_org_id uuid)
returns table (total int, translated int)
language sql security definer set search_path = public stable as $$
  select count(*)::int,
         count(*) filter (
           where coalesce(nullif(e.translations #>> '{fr,title}', ''), null) is not null
         )::int
    from public.events e
   where e.org_id = p_org_id;
$$;
grant execute on function public.org_translation_coverage(uuid) to authenticated;
