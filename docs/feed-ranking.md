# Ranking the Community feed — a proposed structure

**Status: proposal. Nothing here is built.** The feed today is
`post_feed(p_following, p_limit, p_offset)` — everything the clubs you follow
have published, newest first. This describes what to build when that stops
being enough, and roughly in what order.

## What is wrong with newest-first, specifically

Two failures, and they pull in opposite directions:

1. **A frequent poster drowns a rare one.** Reggies posts every Thursday. FISA
   posts when something is on. Ordered by time alone, a student who follows
   both sees Reggies and, several scrolls down, the thing they would actually
   have gone to.
2. **A new event arrives after you have stopped scrolling.** The one post that
   is genuinely time-critical — a deadline, a room change, a night that is
   tonight — has no way to jump the queue, because publication time is the
   only signal.

Both are solvable without anything that deserves the word "algorithm" yet.

## The shape: one score, computed server-side, explainable in a sentence

```
score = recency × affinity × relevance × diversity_penalty × urgency_boost
```

Multiplicative, not additive, so a zero in any term removes the item rather
than letting three good scores outvote one disqualifying fact. Each term is a
number between 0 and ~2 and each one is worth being able to say out loud.

### recency — what it already does

`exp(-hours_since_post / HALF_LIFE)`, `HALF_LIFE ≈ 20 hours`. An exponential
rather than a cliff so nothing falls off a shelf at exactly 24 hours.

### affinity — the part the user asked for

> *"if you like or repost or interact with a finance event, you're primarily
> served FIRST finance content"*

**Interactions are already stored and nothing new needs collecting.**
`post_likes`, `reposts`, `post_comments`, `org_follows`, `todos` (added to
calendar) and the story-view rows are a complete record of what somebody has
engaged with. The missing piece is not data, it is a **category on the thing
engaged with**.

Events have `category` (clubs / career / academic / official) and
`relevant_to[]`. **Posts have neither.** So step one is:

```sql
alter table org_posts add column topics text[] default '{}';
```

filled three ways, in this order of trust:

| Source | How | Trust |
|---|---|---|
| The club's own categories | an org posts mostly one kind of thing; inherit from its events | high |
| The poster picking one | a chip row in the composer | highest, but optional |
| Inferred from the caption | keyword match against a small fixed vocabulary | low — never the only source |

Then affinity is a per-user vector over those topics, recomputed nightly:

```sql
create table user_topic_affinity (
  user_id uuid, topic text, weight real,
  primary key (user_id, topic)
);
```

with weights from a fixed table of what each action is worth. The numbers
matter less than the ordering, and the ordering should be **by cost to the
user**, because that is what makes an action a signal:

| Action | Weight |
|---|---|
| Added to calendar | 5 |
| Reposted | 4 |
| Commented | 3 |
| Liked | 2 |
| Opened the detail | 1 |
| Scrolled past | 0 |

Decay old rows (`weight × 0.95` per week) so last year's interests do not
outrank this month's.

`affinity = 1 + 0.6 × normalized_weight(topic)` — capped, so a strong interest
promotes finance content without making everything else invisible. **A feed
that only ever shows you one topic is a feed you stop opening**, and this is
the term most likely to be tuned too hard.

### relevance — what we already know and do not use

`user_profile.program` / `school` against `events.relevant_to`, which
`isRelevantTo()` already computes for the "For your program" badge. A Gina Cody
student should see the Gina Cody career fair above the JMSB one, and this
requires no new data at all.

### diversity_penalty — the fix for Reggies

`0.55 ^ (number of items from this org already placed above)`. The second post
from an org in one session scores 55%, the third 30%. It does not hide
anything; it interleaves. Without this, affinity makes problem 1 worse, not
better, because the club you interact with most is the one that already
dominates.

### urgency_boost — the fix for "new events always show"

> *"we will have to build a proper algorithm for the feed so new events always
> show"*

`1.8` for an event starting in the next 48 hours that the viewer has not
already added, decaying to `1.0` at a week out. This is the only term that can
promote something you have never engaged with, and it is the reason the feed
cannot become a pure interest bubble: **a deadline is relevant because of when
it is, not because of what you like.**

## Where it runs

**In the database, as `post_feed_ranked()`** — not in the client.

- The client cannot see other people's engagement, and must not.
- Ranking in the client means fetching everything and sorting it, which is the
  opposite of what a feed is for on a phone.
- It is one function, so the ordering has one definition and the "why am I
  seeing this" answer below cannot drift from it.

Affinity is a materialised table refreshed by the existing nightly cron, not
computed per request. A feed query that joins six interaction tables at read
time is a feed query that gets slower every week the product succeeds.

## The rule this product should keep

**Every ranked item must be able to say why it is there.** The same discipline
as the provenance badges and Radar's `basis` field: a row carries the term that
promoted it (`"You follow FISA"`, `"Starts tomorrow"`, `"You've liked finance
events"`), shown behind a long-press or a `…` entry. A ranking nobody can
interrogate is one people invent theories about, and those theories are always
worse than the truth.

And: **chronological must remain reachable.** A toggle, not a setting buried
three screens down. The ranked feed has to earn being the default.

## Order to build it

1. `topics` on `org_posts`, inherited from the org + a chip in the composer.
   *Nothing else works without this and it is useful on its own.*
2. `urgency_boost` + `diversity_penalty` in a `post_feed_ranked()`. Both are
   pure functions of data we already hold — **no new tables, no tracking** —
   and between them they fix the two named complaints.
3. `user_topic_affinity` + the nightly job.
4. The "why am I seeing this" line.
5. The chronological toggle, before ranking becomes the default.

Steps 1–2 are a day of work and are most of the benefit. Step 3 is where this
becomes a system that needs watching.
