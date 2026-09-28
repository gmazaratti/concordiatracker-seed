-- Wallpapers: a photo behind Today, Courses and Calendar. Semester pass.
--
-- PRIVATE, not the public org-media bucket the trial used. A public bucket
-- means anyone who uploads can hand out a link to whatever they uploaded, and
-- we would be hosting it; nothing about a wallpaper needs to be public, since
-- only its owner ever sees it. The app reads it through a short-lived signed
-- URL.
--
-- PRO IS CHECKED HERE, not only on screen. The upload policy asks ct_is_pro,
-- the same single definition every other Pro gate uses (plan, dated grant or
-- team Pro), so a free account cannot upload one from the browser console.
-- Reading and deleting your own stay allowed after a pass ends: removing your
-- own file should never need a subscription.
--
-- ONE FILE PER ACCOUNT, BY CONSTRUCTION. The only name a user may write is
-- `<their uid>/wallpaper`: a new upload overwrites it (upsert), so no account
-- can ever hold more than one, whatever the client does or fails to do.
-- Nothing depends on the app remembering to delete the old file.
--
-- Idempotent.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wallpapers', 'wallpapers', false, 4194304, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists wallpapers_read_own on storage.objects;
create policy wallpapers_read_own on storage.objects
  for select to authenticated
  using (bucket_id = 'wallpapers' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists wallpapers_insert_pro on storage.objects;
create policy wallpapers_insert_pro on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'wallpapers'
    and name = auth.uid()::text || '/wallpaper'
    and public.ct_is_pro(auth.uid())
  );

-- An upsert of an existing file is an UPDATE, so replacing needs this too.
drop policy if exists wallpapers_update_pro on storage.objects;
create policy wallpapers_update_pro on storage.objects
  for update to authenticated
  using (bucket_id = 'wallpapers' and name = auth.uid()::text || '/wallpaper')
  with check (
    bucket_id = 'wallpapers'
    and name = auth.uid()::text || '/wallpaper'
    and public.ct_is_pro(auth.uid())
  );

drop policy if exists wallpapers_delete_own on storage.objects;
create policy wallpapers_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'wallpapers' and (storage.foldername(name))[1] = auth.uid()::text);
