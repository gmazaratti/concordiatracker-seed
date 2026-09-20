-- ============================================================================
-- Support API — the data layer behind /api/v1/support, for an assistant.
-- RUN IN: Supabase → SQL Editor → paste → Run. Idempotent; safe to re-run.
-- REQUIRES: db/tickets.sql, db/admin_console.sql, db/api_tokens.sql.
--
-- NO NEW THREAD TABLES. A `ticket` is a `tickets` row and its messages; a
-- `diagnostic` is a `bug_reports` row. Both already exist, are already
-- written to by the app, and are already what the admin console reads — a
-- parallel set of tables would mean the assistant and the console eventually
-- disagreeing about the same conversation, which is the one failure that
-- would make this feature worse than nothing.
--
-- THE STATUS VOCABULARY IS DERIVED, NOT STORED TWICE. `tickets.status` stays
-- exactly as it is (open|answered|solved) because the app, the docs lookup
-- tool and the admin queue all read it. What is genuinely new is WHO OWNS the
-- thread, so that is the one column added:
--
--     handling = null → nobody has picked it up   → 'open'
--     handling = 'ai'                             → 'ai_handling'
--     handling = 'human'                          → 'human_takeover'
--     status   = 'solved'  (wins over all)        → 'resolved'
--
-- One fact per column, and the API presents the composite.
--
-- ALEX REPLYING TAKES THE THREAD AUTOMATICALLY. reply_ticket is extended so
-- that a staff reply sets handling='human'. Without that, a human could join
-- a conversation and the assistant would carry on drafting into it — the
-- exact situation `human_takeover` exists to prevent, left to be avoided by
-- remembering to press something.
-- ============================================================================

-- ── 1. The two new facts ────────────────────────────────────────────────────
alter table public.tickets
  add column if not exists handling    text,
  add column if not exists needs_human boolean not null default false;

alter table public.tickets drop constraint if exists ticket_handling_valid;
alter table public.tickets add constraint ticket_handling_valid
  check (handling is null or handling in ('ai', 'human'));

-- An assistant reply is a third kind of author. The customer-facing UI reads
-- this field to label it; the LABEL IS NEVER WRITTEN INTO THE MESSAGE TEXT,
-- because text is what gets quoted back, translated, and screenshotted.
alter table public.ticket_messages drop constraint if exists msg_role_valid;
alter table public.ticket_messages add constraint msg_role_valid
  check (author_role in ('user', 'staff', 'ai'));

-- ── 2. A third token scope ──────────────────────────────────────────────────
-- Separate from `owner` and `me` on purpose: this key reads and writes real
-- customer conversations, so it should be revocable on its own without taking
-- a statistics dashboard down with it.
alter table public.api_tokens drop constraint if exists api_tokens_scope_check;
alter table public.api_tokens drop constraint if exists api_tokens_scope_valid;
alter table public.api_tokens add constraint api_tokens_scope_valid
  check (scope in ('owner', 'me', 'support'));

create or replace function public.ct_new_api_token(p_scope text)
returns text language sql volatile as $$
  select 'ct_' || case p_scope when 'owner' then 'owner' when 'support' then 'sup' else 'pat' end
         || '_' || replace(gen_random_uuid()::text, '-', '')
         || replace(gen_random_uuid()::text, '-', '');
$$;

create or replace function public.create_api_token(p_name text, p_scope text default 'me')
returns table (id uuid, token text, prefix text)
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_token text;
  v_name  text := nullif(btrim(coalesce(p_name, '')), '');
  v_count int;
begin
  if v_uid is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;
  if p_scope not in ('owner', 'me', 'support') then
    raise exception 'Unknown scope %', p_scope using errcode = '22023';
  end if;
  -- Both privileged scopes are admin-only, checked HERE rather than in the
  -- screen that calls it, because a screen is a suggestion and a function is
  -- a rule.
  if p_scope in ('owner', 'support') and not public.is_admin() then
    raise exception 'Only an admin can create a % token.', p_scope using errcode = '42501';
  end if;
  if v_name is null then
    raise exception 'Give the token a name so you can recognise it later.' using errcode = '22023';
  end if;

  select count(*) into v_count
    from public.api_tokens t
   where t.user_id = v_uid and t.revoked_at is null;
  if v_count >= 20 then
    raise exception 'You already have 20 active tokens. Revoke one first.' using errcode = '53400';
  end if;

  v_token := public.ct_new_api_token(p_scope);

  insert into public.api_tokens (user_id, scope, name, token_hash, prefix)
  values (v_uid, p_scope, left(v_name, 60), public.ct_hash_api_token(v_token), left(v_token, 15))
  returning api_tokens.id into id;

  token  := v_token;
  prefix := left(v_token, 15);
  return next;
