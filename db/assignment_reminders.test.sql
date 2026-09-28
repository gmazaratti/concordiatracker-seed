-- Rolled-back check of claim_assignment_reminders: run with
--   npx supabase db query --linked -f db/assignment_reminders.test.sql
-- It always ends in an exception whose message carries the results, so
-- nothing it inserts survives.
do $$
declare
  u uuid;
  a1 uuid := gen_random_uuid();
  a2 uuid := gen_random_uuid();
  first_run int;
  second_run int;
  got text;
  formal_tone text;
begin
  select user_id into u from public.user_profile limit 1;
  update public.user_profile set ui_state = coalesce(ui_state, '{}') - 'assignmentReminders' where user_id = u;

  -- due in 55 min: the default 60-minute reminder is due now; 1440 is long past
  -- (outside the window); the custom 30 is not yet.
  insert into public.assignments (id, user_id, title, date, type, weight, done, deleted, status, reminders)
  values (a1, u, 'Probe A', now() + interval '55 minutes', 'assignment', 10, false, false, 'not-started', array[30]);
  -- due in 25 min with a custom 30: due now. A done one is never sent.
  insert into public.assignments (id, user_id, title, date, type, weight, done, deleted, status, reminders)
  values (a2, u, 'Probe B', now() + interval '25 minutes', 'assignment', 10, false, false, 'not-started', array[30]);
  insert into public.assignments (user_id, title, date, type, weight, done, deleted, status)
  values (u, 'Probe done', now() + interval '55 minutes', 'assignment', 10, true, false, 'done');

  select count(*), string_agg(title || '@' || offset_minutes || '/' || tone, ',' order by title)
    into first_run, got
    from public.claim_assignment_reminders() c where c.user_id = u and c.title like 'Probe%';
  select count(*) into second_run
    from public.claim_assignment_reminders() c where c.user_id = u and c.title like 'Probe%';

  -- Formal voice and switched off.
  update public.user_profile set ui_state = jsonb_set(coalesce(ui_state,'{}'), '{assignmentReminders}', '{"tone":"formal","defaults":[60]}') where user_id = u;
  delete from public.assignment_reminder_sends where item_id in (a1, a2);
  select string_agg(distinct tone, ',') into formal_tone
    from public.claim_assignment_reminders() c where c.user_id = u and c.title like 'Probe%';
  update public.user_profile set ui_state = jsonb_set(ui_state, '{assignmentReminders,enabled}', 'false') where user_id = u;
  delete from public.assignment_reminder_sends where item_id in (a1, a2);

  raise exception 'RESULT first=% [%] second=% formalTone=% offWhenDisabled=%',
    first_run, got, second_run, formal_tone,
    (select count(*) from public.claim_assignment_reminders() c where c.user_id = u and c.title like 'Probe%');
end $$;
