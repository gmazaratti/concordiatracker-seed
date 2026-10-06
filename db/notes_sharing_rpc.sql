-- ============================================================================
-- Notes sharing: the verbs. Run AFTER db/notes_sharing.sql.
--
-- p_kind is 'note' or 'folder'. Only the OWNER of a note or folder can share
-- it, change a role or turn its link on; a person can always remove themselves.
-- Safe to re-run.
-- ============================================================================

create or replace function public.ct_share_target_owner(p_kind text, p_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select case p_kind
    when 'note' then (select user_id from public.notes where id = p_id and deleted_at is null)
    when 'folder' then (select user_id from public.note_folders where id = p_id)
  end
$$;

create or replace function public.ct_share_target_name(p_kind text, p_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select case p_kind
    when 'note' then (select coalesce(nullif(title, ''), 'Untitled note') from public.notes where id = p_id)
    when 'folder' then (select f.name from public.note_folders f where f.id = p_id)
  end
$$;

-- Share with a person on the site, by @handle. Sharing again changes the role.
create or replace function public.share_note_with(p_kind text, p_id uuid, p_handle text, p_role text)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); target uuid; sid uuid; who text;
begin
  if p_kind not in ('note', 'folder') or p_role not in ('viewer', 'editor') then
    raise exception 'Unknown share.' using errcode = '22023';
  end if;
  if public.ct_share_target_owner(p_kind, p_id) is distinct from me then
    raise exception 'Only the owner can share this.' using errcode = '42501';
  end if;
  select user_id into target from public.user_profile
   where lower(handle) = lower(ltrim(btrim(p_handle), '@')) limit 1;
  if target is null then raise exception 'No one has that handle.' using errcode = 'P0002'; end if;
  if target = me then raise exception 'That is you.' using errcode = '22023'; end if;
  if exists (select 1 from public.profile_blocks b
              where (b.blocker_id = me and b.blocked_id = target) or (b.blocker_id = target and b.blocked_id = me)) then
    raise exception 'You cannot share with this person.' using errcode = '42501';
  end if;

  if p_kind = 'note' then
    insert into public.note_shares (owner_id, note_id, user_id, role) values (me, p_id, target, p_role)
    on conflict (note_id, user_id) where note_id is not null and user_id is not null
    do update set role = excluded.role returning id into sid;
  else
    insert into public.note_shares (owner_id, folder_id, user_id, role) values (me, p_id, target, p_role)
    on conflict (folder_id, user_id) where folder_id is not null and user_id is not null
    do update set role = excluded.role returning id into sid;
  end if;

  select coalesce(nullif(name, ''), '@' || handle) into who from public.user_profile where user_id = me;
  begin
    perform public.ct_notify(array[target], 'note_share',
      coalesce(who, 'Someone') || ' shared "' || public.ct_share_target_name(p_kind, p_id) || '" with you',
      case p_role when 'editor' then 'You can edit it.' else 'You can view it.' end,
      case p_kind when 'note' then '/app/notes/n/' || p_id else '/app/notes/f/' || p_id end,
      p_id, who);
  exception when others then null; -- a failed notification must not undo the share
  end;
  return sid;
end $$;

create or replace function public.share_note_set_role(p_share uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_role not in ('viewer', 'editor') then raise exception 'Unknown role.' using errcode = '22023'; end if;
  update public.note_shares set role = p_role where id = p_share and owner_id = auth.uid();
  if not found then raise exception 'Only the owner can change this.' using errcode = '42501'; end if;
end $$;

create or replace function public.share_note_remove(p_share uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.note_shares where id = p_share and (owner_id = auth.uid() or user_id = auth.uid());
end $$;

-- Turn the link on with a role, or off (p_role null). Returns the token.
create or replace function public.share_note_link(p_kind text, p_id uuid, p_role text)
returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); tok text;
begin
  if p_kind not in ('note', 'folder') then raise exception 'Unknown share.' using errcode = '22023'; end if;
  if public.ct_share_target_owner(p_kind, p_id) is distinct from me then
    raise exception 'Only the owner can share this.' using errcode = '42501';
  end if;
  if p_role is null then
    delete from public.note_shares where owner_id = me and link_token is not null
       and ((p_kind = 'note' and note_id = p_id) or (p_kind = 'folder' and folder_id = p_id));
    return null;
  end if;
  if p_role not in ('viewer', 'editor') then raise exception 'Unknown role.' using errcode = '22023'; end if;
  select link_token into tok from public.note_shares where owner_id = me and link_token is not null
     and ((p_kind = 'note' and note_id = p_id) or (p_kind = 'folder' and folder_id = p_id));
  if tok is null then
    -- 40 hex characters from two random uuids: not guessable.
    tok := replace(gen_random_uuid()::text, '-', '') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
    insert into public.note_shares (owner_id, note_id, folder_id, link_token, role)
    values (me, case when p_kind = 'note' then p_id end, case when p_kind = 'folder' then p_id end, tok, p_role);
  else
    update public.note_shares set role = p_role where link_token = tok;
  end if;
  return tok;
end $$;

-- Opening a link: the person joins with the link's role, never lowering a role
-- they already had. Returns where to go.
create or replace function public.claim_note_link(p_token text)
returns table (kind text, target uuid, role text) language plpgsql security definer set search_path = public as $$
declare s public.note_shares; me uuid := auth.uid(); existing text;
begin
  if me is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  select * into s from public.note_shares where link_token = p_token;
  if s.id is null then raise exception 'This link was turned off.' using errcode = 'P0002'; end if;
  if s.owner_id <> me then
    if s.note_id is not null then
      select ns.role into existing from public.note_shares ns where ns.note_id = s.note_id and ns.user_id = me;
      if existing is null then
        insert into public.note_shares (owner_id, note_id, user_id, role, via_link) values (s.owner_id, s.note_id, me, s.role, true);
      elsif existing = 'viewer' and s.role = 'editor' then
        update public.note_shares ns set role = 'editor' where ns.note_id = s.note_id and ns.user_id = me;
      end if;
    else
      select ns.role into existing from public.note_shares ns where ns.folder_id = s.folder_id and ns.user_id = me;
      if existing is null then
        insert into public.note_shares (owner_id, folder_id, user_id, role, via_link) values (s.owner_id, s.folder_id, me, s.role, true);
      elsif existing = 'viewer' and s.role = 'editor' then
        update public.note_shares ns set role = 'editor' where ns.folder_id = s.folder_id and ns.user_id = me;
      end if;
    end if;
  end if;
  return query select (case when s.note_id is not null then 'note' else 'folder' end)::text,
                      coalesce(s.note_id, s.folder_id), s.role;
end $$;

-- Everyone on one note or folder, for its owner's share dialog.
create or replace function public.note_share_list(p_kind text, p_id uuid)
returns table (share_id uuid, user_id uuid, handle text, name text, avatar_url text, role text, via_link boolean, link_token text)
language sql stable security definer set search_path = public as $$
  select s.id, s.user_id, p.handle, p.name, p.avatar_url, s.role, s.via_link, s.link_token
    from public.note_shares s left join public.user_profile p on p.user_id = s.user_id
   where public.ct_share_target_owner(p_kind, p_id) = auth.uid()
     and ((p_kind = 'note' and s.note_id = p_id) or (p_kind = 'folder' and s.folder_id = p_id))
   order by s.link_token is not null desc, s.created_at
$$;

-- The people a note reaches: its owner, its own shares, the shares of every
-- folder above it, and when each last viewed and edited it.
create or replace function public.note_people(p_note uuid)
returns table (user_id uuid, handle text, name text, avatar_url text, role text, last_viewed_at timestamptz, last_edited_at timestamptz)
language sql stable security definer set search_path = public as $$
  with n as (select * from public.notes x where x.id = p_note and public.ct_note_role(p_note) is not null),
  people as (
    select n.user_id as uid, 'owner'::text as r from n
    union
    select s.user_id, s.role from public.note_shares s, n
     where s.user_id is not null
       and (s.note_id = n.id or (n.folder_id is not null and s.folder_id in (select public.ct_folder_chain(n.folder_id))))
  ),
  best as (
    select uid, case when bool_or(r = 'owner') then 'owner' when bool_or(r = 'editor') then 'editor' else 'viewer' end as r
      from people group by uid
  )
  select b.uid, p.handle, p.name, p.avatar_url, b.r, a.last_viewed_at, a.last_edited_at
    from best b
    left join public.user_profile p on p.user_id = b.uid
    left join public.note_activity a on a.note_id = p_note and a.user_id = b.uid
   order by (b.r = 'owner') desc, a.last_viewed_at desc nulls last
$$;

-- What other people have shared with me.
create or replace function public.notes_shared_with_me()
returns table (kind text, id uuid, name text, role text, owner_name text, owner_handle text, owner_avatar text, shared_at timestamptz)
language sql stable security definer set search_path = public as $$
  select (case when s.note_id is not null then 'note' else 'folder' end)::text,
         coalesce(s.note_id, s.folder_id),
         public.ct_share_target_name(case when s.note_id is not null then 'note' else 'folder' end, coalesce(s.note_id, s.folder_id)),
         s.role, p.name, p.handle, p.avatar_url, s.created_at
    from public.note_shares s
    left join public.user_profile p on p.user_id = s.owner_id
   where s.user_id = auth.uid()
     and (s.note_id is null or exists (select 1 from public.notes x where x.id = s.note_id and x.deleted_at is null))
   order by s.created_at desc
$$;

revoke execute on function public.ct_share_target_owner(text, uuid) from public, anon;
revoke execute on function public.ct_share_target_name(text, uuid) from public, anon;
grant execute on function public.share_note_with(text, uuid, text, text) to authenticated;
grant execute on function public.share_note_set_role(uuid, text) to authenticated;
grant execute on function public.share_note_remove(uuid) to authenticated;
grant execute on function public.share_note_link(text, uuid, text) to authenticated;
grant execute on function public.claim_note_link(text) to authenticated;
grant execute on function public.note_share_list(text, uuid) to authenticated;
grant execute on function public.note_people(uuid) to authenticated;
grant execute on function public.notes_shared_with_me() to authenticated;