end;
$$;

-- ── 3. Alex replying takes the thread ──────────────────────────────────────
create or replace function public.reply_ticket(p_ticket_id uuid, p_body text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_admin  boolean := public.is_admin();
  v_owner  uuid;
  v_name   text;
begin
  if v_uid is null then raise exception 'Sign in to reply.'; end if;
  if char_length(coalesce(trim(p_body), '')) < 1 then raise exception 'Message is empty.'; end if;

  select t.user_id into v_owner from public.tickets t where t.id = p_ticket_id;
  if not found then raise exception 'That ticket does not exist.'; end if;
  if not v_admin and v_owner is distinct from v_uid then
    raise exception 'That is not your ticket.';
  end if;

  if v_admin then
    v_name := 'Support';
  else
    select coalesce(p.name, 'You') into v_name from public.user_profile p where p.user_id = v_uid;
  end if;

  insert into public.ticket_messages (ticket_id, author_id, author_role, author_name, body)
  values (p_ticket_id, v_uid, case when v_admin then 'staff' else 'user' end,
          coalesce(v_name, 'You'), trim(p_body));

  update public.tickets t
     set status = case when v_admin then 'answered' else 'open' end,
         last_activity_at = now(),
         user_seen_at = case when v_admin then t.user_seen_at else now() end,
         -- THE HAND-OFF. A staff reply claims the thread, so the assistant
         -- stops drafting into it without anyone having to remember to say so.
         -- A customer reply leaves ownership alone: writing back does not
         -- decide who should answer.
         handling = case when v_admin then 'human' else t.handling end
   where t.id = p_ticket_id;
end $$;
grant execute on function public.reply_ticket(uuid, text) to authenticated;

-- ── 4. Thread shape ─────────────────────────────────────────────────────────
-- Composite, stable ids. `t:` and `d:` are two different tables and a bare
-- uuid could not say which, so the prefix is part of the identifier rather
-- than something the caller has to carry alongside it.
create or replace function public.ct_support_status(p_status text, p_handling text)
returns text language sql immutable as $$
  select case
    when p_status in ('solved', 'resolved', 'wont-fix') then 'resolved'
    when p_handling = 'human' then 'human_takeover'
    when p_handling = 'ai'    then 'ai_handling'
    else 'open'
  end;
$$;

create or replace function public.ct_thread_parts(p_thread text)
returns table (kind text, ref uuid)
language plpgsql immutable as $$
declare v_kind text; v_id text;
begin
  v_kind := split_part(coalesce(p_thread, ''), ':', 1);
  v_id   := split_part(coalesce(p_thread, ''), ':', 2);
  if v_kind not in ('t', 'd') or v_id = '' then
    return;
  end if;
  begin
    ref := v_id::uuid;
  exception when others then
    return;                        -- a malformed id is "not found", not a 500
  end;
  kind := case v_kind when 't' then 'ticket' else 'diagnostic' end;
  return next;
end $$;

/**
 * The list. `since` matches a thread CREATED or UPDATED at/after the
 * timestamp, so an old conversation with a new customer message comes back —
 * a poller filtering on creation alone would never see the reply it exists to
 * answer.
 *
 * Diagnostics have no update timestamp (bug_reports records only when it
 * arrived), so for those `since` is creation, and the API says so.
 */
create or replace function public.support_threads(
  p_type   text default null,
  p_status text default null,
  p_since  timestamptz default null,
  p_limit  int default 50,
  p_offset int default 0
)
returns jsonb
language sql security definer set search_path = public stable as $$
  with rows as (
    select 't:' || t.id                                as id,
           'ticket'                                    as type,
           t.case_id                                   as reference,
           t.subject                                   as subject,
           public.ct_support_status(t.status, t.handling) as status,
           t.needs_human                               as needs_human,
           t.email                                     as customer_email,
           coalesce(t.name, '')                        as customer_name,
           t.category                                  as category,
           t.created_at                                as created_at,
           t.last_activity_at                          as updated_at,
           (select count(*)::int from public.ticket_messages m where m.ticket_id = t.id) as message_count
      from public.tickets t
    union all
    select 'd:' || b.id,
           'diagnostic',
           left(b.id::text, 8),
           b.title,
           public.ct_support_status(b.status, null),
           false,
           coalesce(b.user_email, ''),
           '',
           'diagnostic',
           b.created_at,
           b.created_at,
           1
      from public.bug_reports b
  )
  select jsonb_build_object(
    'threads', coalesce(jsonb_agg(to_jsonb(p) order by p.updated_at desc), '[]'::jsonb),
    'page',     greatest(1, (coalesce(p_offset, 0) / greatest(1, coalesce(p_limit, 50))) + 1),
    'per_page', greatest(1, least(coalesce(p_limit, 50), 200)),
    'total',    (select count(*) from rows r
                  where (p_type is null or r.type = p_type)
                    and (p_status is null or r.status = p_status)
                    and (p_since is null or r.created_at >= p_since or r.updated_at >= p_since))
  )
  from (
    select * from rows r
     where (p_type is null or r.type = p_type)
       and (p_status is null or r.status = p_status)
       and (p_since is null or r.created_at >= p_since or r.updated_at >= p_since)
     order by r.updated_at desc
     limit greatest(1, least(coalesce(p_limit, 50), 200))
     offset greatest(0, coalesce(p_offset, 0))
  ) p;
$$;

/** One thread, with its messages. A diagnostic has no conversation, so it
 *  returns a single `user` message carrying the notes and the payload —
 *  the same shape, so a client needs one code path rather than two. */
create or replace function public.support_thread(p_thread text)
returns jsonb
language plpgsql security definer set search_path = public stable as $$
declare v_kind text; v_ref uuid; v_out jsonb;
begin
  select kind, ref into v_kind, v_ref from public.ct_thread_parts(p_thread);
  if v_kind is null then return null; end if;

  if v_kind = 'ticket' then
    select jsonb_build_object(
      'id', 't:' || t.id,
      'type', 'ticket',
      'reference', t.case_id,
      'subject', t.subject,
      'status', public.ct_support_status(t.status, t.handling),
      'needs_human', t.needs_human,
      'can_reply', public.ct_support_status(t.status, t.handling) in ('open', 'ai_handling')
                   and not t.needs_human,
      'customer_email', t.email,
      'customer_name', coalesce(t.name, ''),
      'category', t.category,
      'source', t.source,
      'context', t.context,
      'created_at', t.created_at,
      'updated_at', t.last_activity_at,
      'messages', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', m.id,
                 -- 'staff' is what the table has called a human since before
                 -- there was an assistant; the API speaks the newer word.
                 'author', case m.author_role when 'staff' then 'human' else m.author_role end,
                 'author_name', m.author_name,
                 'text', m.body,
                 'created_at', m.created_at
               ) order by m.created_at)
          from public.ticket_messages m where m.ticket_id = t.id), '[]'::jsonb)
    ) into v_out
    from public.tickets t where t.id = v_ref;
  else
    select jsonb_build_object(
      'id', 'd:' || b.id,
      'type', 'diagnostic',
      'reference', left(b.id::text, 8),
      'subject', b.title,
      'status', public.ct_support_status(b.status, null),
      'needs_human', false,
      'can_reply', false,
      'customer_email', coalesce(b.user_email, ''),
      'customer_name', '',
      'category', 'diagnostic',
      'source', 'app',
      'context', jsonb_build_object('page', b.page),
      'created_at', b.created_at,
      'updated_at', b.created_at,
      'messages', jsonb_build_array(jsonb_build_object(
        'id', b.id,
        'author', 'user',
        'author_name', coalesce(b.user_email, 'Automated report'),
        'text', coalesce(nullif(b.description, ''), b.title)
                || case when b.page is null then '' else E'\n\n' || jsonb_build_object('page', b.page)::text end,
        'created_at', b.created_at
      ))
    ) into v_out
    from public.bug_reports b where b.id = v_ref;
  end if;

  return v_out;
