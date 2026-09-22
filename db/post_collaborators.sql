-- ============================================================================
-- Co-authored posts: two clubs, one post.
-- RUN IN: Supabase SQL Editor. Safe to re-run. Non-destructive.
--
-- THE SHAPE, and the one decision everything else follows from: A POST HAS
-- EXACTLY ONE AUTHOR ROW AND ALWAYS DID. `org_posts.org_id` is who published
-- it, and that never changes. A collaborator is an ATTACHMENT to that post,
-- not a second copy of it.
--
-- That is what makes "appears on both profiles and in the feed once" true by
-- construction rather than by a de-duplication pass: there is only one row, so
-- there is only ever one card. A design that inserted a mirrored post for the
-- co-author would have had to keep two rows' likes, comments, edits and
-- deletions in step forever, and would have shown the post twice to anybody
-- who follows both clubs.
--
-- PUBLISHING IS NOT BLOCKED ON ACCEPTANCE. The post goes out immediately under
-- the org that wrote it; the co-author's name appears when they say yes. A
-- post held hostage by an unanswered invite is a post that misses the event it
-- was about.
--
-- THE TABLE IS ITS OWN AUDIT TRAIL. `invited_by`, `invited_at` and
-- `decided_at` record who attached whom and when, and the notification goes to
-- the affected club at the moment it happens. Ordinary publishing from a
-- browser is not written to `admin_audit_log` anywhere in this codebase — that
-- log is for admin and API-agent actions — so this does not start.
-- ============================================================================

create table if not exists public.post_collaborators (
  post_id    uuid not null references public.org_posts (id)    on delete cascade,
  org_id     uuid not null references public.organizations (id) on delete cascade,
  status     text not null default 'pending'
             check (status in ('pending', 'accepted', 'declined')),
  -- Which human sent it. Never shown; it is what makes the invite
  -- attributable when a club asks who put their name on something.
  invited_by uuid references auth.users (id) on delete set null,
  invited_at timestamptz not null default now(),
  decided_at timestamptz,
  -- ONE ROW PER PAIR, which is "one pending invite per (post, org)" for free.
  -- A declined invite keeps its row and can be re-sent by moving it back to
  -- pending: a no today is not a no forever, and deleting the row would lose
  -- the fact that it was ever asked.
  primary key (post_id, org_id)
);

create index if not exists post_collab_org_idx
  on public.post_collaborators (org_id, status);

alter table public.post_collaborators enable row level security;

-- ── An org cannot invite itself ─────────────────────────────────────────────
-- A CHECK constraint cannot see another table, so this is a trigger. It is
-- also enforced in `invite_collaborator`, which is the only door — this is the
-- floor under it, so a future writer cannot create the row a different way.
create or replace function public.ct_collab_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_author uuid;
begin
  select org_id into v_author from public.org_posts where id = new.post_id;
  if v_author is null then
    raise exception 'That post does not exist.' using errcode = 'foreign_key_violation';
  end if;
  if v_author = new.org_id then
    raise exception 'An organisation cannot collaborate with itself on its own post.'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists trg_collab_guard on public.post_collaborators;
create trigger trg_collab_guard
  before insert or update of org_id on public.post_collaborators
  for each row execute function public.ct_collab_guard();

-- ── Deleting the post takes its collaborators ───────────────────────────────
-- The FK cascade handles a hard delete. Posts here are SOFT-deleted, so the
-- row would otherwise survive as an accepted collaboration on something
-- nobody can see — and would come back if the post were ever un-hidden.
create or replace function public.ct_collab_on_post_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.deleted and not coalesce(old.deleted, false) then
    delete from public.post_collaborators where post_id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists trg_collab_post_delete on public.org_posts;
create trigger trg_collab_post_delete
  after update of deleted on public.org_posts
  for each row execute function public.ct_collab_on_post_delete();

-- ── Who can see a collaboration ─────────────────────────────────────────────
-- ACCEPTED is public, because it is printed on the post's header and hiding it
-- would mean the header could not be drawn. PENDING and DECLINED are private
-- to the two clubs involved: an invite nobody answered yet is a conversation,
-- and a decline is nobody else's business.
drop policy if exists post_collab_read on public.post_collaborators;
create policy post_collab_read on public.post_collaborators
  for select to anon, authenticated
  using (
    (
      status = 'accepted'
      and exists (
        select 1 from public.org_posts p
          join public.organizations o on o.id = p.org_id
         where p.id = post_id and not p.deleted
           and coalesce(o.status, 'pending') = 'approved'
      )
    )
    or public.ct_can_act_as_org(org_id)
    or exists (
      select 1 from public.org_posts p
       where p.id = post_id and public.ct_can_act_as_org(p.org_id)
    )
  );

