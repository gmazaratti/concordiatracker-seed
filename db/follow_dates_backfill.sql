-- ── Give migrated follows their real dates back ─────────────────────────────
--
-- `db/social_follow_model.sql` turned every accepted friendship into two
-- follow rows, and let `user_follows.created_at` take its default. So the
-- whole graph is stamped with the minute that migration ran, and the
-- notification panel says a follow from four days ago happened this morning.
-- Reported as "florence started following me 7 hours ago, when it was 3 days
-- ago" — and the panel was faithfully reporting what the row said.
--
-- The dates survive, because that migration deliberately left `friendships`
-- in place rather than dropping it. This copies them back.
--
-- ONLY BACKWARDS, and only where a friendship actually accounts for the row.
-- A follow made after the migration has a real date of its own and must not
-- be touched, so the update is conditional on the friendship being OLDER. The
-- pair is matched in both directions because one friendship became two
-- follows.
--
-- Idempotent: a second run finds nothing older to copy.
--
-- RUN in the Supabase SQL editor. Safe to re-run.

do $$
declare moved int;
begin
  if to_regclass('public.friendships') is null then
    raise notice 'No friendships table — nothing to restore.';
    return;
  end if;

  update public.user_follows f
     set created_at = fr.created_at
    from public.friendships fr
   where (
           (fr.requester = f.follower  and fr.addressee = f.following)
        or (fr.requester = f.following and fr.addressee = f.follower)
         )
     and fr.created_at < f.created_at;

  get diagnostics moved = row_count;
  raise notice 'Restored the original date on % follow row(s).', moved;
end $$;
