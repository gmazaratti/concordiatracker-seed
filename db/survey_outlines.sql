-- ─────────────────────────────────────────────────────────────────────────────
-- Survey: outline uploads + a one-week trial, claimed by link.
--
-- Both exist to solve the same cold-start problem: the app is about to get its
-- first real users and has almost no outlines in it, so the survey is the one
-- moment a hundred students are already holding their syllabi.
--
-- Run this in the Supabase SQL editor (project qagtygymiivnyfwrtmzl).
-- The survey KEEPS WORKING WITHOUT IT — the upload and the trial are both
-- optional paths that fail quietly, so handing the link out before running this
-- costs answers nothing.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Somewhere for the files ──────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('survey-outlines', 'survey-outlines', false)
on conflict (id) do nothing;

-- Anonymous INSERT only. A respondent can drop a file in and can never list,
-- read, or overwrite what anyone else dropped — the bucket is a letterbox, not
-- a folder. Reading is the service role's job, which is how the admin console
-- gets at them.
drop policy if exists "survey_outlines_insert" on storage.objects;
create policy "survey_outlines_insert" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'survey-outlines');

-- ── 2. The trial token ──────────────────────────────────────────────────────
-- Long and never displayed, because it rides in the "create your account" link
-- rather than being read off a screen. A short code on screen gets
-- screenshotted and passed round a group chat, and then the free week is a
-- coupon instead of a thank-you to the person who answered.
alter table public.public_survey add column if not exists reward_code  text;
alter table public.public_survey add column if not exists redeemed_by  uuid references auth.users(id) on delete set null;
alter table public.public_survey add column if not exists redeemed_at  timestamptz;
alter table public.public_survey add column if not exists outline_files jsonb not null default '[]'::jsonb;

create unique index if not exists public_survey_reward_code_idx
  on public.public_survey (reward_code) where reward_code is not null;

/**
 * Redeem a survey token for seven days of Pro.
 *
 * SECURITY DEFINER because public_survey is insert-only to anon and must stay
 * that way — a client that could read the table could read every token. It
 * checks the token exists and is unclaimed, then stamps it. One account per
 * token, one token per response.
 *
 * Seven days, no card, is deliberate: the point is to see whether someone puts
 * a real term into it, and a card wall at the door defeats that.
 */
create or replace function public.redeem_survey_code(p_code text)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  row_id  uuid;
  claimed uuid;
  until   timestamptz;
begin
  if auth.uid() is null then
    raise exception 'sign in first';
  end if;

  -- Exact match, case intact. The token is lowercase base-36 and upper-casing
  -- it here (a leftover from the readable-code version) would fail every claim.
  select id, redeemed_by into row_id, claimed
    from public.public_survey
   where reward_code = trim(p_code);

  if row_id is null then
    raise exception 'that link is not valid';
  end if;
  if claimed is not null and claimed <> auth.uid() then
    raise exception 'that link has already been used';
  end if;

  -- Extends rather than overwrites, so redeeming does not shorten a window
  -- somebody already has.
  select greatest(coalesce(pro_until, now()), now()) + interval '7 days'
    into until
    from public.user_profile where user_id = auth.uid();

  update public.user_profile set pro_until = until where user_id = auth.uid();
  update public.public_survey
     set redeemed_by = auth.uid(), redeemed_at = coalesce(redeemed_at, now())
   where id = row_id;

  return until;
end $$;

revoke all on function public.redeem_survey_code(text) from public, anon;
grant execute on function public.redeem_survey_code(text) to authenticated;

-- Admin read of what came in, including the uploaded filenames.
create or replace function public.admin_list_survey_outlines()
returns table (id uuid, created_at timestamptz, email text, outline_files jsonb, reward_code text, redeemed_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return query
    select s.id, s.created_at, s.email, s.outline_files, s.reward_code, s.redeemed_at
      from public.public_survey s
     where jsonb_array_length(s.outline_files) > 0
     order by s.created_at desc;
end $$;

revoke all on function public.admin_list_survey_outlines() from public, anon;
grant execute on function public.admin_list_survey_outlines() to authenticated;
