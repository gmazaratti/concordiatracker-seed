-- ── Admin: read every survey response (with who submitted it) ─────────────────
-- survey_response holds only user_id; join user_profile so the admin dashboard
-- can show who said what. Admin-gated SECURITY DEFINER (survey_response RLS
-- otherwise limits reads to the owner + a plain admin-select policy).
--
-- RUN AFTER db/feedback_survey.sql + db/survey_reward.sql. Safe to re-run.

create or replace function public.admin_list_survey_responses()
returns table (
  user_id    uuid,
  name       text,
  email      text,
  handle     text,
  avatar_url text,
  ratings    jsonb,
  recommend  boolean,
  answers    jsonb,
  created_at timestamptz,
  rewarded   boolean
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return query
    select s.user_id, p.name, p.email, p.handle, p.avatar_url,
           s.ratings, s.recommend, s.answers, s.created_at, (s.rewarded_at is not null)
    from public.survey_response s
    left join public.user_profile p on p.user_id = s.user_id
    order by s.created_at desc;
end $$;

grant execute on function public.admin_list_survey_responses() to authenticated;
