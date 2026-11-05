-- Personal check-ins from the team (2026-11-05).
--
-- An admin writes to one student: it opens a support TICKET on their account
-- (so the conversation lives where every other one does, and they can answer
-- it) and queues a one-time full-screen POPUP the next time they open the app.
-- The email is sent by the API after this returns (api/ticket.ts, 'notify').
--
-- `outreach_popups`: select-own, no write policies. Writes go through the two
-- functions below: only an admin can create one, and the student can only
-- mark their own as seen.

create table if not exists public.outreach_popups (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  ticket_id   uuid references public.tickets(id) on delete set null,
  title       text not null check (char_length(title) between 1 and 120),
  body        text not null check (char_length(body) between 1 and 4000),
  min_seconds int  not null default 5 check (min_seconds between 0 and 30),
  created_by  uuid,
  created_at  timestamptz not null default now(),
  seen_at     timestamptz
);
create index if not exists outreach_popups_user_idx on public.outreach_popups (user_id) where seen_at is null;

alter table public.outreach_popups enable row level security;
drop policy if exists outreach_popups_select_own on public.outreach_popups;
create policy outreach_popups_select_own on public.outreach_popups
  for select using (user_id = auth.uid());

-- Open the ticket + queue the popup. Returns the ticket so the caller can send
-- the email. {name} in any text becomes the student's first name.
create or replace function public.admin_send_personal(
  p_user uuid,
  p_subject text,
  p_message text,
  p_popup_title text,
  p_popup_body text
) returns table (ticket_id uuid, case_id text)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_email text;
  v_name  text;
  v_first text;
  v_tid   uuid;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  select u.email into v_email from auth.users u where u.id = p_user;
  if v_email is null then raise exception 'No such account.'; end if;
  select p.name into v_name from public.user_profile p where p.user_id = p_user;
  v_first := coalesce(nullif(split_part(trim(coalesce(v_name, '')), ' ', 1), ''), 'there');

  insert into public.tickets (user_id, email, name, subject, category, source, context, status, handling)
  values (p_user, lower(v_email), v_name, left(replace(trim(p_subject), '{name}', v_first), 200), 'other', 'app',
          jsonb_build_object('kind', 'outreach'), 'answered', 'human')
  returning id into v_tid;

  insert into public.ticket_messages (ticket_id, author_id, author_role, author_name, body)
  values (v_tid, auth.uid(), 'staff', 'ConcordiaTracker', replace(trim(p_message), '{name}', v_first));

  insert into public.outreach_popups (user_id, ticket_id, title, body, created_by)
  values (p_user, v_tid, replace(trim(p_popup_title), '{name}', v_first),
          replace(trim(p_popup_body), '{name}', v_first), auth.uid());

  return query select t.id, t.case_id from public.tickets t where t.id = v_tid;
end $$;

create or replace function public.seen_outreach_popup(p_id uuid)
returns void
language sql
security definer
set search_path to 'public'
as $$
  update public.outreach_popups set seen_at = coalesce(seen_at, now())
   where id = p_id and user_id = auth.uid();
$$;

-- Admin view: what was sent, seen, and answered.
create or replace function public.admin_outreach_status()
returns table (id uuid, user_id uuid, name text, handle text, case_id text, created_at timestamptz,
               seen_at timestamptz, replied boolean)
language sql
security definer
set search_path to 'public'
as $$
  select o.id, o.user_id, p.name, p.handle, t.case_id, o.created_at, o.seen_at,
         exists (select 1 from public.ticket_messages m
                  where m.ticket_id = o.ticket_id and m.author_role = 'user')
    from public.outreach_popups o
    left join public.user_profile p on p.user_id = o.user_id
    left join public.tickets t on t.id = o.ticket_id
   where public.is_admin()
   order by o.created_at desc
$$;

revoke all on function public.admin_send_personal(uuid, text, text, text, text) from public, anon;
grant execute on function public.admin_send_personal(uuid, text, text, text, text) to authenticated;
revoke all on function public.seen_outreach_popup(uuid) from public, anon;
grant execute on function public.seen_outreach_popup(uuid) to authenticated;
revoke all on function public.admin_outreach_status() from public, anon;
grant execute on function public.admin_outreach_status() to authenticated;
