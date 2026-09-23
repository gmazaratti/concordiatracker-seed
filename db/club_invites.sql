-- ============================================================================
-- Club invites: one flow, two modes, tracked per person.
--
-- Builds on org_invites rather than beside it — every invite ever sent is
-- already a row here and stays one. Additive and re-runnable.
--
-- THE TWO MODES
--   prefilled  the admin builds the club first (org_id is set at creation);
--              the first person to use the link takes it over and reviews it.
--   self       only a name + handle; the first person to use the link
--              creates the club and walks the whole setup wizard.
--
-- MULTI-USE MEANS "PEOPLE WHO MAY JOIN", NOT "TIMES IT MAY BE CLAIMED".
-- Before this, a second use of a prefilled link would have handed the club to
-- the second person and removed the first (the handoff branch clears the
-- team), and a second use of a self link would have failed on the handle
-- being taken. Now the FIRST use claims, and every later use JOINS the club
-- that first use produced, as a Member. A link can never take a club away
-- from the person it was given to.
--
-- TRACKING: org_invite_events holds one row per open / claim / join, with the
-- account when there was one. No policies: admins read it through a definer
-- function, and nothing else can.
-- ============================================================================

alter table public.org_invites add column if not exists mode text;
alter table public.org_invites add column if not exists created_by uuid references auth.users (id) on delete set null;
alter table public.org_invites add column if not exists claimed_at timestamptz;
alter table public.org_invites add column if not exists claimed_by uuid references auth.users (id) on delete set null;

update public.org_invites
   set mode = case when org_id is null then 'self' else 'prefilled' end
 where mode is null;
alter table public.org_invites alter column mode set default 'self';

do $$ begin
  alter table public.org_invites add constraint org_invites_mode_ck check (mode in ('self', 'prefilled'));
exception when duplicate_object then null; end $$;

-- Backfill the claim on rows already used, from the team they produced.
update public.org_invites i
   set claimed_at = coalesce(i.claimed_at, o.created_at),
       claimed_by = coalesce(i.claimed_by, o.owner_id)
  from public.organizations o
 where i.use_count > 0 and i.claimed_at is null and o.id = i.org_id;

