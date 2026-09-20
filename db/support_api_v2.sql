-- ============================================================================
-- Support API, second pass — the holds that must be unbreakable.
-- RUN IN: Supabase → SQL Editor → paste → Run. Idempotent; safe to re-run.
-- REQUIRES: db/support_api.sql.
--
-- The first pass put the reply rule in the database because an HTTP handler
-- can be routed around. This pass adds the three that matter most, for the
-- same reason and with more at stake:
--
--   1. CRISIS. A thread mentioning self-harm is never answered by a machine.
--   2. MONEY. Refunds, discounts and "when will it be fixed" are promises,
--      and a promise is Alex's to make.
--   3. RESOLVED IS ALEX'S WORD. A support token can escalate and hand back;
--      it cannot close a conversation.
--
-- WHY IN SQL AND NOT IN THE PROMPT. A prompt is an instruction to a system
-- that is allowed to be wrong; this is a rule. If the model is confused, the
-- API is retried by a script, or a future endpoint forgets to check — the
-- insert still fails. The prompt keeps its version of these rules as well,
-- because two independent guards are the point, not duplication.
-- ============================================================================

-- ── 1. Crisis and money detection ──────────────────────────────────────────
/**
 * Does this thread need a person, whatever a model thinks?
 *
 * DELIBERATELY BLUNT, AND DELIBERATELY BIASED TOWARD FLAGGING. A false
 * positive costs Alex a minute reading a thread he would have read anyway. A
 * false negative is an automated reply to somebody describing self-harm.
 * Those are not comparable, so the list is broad and the ordering of that
 * trade is written here so nobody later "tidies" it into something tighter.
 *
 * It reads the CUSTOMER's words only. Our own replies quoting a helpline must
 * not re-trigger the hold and lock the thread against the very person who is
 * handling it.
 *
 * It is not clever and is not meant to be: it is a floor under the model's
 * judgement, not a replacement for it. Alfred's instructions carry the same
 * rule, and either one catching it is enough.
 */
create or replace function public.ct_crisis_terms(p_text text)
returns boolean language sql immutable as $$
  select p_text ~* (
    'suicide|suicidal|kill myself|killing myself|end my life|ending my life'
    || '|take my own life|want to die|wanna die|better off dead|not worth living'
    || '|no reason to live|self.?harm'
    -- The -ing forms are not optional extras. "I have been hurting myself"
    -- is how somebody actually writes this, and an earlier version of this
    -- list matched only "hurt myself" and let that sentence through.
    || '|(harm|harming|hurt|hurting|cut|cutting) myself'
    || '|overdose|od.ing|kms|unalive'
  );
$$;

create or replace function public.ct_money_terms(p_text text)
returns boolean language sql immutable as $$
  select p_text ~* (
    'refund|money back|charge.?back|chargeback|reimburse|compensat'
    || '|discount|coupon|promo code|free month|credit my account'
    || '|when will .{0,30}(be )?(fixed|ready|done|released|available)'
    || '|eta\M|by when|how long until|release date'
  );
$$;

/**
 * The customer's side of a thread, as one blob to test.
 *
 * Only `author_role = 'user'`, and only a ticket — a diagnostic cannot be
 * replied to at all, so there is nothing to hold back.
 */
create or replace function public.ct_customer_text(p_ticket uuid)
returns text language sql security definer set search_path = public stable as $$
  select coalesce(string_agg(m.body, ' '), '') || ' ' || coalesce((
    select t.subject from public.tickets t where t.id = p_ticket
  ), '')
    from public.ticket_messages m
   where m.ticket_id = p_ticket and m.author_role = 'user';
$$;

-- ── 2. Reply, with every hold ──────────────────────────────────────────────
/**
 * Replaces the first pass. Same refusals, plus crisis and money.
 *
 * The holds are checked here and REPORTED by support_thread — see the note
 * further down about why they are derived on read rather than written here.
 * A held thread reads back as needs_human, so it reaches Alex whether or not
 * the assistant does anything about the refusal.
 */
