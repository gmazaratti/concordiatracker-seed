-- ============================================================================
-- Feedback system — public feature-request board (+ votes) and the curated
-- "Recently fixed / Known issues" flag on the existing bug_reports table.
-- RUN IN: concordiatracker-dev → SQL Editor → paste → Run.  (NOT production.)
--
-- Bug SUBMISSION reuses bug_reports (already exists). This migration adds the
-- PUBLIC half (feature requests + per-user votes) and a curated `public` flag so
-- admins can surface select bugs as known/fixed without a raw complaint feed.
-- ============================================================================

-- ── 1. feature_requests (public, votable) ────────────────────────────────────
create table if not exists public.feature_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  author_name text not null,                       -- snapshot (can't read other profiles under RLS)
  author_tier text not null default 'free',        -- 'free' | 'pro' snapshot at post time
  title       text not null,
  body        text default '',
  status      text not null default 'open',        -- open|planned|in-progress|shipped|declined
  pinned      boolean not null default false,
  hidden      boolean not null default false,      -- admin moderation (soft hide)
  vote_count  int not null default 0,              -- denormalized for sort/display
  created_at  timestamptz not null default now()
);
alter table public.feature_requests enable row level security;
-- Public read (hidden rows only to admins); authors create + delete their own.
-- No author UPDATE policy → a user can't self-pin/unhide; pin/hide/status is admin-only (RPCs).
drop policy if exists "fr_select"     on public.feature_requests;
drop policy if exists "fr_insert"     on public.feature_requests;  -- intentionally NOT recreated
drop policy if exists "fr_delete_own" on public.feature_requests;
create policy "fr_select"     on public.feature_requests for select using (not hidden or public.is_admin());
create policy "fr_delete_own" on public.feature_requests for delete using (auth.uid() = user_id);
-- NO direct-insert policy: posting is ONLY through submit_feature_request() (a
-- SECURITY DEFINER fn), so pinned / hidden / vote_count / author_tier / status
-- cannot be spoofed by a crafted insert.

-- ── 2. feature_request_votes (one heart per user per request) ────────────────
create table if not exists public.feature_request_votes (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.feature_requests(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (request_id, user_id)
);
alter table public.feature_request_votes enable row level security;
drop policy if exists "frv_select_own" on public.feature_request_votes;
create policy "frv_select_own" on public.feature_request_votes for select using (auth.uid() = user_id);
-- (writes go through toggle_feature_vote() below, which keeps vote_count in sync.)

-- ── 3. bug_reports → curated public flag for "Recently fixed / Known issues" ──
alter table public.bug_reports add column if not exists public boolean not null default false;
drop policy if exists "bugs_public_read" on public.bug_reports;
create policy "bugs_public_read" on public.bug_reports for select using (public = true);
-- Tighten inserts: a user can file a bug as themselves, but only an admin can
-- publish one to the curated known-issues list (close the public=true gap).
drop policy if exists "bugs_insert" on public.bug_reports;
create policy "bugs_insert" on public.bug_reports for insert
  with check ((user_id = auth.uid() or user_id is null) and (public = false or public.is_admin()));

-- ── 4. RPCs ───────────────────────────────────────────────────────────────────
-- Submit a request — reads the caller's REAL name + tier server-side (no client
-- spoofing of tier), with a basic length + content guard.
create or replace function public.submit_feature_request(p_title text, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); nm text; tier text; new_id uuid; t text := trim(coalesce(p_title,'')); b text := coalesce(p_body,'');
begin
  if uid is null then raise exception 'You must be signed in to post.'; end if;
  if length(t) < 3 then raise exception 'Please add a short, clear title.'; end if;
  -- Basic content guard (also enforced client-side; this is the server backstop).
  if (t || ' ' || b) ~* '\m(fuck|shit|cunt|nigger|faggot|retard|bitch)\M' then
    raise exception 'Please keep it respectful — that post was blocked.';
  end if;
  select coalesce(name, split_part(coalesce(email, 'member'), '@', 1)),
         case when plan_status = 'pro' then 'pro' else 'free' end
    into nm, tier
    from public.user_profile where user_id = uid order by created_at desc limit 1;
  insert into public.feature_requests (user_id, author_name, author_tier, title, body)
    values (uid, coalesce(nm, 'Member'), coalesce(tier, 'free'), left(t, 120), left(b, 2000))
    returning id into new_id;
  return new_id;