create table if not exists public.org_invite_events (
  id         uuid primary key default gen_random_uuid(),
  invite_id  uuid not null references public.org_invites (id) on delete cascade,
  kind       text not null check (kind in ('open', 'claim', 'join')),
  user_id    uuid references auth.users (id) on delete set null,
  email      text,
  -- A random id the browser made for itself (analytics' ct_vid): tells two
  -- opens from one browser apart from two people. Never a fingerprint.
  visitor    text,
  at         timestamptz not null default now()
);
create index if not exists org_invite_events_invite_idx on public.org_invite_events (invite_id, at desc);
alter table public.org_invite_events enable row level security;

-- ── Opening a link ───────────────────────────────────────────────────────────
-- Replaces the one-argument version: two overloads with a defaulted second
-- argument make PostgREST answer PGRST203 to a call with only p_token.
drop function if exists public.record_org_invite_open(text);
create or replace function public.record_org_invite_open(p_token text, p_visitor text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare inv record; uemail text;
begin
  select * into inv from org_invites where token = p_token;
  if inv is null then return; end if;
  if auth.uid() is not null then
    select email into uemail from auth.users where id = auth.uid();
  end if;
  -- One row per browser per account state per hour: a reload is not a second
  -- open, but signing in afterwards is worth its own line (it names them).
  if not exists (
    select 1 from org_invite_events e
     where e.invite_id = inv.id and e.kind = 'open'
       and coalesce(e.visitor, '') = coalesce(left(p_visitor, 64), '')
       and e.user_id is not distinct from auth.uid()
       and e.at > now() - interval '1 hour'
  ) then
    insert into org_invite_events (invite_id, kind, user_id, email, visitor)
    values (inv.id, 'open', auth.uid(), uemail, left(p_visitor, 64));
  end if;
  update org_invites
     set opened_count = opened_count + 1,
         last_opened_at = now(),
         last_opened_email = coalesce(uemail, last_opened_email)
   where id = inv.id;
end $$;
grant execute on function public.record_org_invite_open(text, text) to anon, authenticated;

-- What the invite page needs to render: never the token's creator, never the
-- event trail. Mode + whether it has already been claimed decide the copy.
drop function if exists public.get_org_invite(text);
create or replace function public.get_org_invite(p_token text)
returns table (org_name text, org_handle text, recipient_email text, status text, mode text, claimed boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
  select i.org_name, i.org_handle, i.recipient_email,
         case when i.use_count >= i.max_uses then 'used'
              when i.expires_at < now() then 'expired'
              else 'valid' end,
         coalesce(i.mode, case when i.org_id is null then 'self' else 'prefilled' end),
         (i.use_count > 0)
    from org_invites i
   where i.token = p_token;
end $$;
grant execute on function public.get_org_invite(text) to anon, authenticated;

-- ── Accepting ────────────────────────────────────────────────────────────────
create or replace function public.accept_org_invite(p_token text, p_force boolean default false)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare inv record; target_org uuid; uemail text; uname text; av text; h text; removed int;
begin
  if auth.uid() is null then
    raise exception 'Sign in to accept an invite.';
  end if;
  select * into inv from org_invites where token = p_token for update;
  if inv is null then raise exception 'This invite link is not valid.'; end if;
  if inv.use_count >= inv.max_uses then raise exception 'This invite link has already been used.'; end if;
  if inv.expires_at < now() then raise exception 'This invite link has expired.'; end if;

  -- ADMIN = DRY RUN BY DEFAULT (unchanged): validate, write nothing.
  if public.is_admin() and not coalesce(p_force, false) then
    return jsonb_build_object('org_id', inv.org_id, 'dry_run', true);
  end if;

  select email into uemail from auth.users where id = auth.uid();
  select name, avatar_url into uname, av from public.user_profile where user_id = auth.uid();

  -- ── JOIN: the link has already been claimed once ─────────────────────────
  if inv.use_count > 0 and inv.org_id is not null then
    if not exists (select 1 from organizations where id = inv.org_id) then
      raise exception 'This organization no longer exists.';
    end if;
    if exists (select 1 from organizations o where o.id = inv.org_id and o.owner_id = auth.uid())
       or exists (select 1 from org_members m where m.org_id = inv.org_id and m.status = 'active'
                   and (m.user_id = auth.uid()
                        or (uemail is not null and m.email is not null and lower(m.email) = lower(uemail)))) then
      raise exception 'You already have access to this organization.';
    end if;
    insert into org_members (org_id, user_id, name, email, role, status, joined_at, avatar_url)
      values (inv.org_id, auth.uid(), coalesce(uname, split_part(coalesce(uemail, ''), '@', 1)),
              uemail, 'member', 'active', now(), av);
    update org_invites set use_count = use_count + 1 where id = inv.id;
    insert into org_invite_events (invite_id, kind, user_id, email) values (inv.id, 'join', auth.uid(), uemail);
    return jsonb_build_object('org_id', inv.org_id, 'dry_run', false, 'joined', true);
  end if;

  -- ── CLAIM a prefilled club (handoff) ─────────────────────────────────────
  if inv.org_id is not null then
    if not exists (select 1 from organizations where id = inv.org_id) then
      raise exception 'This organization no longer exists.';
    end if;
    delete from org_members where org_id = inv.org_id;
    get diagnostics removed = row_count;
    insert into org_members (org_id, user_id, name, email, role, status, joined_at, avatar_url)
      values (inv.org_id, auth.uid(), coalesce(uname, inv.org_name),
              coalesce(uemail, inv.recipient_email), 'owner', 'active', now(), av);
    perform set_config('ct.org_claim', '1', true);
    update organizations set owner_id = auth.uid() where id = inv.org_id;
    perform set_config('ct.org_claim', '', true);
    update org_invites set use_count = use_count + 1, claimed_at = now(), claimed_by = auth.uid() where id = inv.id;
    insert into org_invite_events (invite_id, kind, user_id, email) values (inv.id, 'claim', auth.uid(), uemail);
    return jsonb_build_object('org_id', inv.org_id, 'dry_run', false, 'removed_members', removed);
  end if;

  -- ── CREATE (self-setup) ──────────────────────────────────────────────────
  -- A cap rather than a flat refusal: running two clubs is normal (the
  -- sign-in page offers one button per club), a pile of them is not.
  if (select count(*) from organizations o where o.owner_id = auth.uid()) >= 3 then
    raise exception 'This account already manages three organizations.';
  end if;
  h := case when left(inv.org_handle, 1) = '@' then inv.org_handle else '@' || inv.org_handle end;
  if exists (select 1 from organizations o where lower(o.handle) = lower(h)) then
    raise exception 'An organization with the handle % already exists.', h;
  end if;
  insert into organizations (owner_id, handle, name, verified, glyph, color, bio, status)
    values (auth.uid(), h, inv.org_name, false, inv.glyph, inv.color, '', 'pending')
    returning id into target_org;
  insert into org_members (org_id, user_id, name, email, role, status, joined_at, avatar_url)
    values (target_org, auth.uid(), inv.org_name, coalesce(uemail, inv.recipient_email), 'owner', 'active', now(), av);
  -- The club this link produced: later uses join it rather than try to
  -- create a second one under a handle that is now taken.
  update org_invites
     set use_count = use_count + 1, org_id = target_org, claimed_at = now(), claimed_by = auth.uid()
   where id = inv.id;
  insert into org_invite_events (invite_id, kind, user_id, email) values (inv.id, 'claim', auth.uid(), uemail);
  return jsonb_build_object('org_id', target_org, 'dry_run', false, 'removed_members', 0);
end $$;

-- ── Admin: create ────────────────────────────────────────────────────────────
-- One call so the handle is checked by the SAME rule the setup wizard uses
-- (org_handle_problem) before anything exists: a club whose own wizard
-- refuses its handle can never finish setup.
create or replace function public.admin_create_club_invite(
  p_name text,
  p_handle text,
  p_mode text,
  p_max_uses int default 1,
  p_expires_at timestamptz default null,
  p_color text default '#5b9cf6',
  p_bio text default '',
  p_email text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare h text; bare text; problem text; glyph text; tok text; new_org uuid; words text[];
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if length(coalesce(trim(p_name), '')) < 2 then raise exception 'Give the club a name.'; end if;
  if p_mode not in ('self', 'prefilled') then raise exception 'Unknown mode.'; end if;
  bare := lower(regexp_replace(coalesce(p_handle, ''), '^@+', ''));
  problem := public.org_handle_problem(bare, null);
  if problem is not null then raise exception '%', problem; end if;
  -- An unclaimed self-setup invite reserves nothing in organizations, so two
  -- open invites could promise the same handle. Refuse the second one.
  if exists (select 1 from org_invites i
              where lower(regexp_replace(i.org_handle, '^@+', '')) = bare
                and i.org_id is null and i.use_count < i.max_uses and i.expires_at > now()) then
    raise exception 'Another open invite already offers @%.', bare;
  end if;
  h := '@' || bare;
  words := regexp_split_to_array(trim(p_name), '\s+');
  glyph := upper(case when array_length(words, 1) >= 2 then left(words[1], 1) || left(words[2], 1)
                      else left(words[1], 2) end);
  -- 128 bits from two v4 UUIDs, no pgcrypto: unguessable, and URL-safe.
  tok := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  tok := left(tok, 40);

  if p_mode = 'prefilled' then
    -- Approved: the admin built it. setup_completed_at stays null, so the
    -- person who claims it lands in the wizard to review everything.
    insert into organizations (owner_id, handle, name, verified, glyph, color, bio, status)
      values (null, h, trim(p_name), false, glyph, coalesce(p_color, '#5b9cf6'), coalesce(p_bio, ''), 'approved')
      returning id into new_org;
  end if;

  insert into org_invites (token, org_name, org_handle, glyph, color, recipient_email,
                           max_uses, expires_at, org_id, mode, created_by)
  values (tok, trim(p_name), h, glyph, coalesce(p_color, '#5b9cf6'), nullif(trim(coalesce(p_email, '')), ''),
          greatest(1, coalesce(p_max_uses, 1)), coalesce(p_expires_at, now() + interval '30 days'),
          new_org, p_mode, auth.uid());
  return jsonb_build_object('token', tok, 'org_id', new_org);
end $$;

-- ── Admin: edit / delete / list / trail ─────────────────────────────────────
create or replace function public.admin_update_club_invite(p_token text, p_max_uses int, p_expires_at timestamptz)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update org_invites
     set max_uses = greatest(coalesce(p_max_uses, max_uses), use_count, 1),
         expires_at = coalesce(p_expires_at, expires_at)
   where token = p_token;
end $$;

-- Deleting an invite never deletes the club it produced: the link is gone,
-- the club and its team are not. (org_invite_events cascade with the link.)
create or replace function public.admin_delete_club_invite(p_token text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  delete from org_invites where token = p_token;
end $$;

drop function if exists public.admin_club_invites();
create or replace function public.admin_club_invites()
returns table (
  token text, org_name text, org_handle text, mode text, recipient_email text,
  max_uses int, use_count int, expires_at timestamptz, created_at timestamptz,
  org_id uuid, org_status text, opens int, first_open_at timestamptz, last_open_at timestamptz,
  signed_in_opens int, claimed_at timestamptz, claimed_email text
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return query
  select i.token, i.org_name, i.org_handle,
         coalesce(i.mode, case when i.org_id is null then 'self' else 'prefilled' end),
         i.recipient_email, i.max_uses, i.use_count, i.expires_at, i.created_at,
         i.org_id, o.status,
         -- Legacy rows predate the event table: fall back to their counter.
         greatest(coalesce(ev.opens, 0), case when ev.opens is null then i.opened_count else 0 end),
         ev.first_at, coalesce(ev.last_at, i.last_opened_at),
         coalesce(ev.signed_in, 0),
         i.claimed_at, cu.email::text
    from org_invites i
    left join organizations o on o.id = i.org_id
    left join auth.users cu on cu.id = i.claimed_by
    left join lateral (
      select count(*)::int opens, min(e.at) first_at, max(e.at) last_at,
             count(*) filter (where e.user_id is not null)::int signed_in
        from org_invite_events e where e.invite_id = i.id and e.kind = 'open'
    ) ev on true
   order by i.created_at desc;
end $$;

drop function if exists public.admin_club_invite_events(text);
create or replace function public.admin_club_invite_events(p_token text)
returns table (kind text, at timestamptz, email text, name text, handle text, signed_in boolean, visitor text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return query
  select e.kind, e.at, coalesce(e.email, u.email::text), p.name, p.handle, (e.user_id is not null), e.visitor
    from org_invite_events e
    join org_invites i on i.id = e.invite_id
    left join auth.users u on u.id = e.user_id
    left join user_profile p on p.user_id = e.user_id
   where i.token = p_token
   order by e.at desc
   limit 200;
end $$;

revoke all on function public.admin_create_club_invite(text, text, text, int, timestamptz, text, text, text) from public, anon;
revoke all on function public.admin_update_club_invite(text, int, timestamptz) from public, anon;
revoke all on function public.admin_delete_club_invite(text) from public, anon;
revoke all on function public.admin_club_invites() from public, anon;
revoke all on function public.admin_club_invite_events(text) from public, anon;
grant execute on function public.admin_create_club_invite(text, text, text, int, timestamptz, text, text, text) to authenticated;
grant execute on function public.admin_update_club_invite(text, int, timestamptz) to authenticated;
grant execute on function public.admin_delete_club_invite(text) to authenticated;
grant execute on function public.admin_club_invites() to authenticated;
grant execute on function public.admin_club_invite_events(text) to authenticated;