create or replace function public.support_reply(p_thread text, p_text text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_kind text; v_ref uuid;
  v_status text; v_handling text; v_needs boolean;
  v_msg uuid; v_customer text;
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

  -- The safety holds come FIRST, before the ownership ones. A thread can be
  -- open and unflagged and still be the last thread a machine should answer.
  v_customer := public.ct_customer_text(v_ref);

  -- NOTE, and it cost a test to learn: these used to set needs_human here
  -- before raising. A RAISE ROLLS THE WHOLE FUNCTION BACK, including that
  -- update, so the flag never survived and a crisis thread looked ordinary in
  -- the queue afterwards. The hold is DERIVED instead — support_thread and
  -- support_threads compute it from the customer's words every time they are
  -- read, so it is always true, needs no write, and cannot be rolled back or
  -- forgotten.
  if public.ct_crisis_terms(v_customer) then
    raise exception
      'This thread mentions self-harm. It is held for a person and cannot be answered automatically.'
      using errcode = 'P0001', detail = 'crisis_hold';
  end if;

  if public.ct_money_terms(v_customer) then
    raise exception
      'This thread asks about money or a delivery date. Those are promises, and a person makes them.'
      using errcode = 'P0001', detail = 'money_hold';
  end if;

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

  update public.tickets t
     set handling = 'ai',
         status = 'answered',
         last_activity_at = now()
   where t.id = v_ref;

  -- EVERY AUTOMATED REPLY IS ON THE RECORD, with its exact wording. Alex has
  -- to be able to read back what was said in his product's name without
  -- opening each thread, and "the assistant replied" with no text is not that.
  insert into public.admin_audit_log
    (actor_id, actor_email, action, target_id, target_email, new_value, reason)
  select null,
         'assistant@support',
         'support.ai_reply',
         t.user_id,
         t.email,
         jsonb_build_object(
           'thread', p_thread,
           'case_id', t.case_id,
           'subject', t.subject,
           'message_id', v_msg,
           'body', btrim(p_text),
           'sent_at', now()
         ),
         'Automated support reply'
    from public.tickets t where t.id = v_ref;

  return jsonb_build_object('message_id', v_msg, 'thread', public.support_thread(p_thread));
end $$;

-- ── 3. Alfred can escalate; he cannot close ────────────────────────────────
/**
 * `p_actor` says who is asking. 'support' is Alfred, and the only status he
 * is refused is `resolved` — deciding a customer's problem is over is a
 * judgement with a person's name on it, and the admin UI is where that name
 * is. Escalating (needs_human = true) is always allowed, because the cost of
 * a wrong escalation is a minute of Alex's time.
 */
create or replace function public.support_patch(
  p_thread text,
  p_status text default null,
  p_needs_human boolean default null,
  p_actor text default 'admin'
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

  if p_actor = 'support' and p_status = 'resolved' then
    raise exception 'Closing a thread is the admin UI''s to do, not the assistant''s.'
      using errcode = 'P0001', detail = 'resolve_is_human_only';
  end if;

  if v_kind = 'diagnostic' then
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
                    when t.status = 'solved' then 'open'
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


-- ── 5. The hold, DERIVED wherever a thread is read ─────────────────────────
/**
 * `hold` is computed from the customer's words on every read, so a crisis
 * thread reports itself as needing a person whether or not anybody wrote a
 * flag — and `needs_human` is the stored flag OR a hold. A poller filtering
 * `needs_human=true` therefore sees crisis threads without the reply endpoint
 * having to write anything, which it cannot do anyway (a raise rolls it back).
 */
create or replace function public.ct_thread_hold(p_ticket uuid)
returns text language sql security definer set search_path = public stable as $$
  select case
    when public.ct_crisis_terms(public.ct_customer_text(p_ticket)) then 'crisis'
    when public.ct_money_terms(public.ct_customer_text(p_ticket))  then 'money'
    else null
  end;
$$;
revoke all on function public.ct_thread_hold(uuid) from anon, authenticated;

create or replace function public.support_thread(p_thread text)
returns jsonb
language plpgsql security definer set search_path = public stable as $$
declare v_kind text; v_ref uuid; v_out jsonb; v_hold text; v_needs boolean; v_state text;
begin
  select kind, ref into v_kind, v_ref from public.ct_thread_parts(p_thread);
  if v_kind is null then return null; end if;

  if v_kind = 'ticket' then
    v_hold := public.ct_thread_hold(v_ref);
    select public.ct_support_status(t.status, t.handling), t.needs_human or v_hold is not null
      into v_state, v_needs
      from public.tickets t where t.id = v_ref;
    if v_state is null then return null; end if;

    select jsonb_build_object(
      'id', 't:' || t.id,
      'type', 'ticket',
      'reference', t.case_id,
      'subject', t.subject,
      'status', v_state,
      'needs_human', v_needs,
      -- WHY it is held, in a word, so the assistant can follow the right
      -- protocol rather than only knowing it was refused.
      'hold', v_hold,
      'can_reply', v_state in ('open', 'ai_handling') and not v_needs,
      'customer_email', t.email,
      'customer_name', coalesce(t.name, ''),
      'category', t.category,
      'source', t.source,
      'context', t.context,
      -- The product has no attachment upload: a customer cannot send a file
      -- with a ticket. This is always empty, and it is here so the contract
      -- does not change on the day uploads ship. Never wait for one.
      'attachments', '[]'::jsonb,
      'created_at', t.created_at,
      'updated_at', t.last_activity_at,
      'messages', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', m.id,
                 'author', case m.author_role when 'staff' then 'human' else m.author_role end,
                 'author_name', m.author_name,
                 'text', m.body,
                 'body', m.body,
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
      'hold', 'diagnostic',
      'can_reply', false,
      'customer_email', coalesce(b.user_email, ''),
      'customer_name', '',
      'category', 'diagnostic',
      'source', 'app',
      'context', jsonb_build_object('page', b.page),
      'attachments', '[]'::jsonb,
      'created_at', b.created_at,
      'updated_at', b.created_at,
      'messages', jsonb_build_array(jsonb_build_object(
        'id', b.id,
        'author', 'user',
        'author_name', coalesce(b.user_email, 'Automated report'),
        'text', coalesce(nullif(b.description, ''), b.title)
                || case when b.page is null then '' else E'\n\n' || jsonb_build_object('page', b.page)::text end,
        'body', coalesce(nullif(b.description, ''), b.title),
        'created_at', b.created_at
      ))
    ) into v_out
    from public.bug_reports b where b.id = v_ref;
  end if;

  return v_out;
end $$;
revoke all on function public.support_thread(text) from anon, authenticated;

-- The listing derives the same way, so a filter on needs_human agrees with
-- what the thread itself reports.
create or replace function public.support_threads(
  p_type        text default null,
  p_status      text default null,
  p_since       timestamptz default null,
  p_limit       int default 50,
  p_offset      int default 0,
  p_needs_human boolean default null,
  p_cursor      text default null
)
returns jsonb
language sql security definer set search_path = public stable as $$
  with rows as (
    select 't:' || t.id                                   as id,
           'ticket'                                       as type,
           t.case_id                                      as reference,
           t.subject                                      as subject,
           public.ct_support_status(t.status, t.handling) as status,
           t.needs_human or public.ct_thread_hold(t.id) is not null as needs_human,
           public.ct_thread_hold(t.id)                    as hold,
           t.email                                        as customer_email,
           coalesce(t.name, '')                           as customer_name,
           t.category                                     as category,
           t.created_at                                   as created_at,
           t.last_activity_at                             as updated_at,
           t.id                                           as sort_id,
           (select count(*)::int from public.ticket_messages m where m.ticket_id = t.id) as message_count
      from public.tickets t
    union all
    select 'd:' || b.id, 'diagnostic', left(b.id::text, 8), b.title,
           public.ct_support_status(b.status, null), false, 'diagnostic',
           coalesce(b.user_email, ''), '', 'diagnostic',
           b.created_at, b.created_at, b.id, 1
      from public.bug_reports b
  ),
  cur as (
    select nullif(split_part(convert_from(decode(coalesce(p_cursor, ''), 'base64'), 'utf8'), '|', 1), '')::timestamptz as at,
           nullif(split_part(convert_from(decode(coalesce(p_cursor, ''), 'base64'), 'utf8'), '|', 2), '')::uuid        as id
  ),
  filtered as (
    select r.* from rows r, cur
     where (p_type is null or r.type = p_type)
       and (p_status is null or r.status = p_status)
       and (p_needs_human is null or r.needs_human = p_needs_human)
       and (p_since is null or r.created_at >= p_since or r.updated_at >= p_since)
       and (cur.at is null or (r.updated_at, r.sort_id) < (cur.at, cur.id))
  ),
  page as (
    select * from filtered
     order by updated_at desc, sort_id desc
     limit greatest(1, least(coalesce(p_limit, 50), 200))
  )
  select jsonb_build_object(
    'threads', coalesce((
      select jsonb_agg(to_jsonb(p) - 'sort_id' order by p.updated_at desc, p.sort_id desc) from page p
    ), '[]'::jsonb),
    'total', (select count(*) from filtered),
    'limit', greatest(1, least(coalesce(p_limit, 50), 200)),
    'next_cursor', (
      select case
        when count(*) < greatest(1, least(coalesce(p_limit, 50), 200)) then null
        else encode(convert_to(
          (select updated_at::text from page order by updated_at asc, sort_id asc limit 1)
          || '|' ||
          (select sort_id::text from page order by updated_at asc, sort_id asc limit 1),
          'utf8'), 'base64')
      end
      from page
    )
  );
$$;
revoke all on function public.support_threads(text, text, timestamptz, int, int, boolean, text) from anon, authenticated;

-- The old signatures are gone; the API calls the new ones.
drop function if exists public.support_threads(text, text, timestamptz, int, int);
drop function if exists public.support_patch(text, text, boolean);
