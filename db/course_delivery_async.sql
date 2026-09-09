-- ─────────────────────────────────────────────────────────────────────────────
-- Asynchronous online is its own delivery mode.
--
-- "Online" and "online with no meeting time" are different facts about a class
-- and a student needs to be able to say which. Without the distinction the
-- schedule builder told someone taking an asynchronous COMM 225 that it "has no
-- meeting time published yet" — which reads as our data being incomplete, when
-- in reality the class genuinely has no time and never will.
--
--   in-person     meets in a room
--   online        meets, online, at a fixed time
--   online-async  no meeting time at all, by design
--   hybrid        some of each
--
-- Null still means nobody has said, which is not the same as in-person.
--
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.courses drop constraint if exists courses_delivery_check;

alter table public.courses
  add constraint courses_delivery_check
  check (delivery is null or delivery in ('in-person', 'online', 'online-async', 'hybrid'));
