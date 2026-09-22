-- ⚠ DEMO CONTENT — PLACEHOLDER POSTS AND STORIES ON REAL CLUBS ⚠
--
-- READ THIS BEFORE RUNNING IT. These rows are attributed to REAL Concordia
-- organisations that did not write them, on the production database that real
-- students use. That is the one thing this project otherwise refuses to do, and
-- it is only acceptable here because you asked for filler to look at and
-- because of three deliberate limits:
--
--   • Every caption is generic. No dates, no deadlines, no claims and nothing
--     anyone could act on and be wrong. The worst case is a student seeing a
--     bland sentence a club did not write — not a student turning up to
--     something that does not exist.
--   • Every row is tagged, so removing them is one statement (at the bottom).
--   • Stories normally expire in 24 hours; these are given a long expiry so the
--     row survives long enough to look at. That is NOT how a real story behaves.
--
-- DELETE THEM ONCE YOU HAVE SEEN THE FEED. The delete block is at the end.
--
-- RUN in the Supabase SQL editor. Safe to re-run (it clears its own rows first).

-- Marker: every demo row carries this in its caption/text so nothing else is
-- ever caught by the cleanup.
-- tag: [ct-demo]

delete from public.org_posts   where caption like '%[ct-demo]%';
delete from public.org_stories where coalesce(caption, '') like '%[ct-demo]%';

-- ── Posts ───────────────────────────────────────────────────────────────────
-- THE NOTIFICATION TRIGGER IS OFF FOR THIS INSERT. Without that, six demo
-- posts would push a real notification to every real follower of six real
-- clubs about something none of them wrote — which is a far worse thing than
-- the placeholder caption itself.
alter table public.org_posts disable trigger trg_org_post;

-- Images are Unsplash (free licence) standing in for the club's own photo.
-- Replace them with what the club actually posts before any of this is real.
insert into public.org_posts (org_id, caption, media, created_at)
select o.id, v.caption, v.media::jsonb, now() - (v.age || ' hours')::interval
  from (values
    ('@hackconcordia',
     'Build night. Bring a laptop and something you are stuck on. [ct-demo]',
     '[{"url":"https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1080&q=70&auto=format&fit=crop"},{"url":"https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=1080&q=70&auto=format&fit=crop"}]',
     3),
    ('@reggiesmtl',
     'Pints, pool and a quiet corner if you actually need to study. [ct-demo]',
     '[{"url":"https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=1080&q=70&auto=format&fit=crop"}]',
     9),
    ('@jmis',
     'Markets close, we open. Pitch practice in the usual room. [ct-demo]',
     '[{"url":"https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1080&q=70&auto=format&fit=crop"}]',
     20),
    ('@concordiagamedev',
     'Playtest table is open to anyone, finished or not. [ct-demo]',
     '[{"url":"https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1080&q=70&auto=format&fit=crop"}]',
     31),
    ('@casajmsb',
     'Thanks to everyone who came out. Room was full. [ct-demo]',
     '[{"url":"https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1080&q=70&auto=format&fit=crop"}]',
     46),
    ('@ginacody',
     'Lab space is open late again this term. [ct-demo]',
     '[{"url":"https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=1080&q=70&auto=format&fit=crop"}]',
     58)
  ) as v(handle, caption, media, age)
  join public.organizations o
    on lower(o.handle) = lower(v.handle) and coalesce(o.status, 'pending') = 'approved';

alter table public.org_posts enable trigger trg_org_post;

-- ── Stories ─────────────────────────────────────────────────────────────────
-- A long expiry so the ring survives long enough to look at. A real story is
-- 24 hours and the reader should know these are not behaving normally.
insert into public.org_stories (org_id, image_url, caption, overlays, expires_at, created_at)
select o.id, v.img, v.cap, v.overlays::jsonb, now() + interval '30 days',
       now() - (v.age || ' hours')::interval
  from (values
    ('@hackconcordia',
     'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1080&q=70&auto=format&fit=crop',
     'Tonight [ct-demo]',
     '[{"text":"Build night","x":0.5,"y":0.28,"font":"modern","color":"#ffffff","chip":true,"anim":"rise"}]',
     2),
    ('@reggiesmtl',
     'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=1080&q=70&auto=format&fit=crop',
     'Open now [ct-demo]',
     '[{"text":"Doors open","x":0.5,"y":0.72,"font":"classic","color":"#ffe14d","chip":false,"anim":"pop"}]',
     5),
    ('@casajmsb',
     'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=1080&q=70&auto=format&fit=crop',
     'From last week [ct-demo]',
     '[]',
     11),
    ('@jmsb',
     'https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=1080&q=70&auto=format&fit=crop',
     'Around the building [ct-demo]',
     '[]',
     18)
  ) as v(handle, img, cap, overlays, age)
  join public.organizations o
    on lower(o.handle) = lower(v.handle) and coalesce(o.status, 'pending') = 'approved';

-- ── REMOVE ALL OF IT ────────────────────────────────────────────────────────
-- Run these two lines on their own when you are done looking:
--
--   delete from public.org_posts   where caption like '%[ct-demo]%';
--   delete from public.org_stories where coalesce(caption, '') like '%[ct-demo]%';
