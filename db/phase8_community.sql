-- ============================================================================
-- Phase 8 — Community (organizations + events + follows + reminders).
-- RUN THIS IN YOUR concordiatracker-dev PROJECT ONLY (SQL Editor → paste → Run).
-- Schema + RLS + seed (13 orgs + 20 events, transcribed from the seed data). The
-- student read path (feed / profiles / search) is wired next; follows + reminders
-- become real per-user rows after that.
--
-- PRIVACY (the hard line — Law 25 / aggregate-only, mirrors the portal design):
--   • organizations + events are PUBLIC read (approved orgs) — it's a public feed.
--   • org_follows + event_reminders are PER-USER, own-row only. An organizer can
--     see aggregate COUNTS (via a SECURITY DEFINER function, added with the portal
--     in Phase 10) but NEVER which students follow/remind. No policy lets anyone
--     read another user's follows/reminders.
-- ============================================================================

-- ── organizations (event hosts / orgs) ───────────────────────────────────────
create table if not exists public.organizations (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid references auth.users(id) on delete set null, -- null = seeded
  handle     text unique not null,            -- "@jmsb" — the public id
  name       text not null,
  verified   boolean not null default false,  -- a credible, confirmed source
  glyph      text,                            -- initials for the logo block
  color      text,                            -- brand hex
  logo       text,                            -- optional logo URL
  banner     text,                            -- optional banner URL
  bio        text default '',
  links      jsonb default '{}'::jsonb,        -- { website, instagram, x, linkedin }
  status     text not null default 'approved', -- approved | pending
  created_at timestamptz not null default now()
);
alter table public.organizations enable row level security;

drop policy if exists "orgs_public_read" on public.organizations;
drop policy if exists "orgs_owner_read"  on public.organizations;
drop policy if exists "orgs_owner_write" on public.organizations;
-- Approved orgs are public; an owner can always read their own (even if pending).
create policy "orgs_public_read" on public.organizations for select using (status = 'approved');
create policy "orgs_owner_read"  on public.organizations for select using (auth.uid() = owner_id);
create policy "orgs_owner_write" on public.organizations for update using (auth.uid() = owner_id);

-- ── events (the Community feed) ───────────────────────────────────────────────
create table if not exists public.events (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  title        text not null,
  start        timestamptz not null,
  mode         text not null default 'in-person', -- in-person | online
  location     text,
  category     text not null default 'clubs',      -- clubs | career | academic | official
  description  text default '',
  image        text,                                -- optional org-supplied image URL
  relevant_to  text[] default '{}',                 -- program/faculty tags
  posted_at    timestamptz not null default now(),  -- "Posted Xd ago"
  created_at   timestamptz not null default now()
);
alter table public.events enable row level security;

create index if not exists events_org_id_idx on public.events (org_id);
create index if not exists events_start_idx   on public.events (start);

drop policy if exists "events_public_read" on public.events;
drop policy if exists "events_org_write"   on public.events;
-- Public read for events whose org is approved (the feed). Org members write —
-- the member check is added with the org_members table in the portal phase; for
-- now writes are seeded server-side (SQL editor bypasses RLS).
create policy "events_public_read" on public.events for select
  using (exists (select 1 from public.organizations o where o.id = org_id and o.status = 'approved'));

-- ── org_follows (PRIVATE — own-row only; organizers never read this) ──────────
create table if not exists public.org_follows (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  org_id     uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, org_id)
);
alter table public.org_follows enable row level security;

drop policy if exists "follows_own" on public.org_follows;
-- Own-row only for EVERY operation (select included) — nobody can read who
-- follows whom. Aggregate counts come later from a SECURITY DEFINER function.
create policy "follows_own" on public.org_follows for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── event_reminders (PRIVATE — own-row only) ─────────────────────────────────
create table if not exists public.event_reminders (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  event_id   uuid not null references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);
alter table public.event_reminders enable row level security;

