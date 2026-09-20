-- ============================================================================
-- Internal and comped accounts — flags, not a hard-coded list.
-- RUN IN: Supabase SQL Editor. Safe to re-run.
--
-- The owner stats have to answer "how many real users" and "how many people
-- actually pay", and both answers were wrong because a dozen of the accounts
-- are the founder's own and three more were given Pro rather than buying it.
--
-- WHY COLUMNS AND NOT A LIST IN THE CODE. A list in a query is invisible from
-- the admin screen, cannot be changed without a deploy, and silently rots the
-- moment a new test account appears. A column can be toggled from the user
-- panel, shows up when you look at the account, and every consumer reads the
-- same flag.
--
--   is_internal — a founder/dev/test account. Not a user. Not a customer.
--                 Excluded from user counts, signups, visitor counts, revenue.
--   comped      — a real person who was GIVEN Pro. Counts as a user, never as
--                 a paying customer, and contributes nothing to MRR.
--
-- The seeding below is a one-time backfill of what is true today. After this
-- runs, the flags are data: set them from the admin panel, not from here.
-- ============================================================================

alter table public.user_profile
  add column if not exists is_internal boolean not null default false,
  add column if not exists comped      boolean not null default false;

-- One line each on purpose: db/verify.mjs strips `comment on` per LINE, and a
-- two-line statement leaves its second half behind to break the whole file.
comment on column public.user_profile.is_internal is 'Founder/dev/test account. Excluded from every owner-facing count.';
comment on column public.user_profile.comped is 'Given Pro rather than paying. A real user; never a paying customer.';

-- ── The backfill ─────────────────────────────────────────────────────────────
-- By EMAIL, which is the only stable identifier here: display names change and
-- three of these people share a first name with a real student.
--
-- Written as a single `in` list against lower(email) so re-running is a no-op
-- and so a typo shows up as a row that did not move rather than as a wrong
-- account being marked.
update public.user_profile
   set is_internal = true
 where lower(email) in (
   'concordiatracker@gmail.com',
   'alexxdegryse@gmail.com',
   'senjisfn@gmail.com',
   'senshisolution@gmail.com',
   'amrrealitys@gmail.com',
   'goldifyonyt@gmail.com',
   'pluresense@gmail.com',
   'theehowtochannel@gmail.com',
   'envyismbuissness@gmail.com',
   'cloakedshop@gmail.com',
   'senjifps@gmail.com',
   'usealibisupport@gmail.com'
 );

update public.user_profile
   set comped = true
 where lower(email) in (
   'amirkhord@gmail.com',        -- Ali
   'sofia.molina02@gmail.com',   -- Sofia
   'naveed-ghaffar0120@hotmail.com' -- Naveed
 );

-- ── Who counts ───────────────────────────────────────────────────────────────
-- One definition, so the admin dashboard and the owner API cannot disagree
-- about the number of users the way the parse limiter and the usage meter
-- disagreed about uploads.
create or replace function public.ct_is_countable(p_user uuid)
returns boolean
language sql security definer set search_path = public stable as $$
  select coalesce((
    select not p.is_internal from public.user_profile p where p.user_id = p_user
  ), true);
$$;
grant execute on function public.ct_is_countable(uuid) to authenticated;

-- Check — expect 12 internal, 3 comped, and the rest untouched:
--   select is_internal, comped, count(*) from public.user_profile
--    group by 1, 2 order by 1, 2;
--
-- Accounts holding Pro that are NEITHER paid, internal, nor comped (should be
-- empty once every grant is accounted for):
--   select name, email from public.user_profile
--    where plan_status = 'pro' and not is_internal and not comped
--      and stripe_subscription_id is null;
