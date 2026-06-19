-- ============================================================================
-- Feedback → feature-request FEED (emoji reactions + inline comments). DEV ONLY.
-- Restyles the votable board into a social-style feed while staying a FEATURE-
-- REQUEST board: emoji reactions become the engagement/demand signal (replacing
-- the single heart-vote in the UI), and each request gains inline comments.
-- Moderation runs through is_admin()-gated RPCs (your account only).
--
-- NOTE: the old feature_request_votes table + toggle_feature_vote RPC are left in
-- place but the new UI stops using them (superseded by reactions). Safe to drop
-- later once nothing references them.
-- ============================================================================

-- 1. Reactions — one of each emoji per user per request. Public read (counts are
--    public, like the reference); all writes go through toggle_feature_reaction().
create table if not exists public.feature_request_reactions (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.feature_requests(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  emoji      text not null,
  created_at timestamptz not null default now(),
  unique (request_id, user_id, emoji)
);
alter table public.feature_request_reactions enable row level security;
drop policy if exists "frr_read" on public.feature_request_reactions;
create policy "frr_read" on public.feature_request_reactions for select using (true);

-- 2. Comments — public read (hidden ones only to admins). Inserts via
--    add_feature_comment() so tier can't be spoofed; authors delete their own;
--    admins hide/delete via the RPCs below.
create table if not exists public.feature_request_comments (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.feature_requests(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  author_tier text not null default 'free',
  is_staff    boolean not null default false,    -- true = an admin reply → "Admin" badge
  body        text not null,
  hidden      boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table public.feature_request_comments add column if not exists is_staff boolean not null default false;
alter table public.feature_request_comments enable row level security;
drop policy if exists "frc_read"       on public.feature_request_comments;
drop policy if exists "frc_delete_own" on public.feature_request_comments;
create policy "frc_read"       on public.feature_request_comments for select using (not hidden or public.is_admin());
create policy "frc_delete_own" on public.feature_request_comments for delete using (auth.uid() = user_id);

-- 3. RPCs --------------------------------------------------------------------
-- Toggle one emoji reaction (add if absent, remove if present).
create or replace function public.toggle_feature_reaction(p_request_id uuid, p_emoji text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); existing uuid;
begin
  if uid is null then raise exception 'Sign in to react.'; end if;
  if length(trim(coalesce(p_emoji, ''))) = 0 then raise exception 'No emoji.'; end if;
  select id into existing from public.feature_request_reactions
    where request_id = p_request_id and user_id = uid and emoji = p_emoji;
  if existing is null then
    insert into public.feature_request_reactions (request_id, user_id, emoji) values (p_request_id, uid, p_emoji);
  else
    delete from public.feature_request_reactions where id = existing;
  end if;
end; $$;

-- Add a comment — reads the caller's real name + tier server-side; basic guard.
create or replace function public.add_feature_comment(p_request_id uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); nm text; tier text; new_id uuid; b text := trim(coalesce(p_body, ''));
begin
  if uid is null then raise exception 'Sign in to comment.'; end if;
  if length(b) < 1 then raise exception 'Write something first.'; end if;
  if b ~* '\m(fuck|shit|cunt|nigger|faggot|retard|bitch)\M' then
    raise exception 'Please keep it respectful — that comment was blocked.';
  end if;
  select coalesce(name, split_part(coalesce(email, 'member'), '@', 1)),
         case when plan_status = 'pro' then 'pro' else 'free' end
    into nm, tier from public.user_profile where user_id = uid order by created_at desc limit 1;
  insert into public.feature_request_comments (request_id, user_id, author_name, author_tier, is_staff, body)
    values (p_request_id, uid, coalesce(nm, 'Member'), coalesce(tier, 'free'), public.is_admin(), left(b, 1000))
    returning id into new_id;
  return new_id;
end; $$;

-- Admin comment moderation.
create or replace function public.admin_moderate_comment(p_id uuid, p_hidden boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.feature_request_comments set hidden = p_hidden where id = p_id;
end; $$;

create or replace function public.admin_delete_comment(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  delete from public.feature_request_comments where id = p_id;
end; $$;

grant execute on function
  public.toggle_feature_reaction(uuid, text),
  public.add_feature_comment(uuid, text),
  public.admin_moderate_comment(uuid, boolean),
  public.admin_delete_comment(uuid)
to authenticated;

-- 4. DEMO SEEDS — ⚠ DEV ONLY · STRIP BEFORE PRODUCTION ⚠ ---------------------
-- A couple of reactions + a comment on the existing demo requests, authored by
-- the admin account, so the feed isn't socially empty. Real counts stay low
-- (each emoji is unique per user, and there's only one seed user). Remove before
-- prod: delete from feature_request_reactions; delete from feature_request_comments;
do $$
declare admin_id uuid; req_id uuid;
begin
  select id into admin_id from auth.users where email = 'alexxdegryse@gmail.com' limit 1;
  if admin_id is null then return; end if;
  for req_id in select id from public.feature_requests where author_name in ('Maya C.', 'Devon R.') loop
    insert into public.feature_request_reactions (request_id, user_id, emoji)
      values (req_id, admin_id, '❤️') on conflict do nothing;
  end loop;
  select id into req_id from public.feature_requests where author_name = 'Maya C.' limit 1;
  if req_id is not null and not exists (
    select 1 from public.feature_request_comments where request_id = req_id and body like 'Great idea%'
  ) then
    insert into public.feature_request_comments (request_id, user_id, author_name, author_tier, is_staff, body)
      values (req_id, admin_id, 'ConcordiaTracker', 'pro', true, 'Great idea — we''re scoping this for next cycle.');
  end if;
end $$;

-- Fix a re-run where the seed comment predates the is_staff column (give it the badge).
update public.feature_request_comments set is_staff = true
  where author_name = 'ConcordiaTracker' and body like 'Great idea%';