drop policy if exists "reminders_own" on public.event_reminders;
create policy "reminders_own" on public.event_reminders for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Seed: organizations ──────────────────────────────────────────────────────
delete from public.organizations where owner_id is null;
insert into public.organizations (owner_id, handle, name, verified, glyph, color, logo, banner, bio, links) values
  (null, '@gamedev.conu', 'Game Development Association', false, 'GD', '#a78bfa', null, null, 'A student club for aspiring game developers — workshops, game jams, and showcases across engines and disciplines.', '{}'::jsonb),
  (null, '@ginacody', 'Gina Cody School', true, 'GC', '#4fb89a', null, null, 'The Faculty of Engineering and Computer Science — info sessions, career events, and student programming for Gina Cody.', '{}'::jsonb),
  (null, '@concordia.hub', 'Birks Student Service Centre', true, 'BK', '#5b9cf6', null, null, 'Your first stop for registration, records, and enrolment help at Concordia.', '{}'::jsonb),
  (null, '@conu.caps', 'Counselling & Advocacy', true, 'CA', '#e0a13c', null, null, 'Counselling, wellness, and student advocacy — workshops, drop-ins, and support across campus.', '{}'::jsonb),
  (null, '@concordia.president', 'Office of the President', true, 'OP', '#c2566e', null, null, 'Official communications and community events from the Office of the President.', '{}'::jsonb),
  (null, '@hackconcordia', 'HackConcordia', false, 'HC', '#22b8a6', null, null, 'Quebec''s largest student-run hackathon community — building, learning, and shipping together.', '{}'::jsonb),
  (null, '@conu.outdoors', 'Concordia Outdoors Club', false, 'OC', '#6bbf59', null, null, 'Day hikes, ski trips, and outdoor adventures for Concordia students of every level.', '{}'::jsonb),
  (null, '@concordia.library', 'Concordia Library', true, 'LB', '#7c83f0', null, null, 'Research help, workshops, and study resources from the Concordia Library.', '{}'::jsonb),
  (null, '@concordia', 'Concordia University', true, 'CU', '#c2566e', null, null, 'Official news, open houses, and university-wide events from Concordia University.', '{}'::jsonb),
  (null, '@jmsb', 'John Molson School of Business', true, 'JM', '#912338', 'https://i.ibb.co/HLVRHtf9/JMSB-Profile-Picture.png', null, 'The John Molson School of Business — networking nights, case competitions, and career events for business students.', '{}'::jsonb),
  (null, '@casa.jmsb', 'CASA JMSB', true, 'CJ', '#9b2335', 'https://i.ibb.co/jkRyPXL8/CASA-JMSB-Profile-Picture.png', 'https://i.ibb.co/mC78DnR1/CASA-JMSB-Banner.webp', 'The Commerce and Administration Students'' Association — the official undergraduate association of JMSB.', '{}'::jsonb),
  (null, '@jmis', 'John Molson Investment Society', true, 'JI', '#1f4e8c', 'https://i.ibb.co/4qqLLxq/JMIS-Profile-Picture.png', null, 'A student-run investment society at John Molson — speaker series, stock pitches, and portfolio workshops.', '{"linkedin":"https://www.linkedin.com/company/jmis-ca/","instagram":"https://www.instagram.com/jmis.ca/","website":"https://linktr.ee/jmis.ca"}'::jsonb),
  (null, '@conu.mathhelp', 'Math & Stats Help Centre', false, 'MS', '#e0853c', null, null, 'Free peer tutoring and exam-prep sessions in mathematics and statistics.', '{}'::jsonb);

