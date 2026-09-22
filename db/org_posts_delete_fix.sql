-- ============================================================================
-- Taking a post down was impossible for everyone.
-- RUN IN: Supabase SQL Editor. Safe to re-run. Non-destructive.
--
-- MEASURED, NOT REASONED. As the org's own team, with
-- `ct_can_act_as_org` returning TRUE:
--
--   update org_posts set caption = caption  → ok
--   update org_posts set deleted = true     → 42501, "new row violates
--                                             row-level security policy"
--
-- One column, one outcome. The culprit is the SELECT policy, not the UPDATE
-- one: `org_posts_read` is `using (not deleted and …)`, and Postgres applies
-- the SELECT policy to the NEW row of an UPDATE on a table that has one. So
-- the moment the new row says `deleted = true` it is a row the writer may not
-- see, and the write is refused. Soft-deleting a post could therefore never
-- work — not for a club officer in the browser, not for the API.
--
-- IT HAD NEVER BEEN HIT because no post in production belongs to an
-- organisation with a real owner: every one was published by the platform on
-- clubs that have no team yet. The first officer to press delete would have
-- found it.
--
-- THE FIX IS THE RIGHT BEHAVIOUR ANYWAY. A club should be able to see that a
-- post of theirs was removed; only the PUBLIC needs it to disappear. So the
-- read policy keeps its `not deleted` rule for everybody else and adds "or you
-- can act for this organisation" — which is also what makes
-- `Prefer: return=representation` work on the way out.
-- ============================================================================

drop policy if exists org_posts_read on public.org_posts;
create policy org_posts_read on public.org_posts
  for select to anon, authenticated
  using (
    (
      not deleted
      and exists (
        select 1 from public.organizations o
         where o.id = org_id and coalesce(o.status, 'pending') = 'approved'
      )
    )
    -- The team that published it, including a platform-admin token, keeps
    -- reading it after it comes down. Nothing else changes: `post_feed` and
    -- every other reader still filter `not deleted` themselves.
    or public.ct_can_act_as_org(org_id)
  );

-- The UPDATE policy's check was only ever implicit (no WITH CHECK means the
-- USING expression is reused). Spelling it out costs nothing and means the
-- next person reading this file does not have to know that rule.
drop policy if exists org_posts_update on public.org_posts;
create policy org_posts_update on public.org_posts
  for update to authenticated
  using (public.ct_can_act_as_org(org_id))
  with check (public.ct_can_act_as_org(org_id));

-- ── Check ───────────────────────────────────────────────────────────────────
--   As a member of the org, with RLS in force:
--     update public.org_posts set deleted = true where id = '<a post>';  -- ok
--   As anybody else, the post is gone from every public read:
--     select count(*) from public.post_feed(null, false, 50, 0);