-- No insert, update or delete policy. Every write goes through one of the
-- SECURITY DEFINER functions below, which is the same rule tickets, blocks and
-- notifications follow: the interesting authorisation here is "which SIDE are
-- you on", and a policy cannot express "the inviter may cancel but not accept".

-- ── Who to tell ─────────────────────────────────────────────────────────────
/** Everyone who can act for an organisation: its owner and its active team. */
create or replace function public.ct_org_people(p_org uuid)
returns setof uuid
language sql stable security definer set search_path = public as $$
  select o.owner_id from public.organizations o where o.id = p_org and o.owner_id is not null
  union
  select m.user_id from public.org_members m
   where m.org_id = p_org and coalesce(m.status, 'active') = 'active' and m.user_id is not null
$$;

create or replace function public.ct_collab_notify(
  p_org uuid, p_kind text, p_title text, p_body text, p_link text, p_exclude uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare audience uuid[];
begin
  select array_agg(u) into audience
    from public.ct_org_people(p_org) u
   where p_exclude is null or u <> p_exclude;
  if audience is null then return; end if;
  perform public.ct_notify(audience, p_kind, p_title, p_body, p_link, null, null);
end $$;

/** The post's public address, for a notification that has to land somewhere. */
create or replace function public.ct_post_link(p_post uuid)
returns text
language sql stable security definer set search_path = public as $$
  select '/app/community/org/' || replace(o.handle, '@', '') || '?tab=posts&post=' || p.id::text
    from public.org_posts p join public.organizations o on o.id = p.org_id
   where p.id = p_post;
$$;

-- ── Inviting ────────────────────────────────────────────────────────────────
create or replace function public.invite_collaborator(p_post uuid, p_org uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare v_author uuid; v_author_name text; v_target_status text; v_existing text;
begin
  select p.org_id into v_author from public.org_posts p where p.id = p_post and not p.deleted;
  if v_author is null then return 'no_post'; end if;
  -- The INVITER must be able to act as the org that published it. Being the
  -- invitee's officer is not enough: you cannot add your own club to somebody
  -- else's post.
  if not public.ct_can_act_as_org(v_author) then return 'not_yours'; end if;
  if v_author = p_org then return 'self'; end if;

  select coalesce(o.status, 'pending') into v_target_status
    from public.organizations o where o.id = p_org;
  if v_target_status is null then return 'no_org'; end if;
  if v_target_status <> 'approved' then return 'not_approved'; end if;

  select status into v_existing from public.post_collaborators
   where post_id = p_post and org_id = p_org;
  if v_existing = 'pending'  then return 'already_pending'; end if;
  if v_existing = 'accepted' then return 'already_accepted'; end if;

  insert into public.post_collaborators (post_id, org_id, status, invited_by, invited_at, decided_at)
  values (p_post, p_org, 'pending', auth.uid(), now(), null)
  on conflict (post_id, org_id) do update
    set status = 'pending', invited_by = auth.uid(), invited_at = now(), decided_at = null;

  select o.name into v_author_name from public.organizations o where o.id = v_author;
  perform public.ct_collab_notify(
    p_org, 'collab_invite',
    coalesce(v_author_name, 'An organisation') || ' invited you to collaborate on a post.',
    'Accept it and the post appears on your profile with both names on it.',
    '/organizer/collabs',
    auth.uid()
  );
  return 'ok';
end $$;

/** The inviter changing their mind. Only ever a PENDING row: withdrawing a
 *  collaboration somebody already accepted is `remove_collaborator`, which
 *  tells them. */
create or replace function public.cancel_collab_invite(p_post uuid, p_org uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare v_author uuid; n int;
begin
  select p.org_id into v_author from public.org_posts p where p.id = p_post;
  if v_author is null then return 'no_post'; end if;
  if not public.ct_can_act_as_org(v_author) then return 'not_yours'; end if;
  delete from public.post_collaborators
   where post_id = p_post and org_id = p_org and status = 'pending';
  get diagnostics n = row_count;
  return case when n > 0 then 'ok' else 'not_pending' end;
end $$;

-- ── Answering ───────────────────────────────────────────────────────────────
create or replace function public.respond_collab_invite(
  p_post uuid, p_org uuid, p_accept boolean
) returns text
language plpgsql security definer set search_path = public as $$
declare v_author uuid; v_name text; n int;
begin
  -- The INVITEE decides. `ct_can_act_as_org` on the invited org is the whole
  -- authorisation, and it is asked of the database rather than trusted from
  -- the caller's arguments.
  if not public.ct_can_act_as_org(p_org) then return 'not_yours'; end if;

  update public.post_collaborators
     set status = case when p_accept then 'accepted' else 'declined' end,
         decided_at = now()
   where post_id = p_post and org_id = p_org and status = 'pending';
  get diagnostics n = row_count;
  if n = 0 then return 'not_pending'; end if;

  select p.org_id into v_author from public.org_posts p where p.id = p_post;
  select o.name into v_name from public.organizations o where o.id = p_org;
  perform public.ct_collab_notify(
    v_author,
    case when p_accept then 'collab_accepted' else 'collab_declined' end,
    coalesce(v_name, 'An organisation')
      || case when p_accept then ' accepted your collab invite.' else ' declined your collab invite.' end,
    case when p_accept then 'The post now shows both names and is on both profiles.' else null end,
    public.ct_post_link(p_post),
    auth.uid()
  );
  return 'ok';
end $$;

-- ── Undoing it later ────────────────────────────────────────────────────────
/**
 * EITHER side can end a collaboration, and the other one is told.
 *
 * Symmetric on purpose: a club that finds its name on a post it no longer
 * wants to be on should not have to ask the poster to take it off, and a
 * poster should not need permission to un-attach somebody. The post reverts
 * to solo either way — it was never the collaborator's post to lose.
 */
create or replace function public.remove_collaborator(p_post uuid, p_org uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare v_author uuid; v_mine boolean; v_theirs boolean; v_actor text; n int;
begin
  select p.org_id into v_author from public.org_posts p where p.id = p_post;
  if v_author is null then return 'no_post'; end if;
  v_mine   := public.ct_can_act_as_org(v_author);
  v_theirs := public.ct_can_act_as_org(p_org);
  if not (v_mine or v_theirs) then return 'not_yours'; end if;

  delete from public.post_collaborators where post_id = p_post and org_id = p_org;
  get diagnostics n = row_count;
  if n = 0 then return 'not_found'; end if;

  -- Tell the OTHER side, whichever that is. Telling the person who pressed
  -- the button is noise.
  if v_mine then
    select o.name into v_actor from public.organizations o where o.id = v_author;
    perform public.ct_collab_notify(p_org, 'collab_removed',
      coalesce(v_actor, 'An organisation') || ' removed your collaboration on a post.',
      null, public.ct_post_link(p_post), auth.uid());
  else
    select o.name into v_actor from public.organizations o where o.id = p_org;
    perform public.ct_collab_notify(v_author, 'collab_removed',
      coalesce(v_actor, 'An organisation') || ' left a post you co-authored.',
      null, public.ct_post_link(p_post), auth.uid());
  end if;
  return 'ok';
end $$;

grant execute on function public.invite_collaborator(uuid, uuid)        to authenticated;
grant execute on function public.cancel_collab_invite(uuid, uuid)       to authenticated;
grant execute on function public.respond_collab_invite(uuid, uuid, boolean) to authenticated;
grant execute on function public.remove_collaborator(uuid, uuid)        to authenticated;

-- ── The portal's list ───────────────────────────────────────────────────────
/**
 * Every invite either side of the orgs you can act for.
 *
 * ONE call rather than two, because "incoming" and "outgoing" are the same
 * row seen from opposite ends and splitting them into two functions is how
 * they start disagreeing about what a pending invite is.
 */
create or replace function public.my_collab_invites()
returns table (
  post_id      uuid,
  org_id       uuid,
  direction    text,          -- 'incoming' | 'outgoing'
  status       text,
  invited_at   timestamptz,
  decided_at   timestamptz,
  author_org   uuid,
  author_handle text,
  author_name  text,
  author_logo  text,
  author_color text,
  author_glyph text,
  other_handle text,
  other_name   text,
  other_logo   text,
  other_color  text,
  other_glyph  text,
  caption      text,
  media        jsonb,
  created_at   timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    c.post_id,
    c.org_id,
    case when public.ct_can_act_as_org(c.org_id) then 'incoming' else 'outgoing' end,
    c.status, c.invited_at, c.decided_at,
    a.id, a.handle, a.name, a.logo, a.color, a.glyph,
    t.handle, t.name, t.logo, t.color, t.glyph,
    p.caption, p.media, p.created_at
  from public.post_collaborators c
  join public.org_posts p     on p.id = c.post_id and not p.deleted
  join public.organizations a on a.id = p.org_id
  join public.organizations t on t.id = c.org_id
  where public.ct_can_act_as_org(c.org_id) or public.ct_can_act_as_org(p.org_id)
  order by c.invited_at desc
  limit 100;
$$;
grant execute on function public.my_collab_invites() to authenticated;

-- ── The feed learns about co-authors ────────────────────────────────────────
-- Dropped first: `create or replace` cannot widen the row type of a
-- `returns table` function — Postgres answers 42P13 and refuses the file.
drop function if exists public.post_feed(uuid, boolean, int, int);

create or replace function public.post_feed(
  p_org       uuid default null,
  p_following boolean default false,
  p_limit     int default 20,
  p_offset    int default 0
)
returns table (
  id          uuid,
  org_id      uuid,
  handle      text,
  org_name    text,
  logo        text,
  color       text,
  glyph       text,
  verified    boolean,
  caption     text,
  media       jsonb,
  created_at  timestamptz,
  likes       integer,
  comments    integer,
  reposts     integer,
  i_like      boolean,
  i_repost    boolean,
  -- Accepted co-authors only, and only ones still approved: a deactivated
  -- organisation's collaborations are hidden while the post itself survives.
  collaborators jsonb
)
language sql stable security definer set search_path = public as $$
  select p.id, o.id, o.handle, o.name, o.logo, o.color, o.glyph, coalesce(o.verified, false),
         p.caption, p.media, p.created_at,
         (select count(*)::int from public.post_likes l where l.post_id = p.id),
         (select count(*)::int from public.post_comments c where c.post_id = p.id and not c.deleted),
         (select count(*)::int from public.reposts r
           where r.target_kind = 'post' and r.target_id = p.id::text),
         exists (select 1 from public.post_likes l where l.post_id = p.id and l.user_id = auth.uid()),
         exists (select 1 from public.reposts r
                  where r.target_kind = 'post' and r.target_id = p.id::text
                    and r.actor_user = auth.uid()),
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'org_id', co.id, 'handle', co.handle, 'name', co.name,
                    'logo', co.logo, 'color', co.color, 'glyph', co.glyph,
                    'verified', coalesce(co.verified, false))
                  order by co.name)
             from public.post_collaborators pc
             join public.organizations co on co.id = pc.org_id
            where pc.post_id = p.id and pc.status = 'accepted'
              and coalesce(co.status, 'pending') = 'approved'
         ), '[]'::jsonb)
    from public.org_posts p
    join public.organizations o on o.id = p.org_id
   where not p.deleted
     and coalesce(o.status, 'pending') = 'approved'
     -- A PROFILE shows posts the org published AND posts it co-authored.
     -- One row either way, so a club that collaborates with itself's partner
     -- cannot produce two cards.
     and (
       p_org is null
       or p.org_id = p_org
       or exists (select 1 from public.post_collaborators pc
                   where pc.post_id = p.id and pc.org_id = p_org and pc.status = 'accepted')
     )
     -- Following either name is enough to see it.
     and (
       not p_following
       or exists (select 1 from public.org_follows f
                   where f.user_id = auth.uid()
                     and (f.org_id = o.id
                          or exists (select 1 from public.post_collaborators pc
                                      where pc.post_id = p.id and pc.org_id = f.org_id
                                        and pc.status = 'accepted')))
     )
   order by p.created_at desc
   limit greatest(1, least(coalesce(p_limit, 20), 50))
  offset greatest(0, coalesce(p_offset, 0));
$$;
grant execute on function public.post_feed(uuid, boolean, int, int) to anon, authenticated;

-- ── Checks ──────────────────────────────────────────────────────────────────
--   select public.invite_collaborator('<post>', '<same org as the post>');  -- 'self'
--   select count(*) from public.post_feed(null, false, 50, 0)
--    where jsonb_array_length(collaborators) > 0;
--   -- A post co-authored by A and B appears ONCE for somebody following both:
--   select id from public.post_feed(null, true, 50, 0);