-- ── Seed: events (org_id resolved by handle) ─────────────────────────────────
insert into public.events (org_id, title, start, mode, location, category, description, image, relevant_to, posted_at)
select o.id, v.title, v.start, v.mode, v.location, v.category, v.description, v.image, v.relevant_to, v.posted_at
from (values
  ('@gamedev.conu', 'Game Dev Club — Unity intro workshop', now() + interval '1 days', 'in-person', 'H 920', 'clubs', 'A hands-on intro to Unity for total beginners — build your first 2D scene and learn the editor. Laptops provided; no experience needed. Snacks afterward.', null, array['Computer Science','Gina Cody','Engineering']::text[], now() - interval '6 days'),
  ('@ginacody', 'Tech & Engineering Career Fair', now() + interval '2 days', 'in-person', 'EV Building Atrium', 'career', '40+ employers hiring for internships and new-grad roles across software, hardware, and data. Bring printed résumés; dress business-casual. Drop in any time.', null, array['Computer Science','Gina Cody','Engineering']::text[], now() - interval '12 days'),
  ('@concordia.hub', 'Add / drop & tuition refund deadline', now() + interval '3 days', 'online', 'Online — Student Hub', 'academic', 'Last day to drop a course with a full tuition refund and no transcript notation. Changes are made yourself in the Student Hub before 11:59 PM.', null, '{}'::text[], now() - interval '21 days'),
  ('@conu.caps', 'Drop-in résumé clinic', now() + interval '3 days', 'in-person', 'GM 350', 'career', 'Get a 15-minute one-on-one résumé review from a career advisor. First come, first served — bring a printed copy or a laptop.', null, '{}'::text[], now() - interval '4 days'),
  ('@concordia.president', 'President''s town hall', now() + interval '4 days', 'in-person', 'D.B. Clarke Theatre', 'official', 'An open conversation with the President on this year’s priorities, followed by a community Q&A. All students, staff, and faculty welcome.', null, '{}'::text[], now() - interval '9 days'),
  ('@hackconcordia', 'ConUHacks kickoff & team-building', now() + interval '6 days', 'in-person', 'JMSB Atrium', 'clubs', 'Kickoff for Quebec’s largest student hackathon. Meet teammates, hear from sponsors, and lock in your idea before the 24-hour build weekend.', null, array['Computer Science','Gina Cody','Engineering']::text[], now() - interval '14 days'),
  ('@conu.outdoors', 'Fall hike — Mont Saint-Hilaire', now() + interval '9 days', 'in-person', 'Meet at Hall Building', 'clubs', 'A guided day hike with transport included. Moderate difficulty (~6 km). Bring water, sturdy shoes, and a packed lunch. Sign-up closes when full.', null, '{}'::text[], now() - interval '8 days'),
  ('@concordia.library', 'Research & citation workshop', now() + interval '10 days', 'online', 'Online — Zoom', 'academic', 'A librarian walks through finding peer-reviewed sources, managing references with Zotero, and avoiding accidental plagiarism. A recording is shared after.', null, '{}'::text[], now() - interval '5 days'),
  ('@concordia', 'Fall Open House', now() + interval '12 days', 'in-person', 'SGW Campus, Hall Building', 'official', 'Campus tours, program info sessions, and a chance to meet faculty and current students across both campuses. Free admission; bring a friend.', null, '{}'::text[], now() - interval '25 days'),
  ('@jmsb', 'JMSB Networking Night', now() + interval '15 days', 'in-person', 'MB 1.210', 'career', 'Connect with alumni and recruiters across finance, marketing, and consulting in a relaxed setting. Business attire recommended; light refreshments served.', null, array['John Molson','Business','Commerce']::text[], now() - interval '10 days'),
  ('@conu.mathhelp', 'Calculus II exam-prep session', now() + interval '16 days', 'in-person', 'LB 921', 'academic', 'A peer-led review of integration techniques, sequences, and series ahead of midterms. Bring your toughest practice problems to work through together.', null, array['Computer Science','Engineering','Mathematics']::text[], now() - interval '3 days'),
  ('@jmsb', 'Case Competition info session', now() + interval '8 days', 'in-person', 'MB 2.255', 'career', 'Learn how case competitions work, how teams are picked, and how to prep. A great first step if you want to represent JMSB this year.', null, array['John Molson','Business','Commerce']::text[], now() - interval '7 days'),
  ('@casa.jmsb', 'CASA Stock Pitch Competition', now() + interval '7 days', 'in-person', 'MB 1.210', 'career', 'Pitch a stock to a panel of industry judges and compete for cash prizes. Open to all JMSB students — solo or in teams of two. Coaching sessions run the week before; sign up early as spots are limited.', 'https://i.ibb.co/mC78DnR1/CASA-JMSB-Banner.webp', array['John Molson','Business','Commerce','Finance']::text[], now() - interval '11 days'),
  ('@jmis', 'JMIS Speaker Series — markets & macro outlook', now() + interval '5 days', 'in-person', 'MB S2.330', 'career', 'An evening with a portfolio manager on reading the macro picture and positioning a student portfolio, followed by Q&A and networking. Open to members and curious newcomers alike.', null, array['John Molson','Business','Commerce','Finance']::text[], now() - interval '6 days'),
  ('@casa.jmsb', 'CASA Cares — charity week kickoff', now() + interval '13 days', 'in-person', 'JMSB Atrium', 'clubs', 'Kick off CASA Cares week — a week of fundraising events, raffles, and a charity gala supporting a local cause. Drop by the atrium to grab a schedule and a wristband.', 'https://i.ibb.co/xtqFkQ1F/CASA-JMSB-Basic-Banner.png', array['John Molson','Business','Commerce']::text[], now() - interval '9 days'),
  ('@hackconcordia', 'Workshop: building with public APIs', now() + interval '20 days', 'online', 'Online — Discord', 'clubs', 'A hands-on session on calling REST APIs, handling auth, and shipping a tiny project — perfect warmup before the hackathon. Beginners welcome.', null, array['Computer Science','Gina Cody','Engineering']::text[], now() - interval '2 days'),
  ('@hackconcordia', 'ConUHacks IX — 24-hour hackathon', now() - interval '16 days', 'in-person', 'JMSB Atrium', 'clubs', 'Our flagship 24-hour hackathon — hundreds of students, mentors, and sponsors building projects overnight. Thanks to everyone who came out.', null, array['Computer Science','Gina Cody','Engineering']::text[], now() - interval '48 days'),
  ('@hackconcordia', 'Intro to Git & GitHub workshop', now() - interval '31 days', 'online', 'Online — Discord', 'clubs', 'A beginner-friendly walkthrough of version control: commits, branches, and pull requests, with a hands-on repo to practice on.', null, array['Computer Science','Gina Cody','Engineering']::text[], now() - interval '40 days'),
  ('@ginacody', 'Capstone project showcase', now() - interval '22 days', 'in-person', 'EV Building Atrium', 'academic', 'Graduating students demoed their capstone projects to faculty and industry guests. Congratulations to this year’s cohort.', null, array['Computer Science','Gina Cody','Engineering']::text[], now() - interval '38 days'),
  ('@jmsb', 'JMSB Welcome Week mixer', now() - interval '27 days', 'in-person', 'MB Atrium', 'career', 'New and returning JMSB students met clubs, faculty, and each other over food and music to kick off the term.', null, array['John Molson','Business','Commerce']::text[], now() - interval '35 days'),
  ('@casa.jmsb', 'CASA Frosh kickoff', now() - interval '34 days', 'in-person', 'Loyola Quad', 'clubs', 'A week of orientation events welcoming first-year commerce students to JMSB and the CASA community.', null, array['John Molson','Business','Commerce']::text[], now() - interval '44 days')
) as v(handle, title, start, mode, location, category, description, image, relevant_to, posted_at)
join public.organizations o on o.handle = v.handle;
