-- ============================================================================
-- Feedback FIXES — run in concordiatracker-dev → SQL Editor.
-- The first run used the older feedback.sql; this applies the 4 corrections it
-- was missing. Safe + idempotent. (If you see "Failed to save changes", that's
-- only the editor failing to bookmark the query — execution still applies.)
-- ============================================================================

-- FIX 1 — vote toggle errored: the OUT name `vote_count` shadowed the table
-- column ("column reference vote_count is ambiguous"). Rename the OUT to `total`.
-- Renaming an OUT column changes the return type, so drop the old one first.
drop function if exists public.toggle_feature_vote(uuid);
create or replace function public.toggle_feature_vote(p_request_id uuid)
returns table (voted boolean, total int)
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); existing uuid; cnt int;
begin
  if uid is null then raise exception 'You must be signed in to vote.'; end if;
  select id into existing from public.feature_request_votes where request_id = p_request_id and user_id = uid;
  if existing is null then
    insert into public.feature_request_votes (request_id, user_id) values (p_request_id, uid);
    update public.feature_requests set vote_count = vote_count + 1 where id = p_request_id returning vote_count into cnt;
    return query select true, coalesce(cnt, 0);
  else
    delete from public.feature_request_votes where id = existing;
    update public.feature_requests set vote_count = greatest(vote_count - 1, 0) where id = p_request_id returning vote_count into cnt;
    return query select false, coalesce(cnt, 0);
  end if;
end; $$;
grant execute on function public.toggle_feature_vote(uuid) to authenticated;

-- FIX 2 — remove direct INSERT on feature_requests so pinned / vote_count /
-- author_tier / status can't be spoofed; posting is ONLY via submit_feature_request().
drop policy if exists "fr_insert" on public.feature_requests;

-- FIX 3 — only admins can publish a bug to the curated known-issues list.
drop policy if exists "bugs_insert" on public.bug_reports;
create policy "bugs_insert" on public.bug_reports for insert
  with check ((user_id = auth.uid() or user_id is null) and (public = false or public.is_admin()));

-- FIX 4 — admin bug list must also return the `public` flag (return-type change
-- → drop + recreate).
drop function if exists public.admin_list_bug_reports();
create or replace function public.admin_list_bug_reports()
returns table (id uuid, user_email text, title text, description text, page text, status text, admin_notes text, public boolean, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return query select b.id, b.user_email, b.title, b.description, b.page, b.status, b.admin_notes, b.public, b.created_at
    from public.bug_reports b order by b.created_at desc;
end; $$;
grant execute on function public.admin_list_bug_reports() to authenticated;
