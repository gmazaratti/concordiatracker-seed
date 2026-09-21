-- Not everyone who signs up is at Concordia.
--
-- Onboarding had no way to say so, and step 3 of 11 could not be passed
-- without picking a Concordia programme — so someone at another school hit a
-- wall three screens in and could go no further. (Reported by a real person
-- the day this was written.)
--
-- WHY A BOOLEAN AND NOT A `school` STRING. `user_profile.school` already
-- exists and already holds FACULTY names ("Gina Cody", "JMSB"), so writing
-- "McGill" into it makes the two meanings indistinguishable — and every
-- Concordia-only surface would have to guess which kind of value it was
-- looking at. One explicit flag reads the same everywhere.
--
-- DEFAULT TRUE, so every existing row keeps exactly the behaviour it has now.
-- Nothing is gated OFF by this column; it only stops us ASKING Concordia
-- questions (Moodle, the course catalogue, the shuttle, blueprints) of
-- someone the answer cannot apply to. The core of the product — courses,
-- deadlines, a syllabus parse, a GPA — is school-agnostic and stays on.

alter table public.user_profile
  add column if not exists at_concordia boolean not null default true;

comment on column public.user_profile.at_concordia is
  'False when the student told us they are not at Concordia. Hides Concordia-specific surfaces; never gates the core product.';

-- `school` keeps its existing meaning for Concordia students (faculty) and
-- holds the typed school name for everyone else. The flag is what code reads.
