-- ============================================================================
-- A map link on an event.
-- RUN IN: Supabase SQL Editor. Safe to re-run.
--
-- A LINK, NOT AN EMBED. Google's "Embed a map" tab hands you an `<iframe>`,
-- and accepting markup from a club means putting it on a page every student
-- loads. The URL is validated to a maps host in the editor and rendered as a
-- link naming the host — the same rule the org profile's social links follow.
-- On a phone it opens their own maps app, which is what they wanted anyway.
--
-- The room number stays the primary field. "H 920" is what a Concordia student
-- needs; a map of the Hall building tells them nothing.
-- ============================================================================
alter table public.events add column if not exists map_url text;

comment on column public.events.map_url is
  'Optional https link to Google/Apple/OpenStreetMap. Validated client-side to '
  'a maps host; rendered as a link, never embedded.';
