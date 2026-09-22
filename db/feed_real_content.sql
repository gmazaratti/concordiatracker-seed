-- ============================================================================
-- The feed stops borrowing stock photography.
-- RUN IN: Supabase SQL Editor. Safe to re-run.
--
-- WHAT WAS THERE. Six posts and four stories, every one of them an Unsplash
-- photograph of a generic lecture hall / bar / trading floor, seeded to make
-- the feed look inhabited. They are the wrong kind of wrong: a student
-- recognises a stock photo instantly, and the moment they do, every real event
-- on the page inherits the doubt.
--
-- WHAT REPLACES THEM. Two posts, both about things that are genuinely
-- happening, both carrying artwork their own organisation supplied:
--
--   FISA's Academic Series week 2 — the club uploaded that poster to us, it is
--   already the event's image, and the event is this week. It leads.
--   Reggies' Thirsty Thursdays — the venue's own banner, from public/logos.
--
-- Two real posts beat six fake ones. An empty-ish feed is a true statement
-- about a product that launched last week; a full one made of stock images is
-- a false statement about the same thing.
--
-- HOW THIS FILE FINDS ITS OWN WORK AGAIN. Not with a marker in the text: the
-- first version appended `[ct-seed]` to every caption and it rendered, in the
-- feed and under a story, to real users. An internal tag that reaches the
-- screen is a bug however useful it is behind the scenes. It matches on the
-- opening words of each caption instead — long, specific, and invisible.
-- ============================================================================

-- ── 1. Out go the stock ones ────────────────────────────────────────────────
-- Matched on the `[ct-demo]` tag their own seeder wrote, NOT on "any post with
-- an unsplash URL" — a real club could legitimately post one, and a delete
-- that guesses is a delete that eventually takes somebody's real content.
delete from public.post_comments
 where post_id in (select id from public.org_posts where caption like '%[ct-demo]%');
delete from public.post_likes
 where post_id in (select id from public.org_posts where caption like '%[ct-demo]%');
delete from public.reposts
 where target_kind = 'post'
   and target_id::text in (select id::text from public.org_posts where caption like '%[ct-demo]%');
delete from public.org_posts where caption like '%[ct-demo]%';

-- The stories were the same seeder's work and the same stock library. They are
-- matched by URL because a story caption is often empty and there was no tag
-- to hang on — but the pattern is the CDN host, which no club can upload to.
delete from public.story_views
 where story_id in (select id from public.org_stories where image_url like 'https://images.unsplash.com/%');
delete from public.org_stories where image_url like 'https://images.unsplash.com/%';

-- ── 2. In come two real ones ────────────────────────────────────────────────
-- `author_user` has to be a real account (the column is not null and the row is
-- audited), so the founder's account stands in as the publisher — the same
-- thing that happens when an admin posts on a club's behalf through the portal.
do $$
declare
  author uuid;
  fisa   uuid;
  reg    uuid;
  poster text;
begin
  select user_id into author from public.user_profile where lower(handle) = 'alex';
  if author is null then
    select user_id into author from public.user_profile where lower(handle) = 'concordiatracker';
  end if;
  select id into fisa from public.organizations where handle = '@fisajmsb';
  select id into reg  from public.organizations where handle = '@reggiesmtl';
  if author is null then raise notice 'No account to publish as — skipped.'; return; end if;

  -- FISA: the poster the club actually uploaded, read off their own event so
  -- the two can never show different artwork for the same night.
  select e.image into poster
    from public.events e
   where e.org_id = fisa and e.image is not null
   order by e.start desc
   limit 1;

  if fisa is not null and poster is not null then
    delete from public.org_posts where org_id = fisa and caption like 'Week 2 of the Academic Series:%';
    insert into public.org_posts (org_id, author_user, caption, media, created_at)
    values (
      fisa,
      author,
      'Week 2 of the Academic Series: Bloomberg and FactSet, the two terminals every finance internship assumes you have touched. '
      || 'No registration — bring a laptop, MB 5.265. We build on this all semester: modelling, valuation, and the rest.',
      -- The poster's real pixels, so the card reserves a portrait box before
      -- the bytes arrive instead of cropping a 1179x1449 poster to a square.
      jsonb_build_array(jsonb_build_object('url', poster, 'w', 1179, 'h', 1449)),
      now()
    );
  else
    raise notice 'FISA has no event artwork — skipped that post.';
  end if;

  -- Reggies: the venue's own banner, served from the site rather than a CDN.
  if reg is not null then
    delete from public.org_posts where org_id = reg and caption like 'Thirsty Thursdays. Cheap pints%';
    insert into public.org_posts (org_id, author_user, caption, media, created_at)
    values (
      reg,
      author,
      'Thirsty Thursdays. Cheap pints, a full room, and whoever is around — doors from 8, bar runs to 2. '
      || 'Hall building mezzanine, student ID at the door, 18+.',
      -- 780x320 is wider than the widest shape a feed card takes (1.91:1), so
      -- `postAspect` clamps it — which letterboxes rather than cropping the
      -- ends off a banner that is mostly type.
      jsonb_build_array(jsonb_build_object('url', '/logos/reggies-banner.jpg', 'w', 780, 'h', 320)),
      now() - interval '5 hours'
    );
  end if;
end $$;

-- ── 3. Two stories, from the same two real images ───────────────────────────
-- The row of rings is the first thing on the feed and an empty one reads as a
-- broken feature, so it keeps two — but only ones whose picture belongs to the
-- club showing it.
do $$
declare
  author uuid;
  fisa   uuid;
  reg    uuid;
  poster text;
begin
  select user_id into author from public.user_profile where lower(handle) = 'alex';
  select id into fisa from public.organizations where handle = '@fisajmsb';
  select id into reg  from public.organizations where handle = '@reggiesmtl';
  if author is null then return; end if;

  select e.image into poster from public.events e
   where e.org_id = fisa and e.image is not null order by e.start desc limit 1;

  if fisa is not null and poster is not null then
    delete from public.org_stories where org_id = fisa and caption like 'Tonight ·%';
    insert into public.org_stories (org_id, author_user, image_url, caption, expires_at)
    values (fisa, author, poster, 'Tonight · MB 5.265', now() + interval '20 hours');
  end if;

  if reg is not null then
    delete from public.org_stories where org_id = reg and caption like 'Thursday. Same as ever%';
    insert into public.org_stories (org_id, author_user, image_url, caption, expires_at)
    values (reg, author, '/logos/reggies-banner.jpg', 'Thursday. Same as ever.', now() + interval '20 hours');
  end if;
end $$;

-- ── Checks ──────────────────────────────────────────────────────────────────
--   select count(*) from org_posts where caption like '%unsplash%';         -- 0
--   select o.handle, left(p.caption, 40), p.media
--     from org_posts p join organizations o on o.id = p.org_id
--    order by p.created_at desc;