end $$;

-- ── 5. Reply, with the permission rule IN THE DATABASE ─────────────────────
/**
 * THE GUARD IS HERE AND NOT IN THE API LAYER, on purpose. An HTTP handler can
 * be bypassed by the next caller, a retry, a script someone writes in a hurry
 * — and the thing being protected is a real customer being answered twice, or
 * answered by a machine after they asked for a person. So the rule lives where
 * nothing can route around it.
 *
 * The refusal reason comes back in DETAIL as a stable token, because the API
 * has to turn it into a 409 the caller can branch on. A sentence alone would
 * force string matching.
 */
create or replace function public.support_reply(p_thread text, p_text text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_kind text; v_ref uuid;
  v_status text; v_handling text; v_needs boolean;
  v_msg uuid;
begin
  if char_length(coalesce(btrim(p_text), '')) < 1 then
    raise exception 'A reply cannot be empty.' using errcode = '22023', detail = 'empty';
  end if;

  select kind, ref into v_kind, v_ref from public.ct_thread_parts(p_thread);
  if v_kind is null then
    raise exception 'No thread with that id.' using errcode = 'P0002', detail = 'not_found';
  end if;

  if v_kind = 'diagnostic' then
    raise exception 'A diagnostic is a report, not a conversation. It cannot be replied to.'
      using errcode = 'P0001', detail = 'diagnostic_not_repliable';
  end if;

  select t.status, t.handling, t.needs_human
    into v_status, v_handling, v_needs
    from public.tickets t where t.id = v_ref
     for update;
  if not found then
    raise exception 'No thread with that id.' using errcode = 'P0002', detail = 'not_found';
  end if;

  -- Order matters: resolved is the most final, then a human owning it, then
  -- the customer having asked for one.
  if v_status = 'solved' then
    raise exception 'That thread is resolved.' using errcode = 'P0001', detail = 'resolved';
  end if;
  if v_handling = 'human' then
    raise exception 'A person has taken that thread over.'
      using errcode = 'P0001', detail = 'human_takeover';
  end if;
  if v_needs then
    raise exception 'The customer asked for a person.'
      using errcode = 'P0001', detail = 'needs_human';
  end if;

  insert into public.ticket_messages (ticket_id, author_role, author_name, body)
  values (v_ref, 'ai', 'Support', btrim(p_text))
  returning id into v_msg;

  -- Replying claims the thread. 'answered' is what the customer-facing UI
  -- reads, and a reply they can see IS an answer whoever wrote it.
  update public.tickets t
     set handling = 'ai',
         status = 'answered',
         last_activity_at = now()
   where t.id = v_ref;

  return jsonb_build_object('message_id', v_msg, 'thread', public.support_thread(p_thread));
end $$;

/**
 * Change the state of a thread. Either field, or both.
 *
 * Setting 'ai_handling' CLEARS needs_human — that is the hand-back gesture,
 * and making it a separate second call would leave a window where the thread
 * is owned by the assistant and still flagged for a person.
 */
create or replace function public.support_patch(
  p_thread text,
  p_status text default null,
  p_needs_human boolean default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_kind text; v_ref uuid;
begin
  select kind, ref into v_kind, v_ref from public.ct_thread_parts(p_thread);
  if v_kind is null then
    raise exception 'No thread with that id.' using errcode = 'P0002', detail = 'not_found';
  end if;

  if p_status is not null and p_status not in ('open', 'ai_handling', 'human_takeover', 'resolved') then
    raise exception 'Unknown status %', p_status using errcode = '22023', detail = 'bad_status';
  end if;

  if v_kind = 'diagnostic' then
    -- A report has no conversation, so "who is handling it" is a question
    -- with no answer. Open and resolved are the only two states it has.
    if p_needs_human is not null or (p_status is not null and p_status not in ('open', 'resolved')) then
      raise exception 'A diagnostic can only be open or resolved.'
        using errcode = 'P0001', detail = 'diagnostic_has_no_handling';
    end if;
    update public.bug_reports b
       set status = case when p_status = 'resolved' then 'resolved' else 'open' end
     where b.id = v_ref;
    return public.support_thread(p_thread);
  end if;

  update public.tickets t
     set status = case
                    when p_status = 'resolved' then 'solved'
                    when p_status is null then t.status
                    when t.status = 'solved' then 'open'   -- reopening
                    else t.status
                  end,
         handling = case p_status
                      when 'ai_handling'    then 'ai'
                      when 'human_takeover' then 'human'
                      when 'open'           then null
                      when 'resolved'       then t.handling
                      else t.handling
                    end,
         needs_human = case
                         when p_status = 'ai_handling' then false
                         when p_needs_human is not null then p_needs_human
                         else t.needs_human
                       end,
         last_activity_at = now()
   where t.id = v_ref;

  return public.support_thread(p_thread);
end $$;

-- Every one of these is reached only through /api/v1/support, which verifies
-- a support-scoped token and calls them as the service role. Nothing in a
-- browser has any business reading another customer's conversation.
revoke all on function public.support_threads(text, text, timestamptz, int, int) from anon, authenticated;
revoke all on function public.support_thread(text) from anon, authenticated;
revoke all on function public.support_reply(text, text) from anon, authenticated;
revoke all on function public.support_patch(text, text, boolean) from anon, authenticated;

create index if not exists tickets_activity_idx on public.tickets (last_activity_at desc);
create index if not exists bug_reports_created_idx on public.bug_reports (created_at desc);
