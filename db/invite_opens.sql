-- ── Track when an organizer invite link is OPENED ────────────────────────────
-- So the admin can see "someone clicked the JMMA link" before they finish signing
-- up (the accept step creates the pending org; this catches the step before it).
-- Records a count + the last time + — if they're signed in when they open it —
-- their email, so you know who's engaging.
--
-- RUN AFTER db/invites_and_activity.sql. Safe to re-run.

alter table public.org_invites
  add column if not exists opened_count       int not null default 0,
  add column if not exists last_opened_at     timestamptz,
  add column if not exists last_opened_email  text;

-- Token-scoped, callable signed-out (the invitee may open before signing in).
create or replace function public.record_org_invite_open(p_token text)
returns void language plpgsql security definer set search_path = public as $$
declare uemail text;
begin
  if auth.uid() is not null then
    select email into uemail from auth.users where id = auth.uid();
  end if;
  update public.org_invites
     set opened_count      = opened_count + 1,
         last_opened_at    = now(),
         last_opened_email = coalesce(uemail, last_opened_email)
   where token = p_token
     and use_count < max_uses;   -- stop counting once it's fully consumed
end $$;
grant execute on function public.record_org_invite_open(text) to anon, authenticated;
