-- ─────────────────────────────────────────────────────────────────────────────
-- Class icons and gradients.
--
-- A colour alone stops being an identity once you have six classes: two of them
-- are blue-ish and you end up reading the code every time. An icon is
-- recognised before text is, which is the banner's whole job.
--
-- Both are Semester-pass features, on the same line the themes draw: a
-- readable, distinguishable class list is the product; making it yours is the
-- upgrade. Deliberately NOT load-bearing — every card still shows the course
-- code, so a lapsed pass costs decoration and never information. The values
-- also survive a lapse rather than being wiped, exactly like a held theme.
--
-- Null means "the plain colour", which is what every existing class already is.
--
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.courses
  add column if not exists icon text,
  add column if not exists gradient text;
