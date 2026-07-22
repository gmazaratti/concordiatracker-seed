-- ── Survey reward: 3 days of Pro for a complete, eligible submission ──────────
-- Grants a TIME-LIMITED Pro window (user_profile.pro_until) once, server-side,
-- so it can't be farmed: requires a survey_response row, ≥3 distinct visit-days
-- (ui_state.visitDays) or admin, and never double-grants (survey_response.rewarded_at).
-- The app reads pro_until alongside plan_status when deciding the plan.
--
-- RUN AFTER the survey table exists (db/feedback_survey.sql). Safe to re-run.

alter table public.user_profile   add column if not exists pro_until  timestamptz;
alter table public.survey_response add column if not exists rewarded_at timestamptz;

create or replace function public.claim_survey_reward()
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  already   timestamptz;
  has_row   boolean;
  days      int;
  new_until timestamptz;
begin
  -- Must have submitted the survey.
  select true, rewarded_at into has_row, already
    from public.survey_response where user_id = auth.uid();
  if not coalesce(has_row, false) then
    return null;
  end if;

  -- Idempotent: already rewarded → just report the current window.
  if already is not null then
    return (select pro_until from public.user_profile where user_id = auth.uid());
  end if;

  -- Eligibility: ≥3 distinct visit-days, or an admin (who bypasses the gate).
  select case
           when jsonb_typeof(ui_state -> 'visitDays') = 'array'
             then jsonb_array_length(ui_state -> 'visitDays')
           else 0
         end
    into days
    from public.user_profile where user_id = auth.uid();
  if not (public.is_admin() or coalesce(days, 0) >= 3) then
    return (select pro_until from public.user_profile where user_id = auth.uid());
  end if;

  -- Grant 3 days from now (extend if already inside a Pro window).
  update public.user_profile
     set pro_until = greatest(coalesce(pro_until, now()), now()) + interval '3 days'
   where user_id = auth.uid()
   returning pro_until into new_until;
  update public.survey_response set rewarded_at = now() where user_id = auth.uid();
  return new_until;
end $$;
grant execute on function public.claim_survey_reward() to authenticated;
