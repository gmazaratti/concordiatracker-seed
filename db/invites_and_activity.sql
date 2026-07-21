-- ── Real org invites (single-use, limited, revocable) + org activity log ─────
-- WHY: invite links were stateless (the org data lived in the URL), so they
-- couldn't be single-use, expiring, or revocable — not good enough for real
-- clubs. This makes invites DB-backed:
--   admin creates → recipient opens the link (view is public), signs in with
--   Google, accepts (atomic, counted) → a PENDING org + owner membership is
--   created → onboarding runs → admin approves in Admin → Portals.
-- Also adds org_activity — a per-org audit trail ("who did what") shown on the
-- organizer Team page.
--
-- RUN AFTER the matching app deploy. Safe to re-run.

-- ── org_invites ──────────────────────────────────────────────────────────────
create table if not exists public.org_invites (
  id              uuid primary key default gen_random_uuid(),
  token           text unique not null,
  org_name        text not null,
  org_handle      text not null,
  glyph           text not null default 'OR',
  color           text not null default '#5b9cf6',
  recipient_email text,
  max_uses        int not null default 1,
  use_count       int not null default 0,
  expires_at      timestamptz not null default now() + interval '14 days',
  created_at      timestamptz not null default now()
);
alter table public.org_invites enable row level security;
-- Admin-only table access; invitees go through the token-scoped RPCs below.
drop policy if exists "org_invites_admin" on public.org_invites;
create policy "org_invites_admin" on public.org_invites for all
  using (public.is_admin()) with check (public.is_admin());

-- Token-scoped read for the accept page (works signed-out).
create or replace function public.get_org_invite(p_token text)
returns table (org_name text, org_handle text, recipient_email text, status text)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
  select i.org_name, i.org_handle, i.recipient_email,
         case
           when i.use_count >= i.max_uses then 'used'
           when i.expires_at < now() then 'expired'
           else 'valid'
         end
  from org_invites i
  where i.token = p_token;
end $$;
grant execute on function public.get_org_invite(text) to anon, authenticated;

-- Atomic accept: validates + counts the use, creates the PENDING org owned by
-- the caller, and seeds their owner membership. Single-use is enforced here
-- (row lock + use_count), not in the client.
create or replace function public.accept_org_invite(p_token text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare inv record; new_org uuid; uemail text; h text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to accept an invite.';
  end if;
  select * into inv from org_invites where token = p_token for update;
  if inv is null then
    raise exception 'This invite link is not valid.';
  end if;
  if inv.use_count >= inv.max_uses then
    raise exception 'This invite link has already been used.';
  end if;
  if inv.expires_at < now() then
    raise exception 'This invite link has expired.';
  end if;
  if exists (select 1 from organizations o where o.owner_id = auth.uid()) then
    raise exception 'This account already manages an organization.';
  end if;
  h := case when left(inv.org_handle, 1) = '@' then inv.org_handle else '@' || inv.org_handle end;
  if exists (select 1 from organizations o where lower(o.handle) = lower(h)) then
    raise exception 'An organization with the handle % already exists.', h;
  end if;
  select email into uemail from auth.users where id = auth.uid();
  insert into organizations (owner_id, handle, name, verified, glyph, color, bio, status)
    values (auth.uid(), h, inv.org_name, false, inv.glyph, inv.color, '', 'pending')
    returning id into new_org;
  insert into org_members (org_id, user_id, name, email, role, status, joined_at)
    values (new_org, auth.uid(), inv.org_name, coalesce(uemail, inv.recipient_email), 'owner', 'active', now());
  update org_invites set use_count = use_count + 1 where id = inv.id;
  return new_org;
end $$;
grant execute on function public.accept_org_invite(text) to authenticated;

-- ── org_activity (the Team page's "who did what" trail) ──────────────────────
create table if not exists public.org_activity (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  actor_name  text not null default '',
  actor_email text not null default '',
  action      text not null,
  detail      text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists org_activity_org_idx on public.org_activity (org_id, created_at desc);
alter table public.org_activity enable row level security;
drop policy if exists "org_activity_read"  on public.org_activity;
drop policy if exists "org_activity_write" on public.org_activity;
create policy "org_activity_read" on public.org_activity for select using (
  exists (select 1 from public.organizations o where o.id = org_id and o.owner_id = auth.uid())
  or public.is_org_editor(org_id)
);
create policy "org_activity_write" on public.org_activity for insert with check (
  exists (select 1 from public.organizations o where o.id = org_id and o.owner_id = auth.uid())
  or public.is_org_editor(org_id)
);
