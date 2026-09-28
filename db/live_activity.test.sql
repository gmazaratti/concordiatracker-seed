-- Rolled-back check of claim_live_activity_starts. Always ends in an exception
-- carrying the results, so nothing it writes survives.
do $$
declare
  u uuid;
  a1 uuid := gen_random_uuid();
  first_run int; second_run int; picked text; far int;
begin
  select user_id into u from public.user_profile limit 1;
  update public.user_profile set ui_state = coalesce(ui_state, '{}') - 'assignmentReminders' where user_id = u;
  insert into public.live_activity_tokens (token, user_id) values (repeat('ab', 32), u);
  -- Clear the user's real candidates out of the way for the test.
  update public.assignments set done = true where user_id = u and done = false;
  insert into public.assignments (id, user_id, title, date, type, weight, done, deleted, status)
  values (a1, u, 'Probe soon', now() + interval '3 hours', 'assignment', 10, false, false, 'not-started');
  insert into public.assignments (user_id, title, date, type, weight, done, deleted, status)
  values (u, 'Probe later', now() + interval '5 hours', 'assignment', 10, false, false, 'not-started');
  select count(*), string_agg(c.title, ',') into first_run, picked from public.claim_live_activity_starts() c where c.user_id = u;
  select count(*) into second_run from public.claim_live_activity_starts() c where c.user_id = u;
  -- Window of 1 hour: the 3-hour one is outside it.
  delete from public.live_activity_starts where user_id = u;
  update public.user_profile set ui_state = jsonb_set(coalesce(ui_state,'{}'), '{assignmentReminders}', '{"liveWindowHours":1}') where user_id = u;
  select count(*) into far from public.claim_live_activity_starts() c where c.user_id = u;
  raise exception 'RESULT first=% picked=% second=% outsideWindow=%', first_run, picked, second_run, far;
end $$;
