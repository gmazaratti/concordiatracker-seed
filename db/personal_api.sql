-- ============================================================================
-- Personal API — Alfred acting as Alex, and the screen that shows what he did.
-- RUN IN: Supabase → SQL Editor → paste → Run. Idempotent; safe to re-run.
-- REQUIRES: db/api_tokens.sql, db/support_api.sql, db/support_api_v2.sql.
-- ============================================================================

-- ── 1. The personal prefix ─────────────────────────────────────────────────
/**
 * `me` keys are minted as `ct_per_…` from now on.
 *
 * EXISTING `ct_pat_…` KEYS KEEP WORKING. The prefix is a label for a human
 * reading a list — verification looks up a SHA-256 hash and never inspects
 * the shape of the token — so renaming it cannot invalidate anything already
 * issued. Worth saying out loud, because "we changed the token format" is
 * normally a breaking change and here it is not.
 */
create or replace function public.ct_new_api_token(p_scope text)
returns text language sql volatile as $$
  select 'ct_' || case p_scope
                    when 'owner'   then 'owner'
                    when 'support' then 'sup'
                    else 'per'
                  end
         || '_' || replace(gen_random_uuid()::text, '-', '')
         || replace(gen_random_uuid()::text, '-', '');
$$;

-- ── 2. What the assistant sent ─────────────────────────────────────────────
/**
 * Every automated reply, newest first, with its exact wording.
 *
 * READS THE AUDIT LOG, not the messages table. The same text is in both, but
 * the audit row is the record OF THE ACT — it exists whether or not the
 * thread still does, and it cannot be edited from the product. A screen whose
 * job is "what did the machine say in my name" should read the thing that
 * cannot be quietly changed.
 *
 * `thread` is the composite id, so a row links straight back to the
 * conversation it belongs to.
 */
create or replace function public.admin_ai_replies(p_days int default 7, p_limit int default 100)
returns table (
  id          bigint,
  sent_at     timestamptz,
  thread      text,
  case_id     text,
  subject     text,
  customer    text,
  body        text,
  -- What the thread looks like NOW. A reply that was fine when it was sent
  -- and sits on a thread a person has since taken over is the interesting
  -- one, and it can only be seen by joining forward like this.
  status_now  text,
  needs_human boolean
)
language sql security definer set search_path = public stable as $$
  select a.id,
         a.created_at,
         a.new_value->>'thread',
         a.new_value->>'case_id',
         a.new_value->>'subject',
         coalesce(a.target_email, '—'),
         a.new_value->>'body',
         t.status_now,
         t.needs_human
    from public.admin_audit_log a
    left join lateral (
      select public.ct_support_status(k.status, k.handling) as status_now,
             k.needs_human or public.ct_thread_hold(k.id) is not null as needs_human
        from public.tickets k
       where 't:' || k.id = a.new_value->>'thread'
    ) t on true
   where public.is_admin()
     and a.action = 'support.ai_reply'
     and a.created_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 7), 365)))
   order by a.created_at desc
   limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;
grant execute on function public.admin_ai_replies(int, int) to authenticated;

/** The count, for a tab badge. Cheap enough to ask for on every load. */
create or replace function public.admin_ai_reply_count(p_days int default 1)
returns int language sql security definer set search_path = public stable as $$
  select case when public.is_admin() then (
    select count(*)::int from public.admin_audit_log
     where action = 'support.ai_reply'
       and created_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 1), 365)))
  ) else 0 end;
$$;
grant execute on function public.admin_ai_reply_count(int) to authenticated;

-- ── 3. Courses and assignments, written through the API ────────────────────
/**
 * Delete a course and everything hanging off it, for the token owner only.
 *
 * WHY A FUNCTION RATHER THAN A DELETE THROUGH PostgREST. `assignments` does
 * not cascade from `courses` in this schema, so a plain delete would leave
 * orphaned rows that still count toward a GPA belonging to a course that no
 * longer exists. One statement pair, one owner check, no orphans.
 *
 * `p_archive` is the default because a course with grades in it is a record,
 * and deleting a term's history to tidy a list is the kind of thing somebody
 * does once and regrets. The API exposes both.
 */
create or replace function public.api_delete_course(
  p_user uuid,
  p_course uuid,
  p_archive boolean default true
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_hit int;
begin
  if p_archive then
    update public.courses c set archived = true
     where c.id = p_course and c.user_id = p_user;
    get diagnostics v_hit = row_count;
    if v_hit = 0 then
      raise exception 'No course with that id on your account.'
        using errcode = 'P0002', detail = 'not_found';
    end if;
    return jsonb_build_object('archived', true, 'id', p_course);
  end if;

  delete from public.assignments a
   where a.course_id = p_course and a.user_id = p_user;
  delete from public.courses c
   where c.id = p_course and c.user_id = p_user;
  get diagnostics v_hit = row_count;
  if v_hit = 0 then
    raise exception 'No course with that id on your account.'
      using errcode = 'P0002', detail = 'not_found';
  end if;
  return jsonb_build_object('deleted', true, 'id', p_course);
end $$;
revoke all on function public.api_delete_course(uuid, uuid, boolean) from anon, authenticated;

/**
 * Append a note to an assignment.
 *
 * APPENDS, never replaces. `notes` is one text field and the endpoint is
 * called "add a note"; a PATCH that silently overwrote what was already
 * there would lose a student's own writing the first time an assistant used
 * it. Replacing outright is still possible through PATCH /assignments/{id}.
 */
create or replace function public.api_append_note(p_user uuid, p_assignment uuid, p_note text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_existing text; v_next text;
begin
  if char_length(coalesce(btrim(p_note), '')) < 1 then
    raise exception 'A note cannot be empty.' using errcode = '22023', detail = 'empty';
  end if;

  select a.notes into v_existing
    from public.assignments a
   where a.id = p_assignment and a.user_id = p_user;
  if not found then
    raise exception 'No assignment with that id on your account.'
      using errcode = 'P0002', detail = 'not_found';
  end if;

  v_next := case
    when coalesce(btrim(v_existing), '') = '' then btrim(p_note)
    else v_existing || E'\n\n' || btrim(p_note)
  end;

  update public.assignments a set notes = v_next
   where a.id = p_assignment and a.user_id = p_user;

  return jsonb_build_object('id', p_assignment, 'notes', v_next);
end $$;
revoke all on function public.api_append_note(uuid, uuid, text) from anon, authenticated;
