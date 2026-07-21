-- ── CASA handoff: @casa.jmsb → @casajmsb + invite-to-an-EXISTING-org ─────────
-- WHAT:
--   1. Renames the seeded CASA org's handle to @casajmsb (events/follows key by
--      org id, so nothing else moves; the profile URL follows the new handle).
--   2. org_invites.org_id — an invite can now HAND OFF an existing org instead
--      of creating a new one: the accepter becomes an owner-member and, if the
--      org has no real owner yet (seeded orgs), takes ownership. Logos, banner,
--      bio, and events come with it.
--   3. accept_org_invite now returns jsonb and treats an ADMIN accept as a DRY
--      RUN: the link is fully validated but nothing is written and no use is
--      consumed — so you can test the exact flow before sending it.
--   4. Mints the single-use CASA invite and PRINTS THE READY-TO-SEND LINK in
--      the result pane (kept out of chat/repo — this file is public).
--
-- RUN AFTER the matching app deploy. Safe to re-run (the invite is minted once;
-- re-running just re-prints the existing link).

-- 1) Handle rename
update public.organizations set handle = '@casajmsb' where handle = '@casa.jmsb';

-- Keep the weekly seed-event refresh tracking the renamed handle.
create or replace function public.refresh_seed_events()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  with seed_orgs as (
    select id from organizations
    where handle in (
      '@concordiagamedev', '@gamedev.conu', '@ginacody', '@concordia.hub',
      '@conu.caps', '@concordia.president', '@hackconcordia', '@conu.outdoors',
      '@concordia.library', '@concordia', '@jmsb', '@casajmsb', '@casa.jmsb',
      '@jmis', '@conu.mathhelp'
    )
  ),
  stale as (
    select e.id,
           row_number() over (order by e.start, e.id) as rn,
           greatest(count(*) over () - 1, 1) as span
    from events e
    join seed_orgs so on so.id = e.org_id
    where e.start < now()
      and e.title not in (
        'Intro to Git & GitHub workshop',
        'Capstone project showcase',
        'JMSB Welcome Week mixer',
        'CASA Frosh kickoff'
      )
  )
  update events e
  set start = date_trunc('day', now())
            + make_interval(
                days  => (1 + ((s.rn - 1) * 13) / s.span)::int,
                hours => (16 + s.rn % 4)::int,
                mins  => (case when s.rn % 2 = 0 then 30 else 0 end)::int
              ),
      posted_at = now() - make_interval(days => (1 + s.rn % 5)::int)
  from stale s
  where e.id = s.id;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.refresh_seed_events() from public, anon, authenticated;

-- 2) Invites can target an existing org
alter table public.org_invites
  add column if not exists org_id uuid references public.organizations(id) on delete cascade;

-- 3) accept_org_invite v3 — jsonb result, handoff path, admin dry-run.
drop function if exists public.accept_org_invite(text);
create function public.accept_org_invite(p_token text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare inv record; target_org uuid; org_owner uuid; uemail text; uname text; av text; h text;
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

  -- ADMIN = DRY RUN: the link is fully validated, nothing is written, no use
  -- is consumed — test the flow, then send the same link.
  if public.is_admin() then
    return jsonb_build_object('org_id', inv.org_id, 'dry_run', true);
  end if;

  select email into uemail from auth.users where id = auth.uid();
  select name, avatar_url into uname, av from public.user_profile where user_id = auth.uid();

  if inv.org_id is not null then
    -- HANDOFF: join (and take ownership of) the existing org.
    select owner_id into org_owner from organizations where id = inv.org_id;
    if not found then
      raise exception 'This organization no longer exists.';
    end if;
    if exists (
      select 1 from org_members m
      where m.org_id = inv.org_id and m.status = 'active'
        and (m.user_id = auth.uid()
             or (uemail is not null and m.email is not null and lower(m.email) = lower(uemail)))
    ) then
      raise exception 'You already have access to this organization.';
    end if;
    insert into org_members (org_id, user_id, name, email, role, status, joined_at, avatar_url)
      values (inv.org_id, auth.uid(), coalesce(uname, inv.org_name),
              coalesce(uemail, inv.recipient_email), 'owner', 'active', now(), av);
    if org_owner is null then
      update organizations set owner_id = auth.uid() where id = inv.org_id;
    end if;
    update org_invites set use_count = use_count + 1 where id = inv.id;
    return jsonb_build_object('org_id', inv.org_id, 'dry_run', false);
  end if;

  -- CREATE a brand-new org (the original path).
  if exists (select 1 from organizations o where o.owner_id = auth.uid()) then
    raise exception 'This account already manages an organization.';
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
  update org_invites set use_count = use_count + 1 where id = inv.id;
  return jsonb_build_object('org_id', target_org, 'dry_run', false);
end $$;
grant execute on function public.accept_org_invite(text) to authenticated;

-- 4) Mint the CASA handoff invite (once) and print the ready-to-send link.
insert into public.org_invites (token, org_name, org_handle, glyph, color, recipient_email, max_uses, org_id)
select 'oiv_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 20),
       'CASA JMSB', '@casajmsb', 'CJ', '#9b2335', 'sofia.morales@casajmsb.ca', 1, o.id
from public.organizations o
where o.handle = '@casajmsb'
  and not exists (select 1 from public.org_invites i where i.org_id = o.id);

select 'https://concordiatracker.com/organizer/invite/' || i.token as casa_invite_link,
       i.use_count, i.max_uses, i.expires_at
from public.org_invites i
join public.organizations o on o.id = i.org_id
where o.handle = '@casajmsb'
order by i.created_at desc
limit 1;
