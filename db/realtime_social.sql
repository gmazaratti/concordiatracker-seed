-- Live updates for sharing and follows (2026-11-10).
--
-- "View schedule" only appeared after a refresh, and so did new followers.
-- Both tables are select-own (each side of the row can read it, nobody else),
-- and Realtime applies that same policy to what it sends, so adding them to
-- the publication shows each person only their own rows.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'schedule_grants') then
    alter publication supabase_realtime add table public.schedule_grants;
  end if;
  -- Admin notes land on the student's screen the moment they are sent.
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'admin_messages') then
    alter publication supabase_realtime add table public.admin_messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'user_follows') then
    alter publication supabase_realtime add table public.user_follows;
  end if;
end $$;
