-- ── Org media bucket (logos + banners) ───────────────────────────────────────
-- A public-read storage bucket for organizer-uploaded images. Security:
--   • allowed_mime_types is RASTER ONLY — no SVG (SVG can carry scripts). The
--     client also re-encodes every upload through a canvas, so what lands here is
--     always a plain raster image (any polyglot/script payload is destroyed).
--   • file_size_limit caps size server-side (the client caps too).
--   • writes are scoped to the uploader's OWN folder ({uid}/…), so nobody can
--     overwrite another org's images. Reads are public (images show on the feed).
--
-- RUN in the Supabase SQL editor. Safe to re-run.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('org-media', 'org-media', true, 4194304, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public            = excluded.public,
      file_size_limit   = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Public read.
drop policy if exists "org-media read" on storage.objects;
create policy "org-media read" on storage.objects
  for select using (bucket_id = 'org-media');

-- Authenticated users may write only inside their own {uid}/ folder.
drop policy if exists "org-media insert own" on storage.objects;
create policy "org-media insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'org-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "org-media update own" on storage.objects;
create policy "org-media update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'org-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "org-media delete own" on storage.objects;
create policy "org-media delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'org-media' and (storage.foldername(name))[1] = auth.uid()::text);
