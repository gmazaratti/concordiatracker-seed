-- ============================================================================
-- A bucket for video.
-- RUN IN: Supabase SQL Editor. Safe to re-run.
--
-- WHY A SECOND BUCKET AND NOT A BIGGER FIRST ONE. `org-media` is capped at
-- 4 MB and restricted to PNG/JPEG/WEBP, and that cap is the only thing
-- standing between us and somebody uploading a 25 MB "image" — the client
-- re-encodes every picture to a WEBP under 1440px, so nothing legitimate ever
-- comes close to 4 MB and the ceiling costs real users nothing. Raising it to
-- fit video would raise it for images too and throw that away.
--
-- SO: images keep their 4 MB, video gets its own 25 MB, and the two limits can
-- be reasoned about separately.
--
-- WHAT WE CANNOT DO TO A VIDEO, and it is worth writing down. Every image in
-- this product is re-drawn through a canvas before upload, so the bytes that
-- leave the browser are a fresh raster and anything embedded in the original
-- is gone. There is no equivalent for video in a browser. The defences that
-- remain are: a short allowlist of container types, checked against the file's
-- MAGIC BYTES rather than the name or the claimed type; a content-type set
-- from what we sniffed, never from what was claimed; and a public bucket that
-- serves with that fixed type, so a polyglot cannot be fetched as HTML or as a
-- script. That is the honest list.
--
-- 25 MB is roughly a minute of phone video at a sane bitrate. It is a limit on
-- OUR storage bill as much as on abuse, and it is meant to be argued with.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'org-video',
  'org-video',
  true,
  26214400,                                   -- 25 MB
  array['video/mp4', 'video/webm']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Same four policies `org-media` has, same shape: anyone may read (the bucket
-- is public and the URLs are in a public feed), and you may only write inside
-- a folder named after your own user id.
drop policy if exists "org-video read" on storage.objects;
create policy "org-video read" on storage.objects
  for select using (bucket_id = 'org-video');

drop policy if exists "org-video insert own" on storage.objects;
create policy "org-video insert own" on storage.objects
  for insert with check (
    bucket_id = 'org-video' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "org-video update own" on storage.objects;
create policy "org-video update own" on storage.objects
  for update using (
    bucket_id = 'org-video' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "org-video delete own" on storage.objects;
create policy "org-video delete own" on storage.objects
  for delete using (
    bucket_id = 'org-video' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- NOTHING CHANGES IN `org_posts`. Its `media` column is jsonb, so a video is
-- `{"url": "...", "kind": "video", "w": 1080, "h": 1350}` and an image is the
-- same object without the kind. That is the whole reason it was jsonb.

-- ── Check ───────────────────────────────────────────────────────────────────
--   select id, public, file_size_limit, allowed_mime_types from storage.buckets;