end; $$;

-- Toggle the caller's vote and keep vote_count in sync (atomic). NOTE: the OUT
-- column is named `total` (not vote_count) so it can't shadow the table column
-- inside the UPDATE — that shadowing made the earlier version error on every vote.
-- (Renaming an OUT column changes the return type → drop the old one first.)
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

-- Admin moderation of the public board.
create or replace function public.admin_moderate_request(p_id uuid, p_pinned boolean, p_hidden boolean, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.feature_requests set pinned = p_pinned, hidden = p_hidden, status = p_status where id = p_id;
end; $$;

create or replace function public.admin_delete_request(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  delete from public.feature_requests where id = p_id;
end; $$;

-- Extend the bug-report update to also toggle the curated `public` flag (drop the
-- old 3-arg signature first so this replaces rather than overloads it).
drop function if exists public.admin_update_bug_report(uuid, text, text);
create or replace function public.admin_update_bug_report(p_id uuid, p_status text, p_notes text, p_public boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.bug_reports set status = p_status, admin_notes = p_notes, public = p_public where id = p_id;
end; $$;

-- Extend the admin bug list to expose the curated `public` flag (return-type
-- change → drop + recreate).
drop function if exists public.admin_list_bug_reports();
create or replace function public.admin_list_bug_reports()
returns table (id uuid, user_email text, title text, description text, page text, status text, admin_notes text, public boolean, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return query select b.id, b.user_email, b.title, b.description, b.page, b.status, b.admin_notes, b.public, b.created_at
    from public.bug_reports b order by b.created_at desc;
end; $$;

grant execute on function
  public.submit_feature_request(text, text),
  public.toggle_feature_vote(uuid),
  public.admin_moderate_request(uuid, boolean, boolean, text),
  public.admin_delete_request(uuid),
  public.admin_update_bug_report(uuid, text, text, boolean),
  public.admin_list_bug_reports()
to authenticated;

-- ── 5. DEMO SEEDS — ⚠ DEV ONLY · STRIP BEFORE PRODUCTION ⚠ ───────────────────
-- The Maya/Devon/Sam feature requests are FABRICATED demo data so the board isn't
-- empty on dev. Real users must NEVER see invented requests. Before this ever runs
-- against production, delete this whole block AND remove any rows already created:
--   delete from public.feature_requests where author_name in ('Maya C.','Devon R.','Sam L.');
--   delete from public.bug_reports where title = 'Calendar sync to Google is one-way for now';
--   update  public.bug_reports set public = false where title = 'Blueprint import dates off by a day';
insert into public.feature_requests (user_id, author_name, author_tier, title, body, vote_count, status)
select u.id, v.author_name, v.author_tier, v.title, v.body, v.vote_count, v.status
from (select id from auth.users where email = 'alexxdegryse@gmail.com' limit 1) u
cross join (values
  ('Maya C.',  'pro',  'Reminders the night before a deadline',  'A gentle nudge the evening before something is due — not just day-of.', 14, 'planned'),
  ('Devon R.', 'free', 'Bulk-paste grades from a spreadsheet',   'Let me paste a column of scores instead of typing each one.',           9,  'open'),
  ('Sam L.',   'free', 'Dark, printable calendar export',        'A clean month view I can export to PDF for the fridge.',                5,  'open')
) as v(author_name, author_tier, title, body, vote_count, status)
where not exists (select 1 from public.feature_requests fr where fr.title = v.title);

-- Surface one fixed + one known issue in the curated list.
update public.bug_reports set public = true, status = 'resolved'
  where title = 'Blueprint import dates off by a day';
insert into public.bug_reports (user_email, title, description, page, status, public)
select 'team@concordiatracker.com', 'Calendar sync to Google is one-way for now', 'Two-way sync is on the roadmap; today changes flow app → Google only.', '/app/calendar', 'in-progress', true
where not exists (select 1 from public.bug_reports b where b.title = 'Calendar sync to Google is one-way for now');
