-- ============================================================================
-- Admin wiring RPCs — organizer-team accept + access-request submit/check.
-- RUN IN: concordiatracker-dev → SQL Editor → paste → Run.  (NOT production.)
--
-- These three operations each cross an RLS boundary that direct table access
-- can't: an invited member isn't the org owner (so can't UPDATE org_members),
-- and a logged-out requester can't read their own access_request back. Each is
-- SECURITY DEFINER + narrowly scoped (acts on the caller via auth.uid() or on a
-- single opaque token / case id).
-- ============================================================================

-- Org member: the invitee activates their own membership.
create or replace function public.accept_org_member_invite(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare m_id uuid; m_org uuid;
begin
  if auth.uid() is null then raise exception 'You must be signed in to accept an invite.'; end if;
  select id, org_id into m_id, m_org
    from public.org_members where invite_token = p_token and status = 'invited';
  if m_id is null then return null; end if;        -- not found / already used
  update public.org_members
    set status = 'active', user_id = auth.uid(), joined_at = now(), invite_token = null
    where id = m_id;
  return m_org;
end; $$;

-- Access request: submit (returns the auto case id; stamps the submitter if signed in).
create or replace function public.submit_access_request(p_role text, p_name text, p_email text, p_message text)
returns text language plpgsql security definer set search_path = public as $$
declare new_case text;
begin
  if length(coalesce(trim(p_name), '')) < 2 or length(coalesce(trim(p_email), '')) < 3 then
    raise exception 'Name and email are required.';
  end if;
  if p_role not in ('teacher', 'organizer') then raise exception 'Invalid role.'; end if;
  insert into public.access_requests (user_id, role, name, email, message)
    values (auth.uid(), p_role, trim(p_name), trim(p_email), left(coalesce(p_message, ''), 1000))
    returning case_id into new_case;
  return new_case;
end; $$;

-- Access request: public status check by opaque case id (no PII beyond name).
create or replace function public.get_access_request(p_case_id text)
returns table (case_id text, role text, name text, status text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  return query select ar.case_id, ar.role, ar.name, ar.status, ar.created_at
    from public.access_requests ar where ar.case_id = p_case_id;
end; $$;

grant execute on function public.accept_org_member_invite(text) to authenticated;
grant execute on function public.submit_access_request(text, text, text, text) to authenticated, anon;
grant execute on function public.get_access_request(text) to authenticated, anon;
