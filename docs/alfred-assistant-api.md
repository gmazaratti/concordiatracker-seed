# Alfred assistant API (`ct_ast_` keys)

The endpoints Alfred's assistant key can call, with the request each one takes
and the response it returns. Machine-readable version: `/openapi.json`
(tag *Organizations API*). Companion brief: `docs/alfred-setup.md`.

## Authentication

```
Authorization: Bearer ct_ast_…
```

- One key type, scope `assistant`, label **alfred-assistant**. Created,
  **rotated** and revoked in **Admin → Assistant**. Only a hash is stored; the
  key is shown once.
- The key acts as the assistant account. Its reach on clubs is decided **per
  request by the database** (`ct_is_assistant()`, db/assistant_grant.sql),
  never by membership rows. A club created tomorrow is covered the moment it
  exists, and the assistant appears in **no member list**.
- Every write is recorded in Admin → Assistant → activity, attributed to
  "Assistant".
- Base URL: `https://concordiatracker.com/api/v1`. `{handle}` is the club
  handle with or without the `@`.
- Errors: JSON `{ error, code, message, hint?, status, docs }`. A 401 is a bad
  or revoked key; a 403 names what the key is not allowed to do; 409 means the
  club is not approved yet.

### What the key covers today

| Area | Read | Write |
| --- | --- | --- |
| Organisation profile | yes | name, bio, colour, glyph, email, links, venue, translations, logo, banner |
| Stories | yes | create, delete |
| Feed posts | yes | create, edit caption/details, delete |
| Events | yes | create, edit, delete |
| Members | list | — |
| Team invites | list | create, revoke |
| Stats | yes | — |

**Not covered (held back on purpose, decision pending):** changing a club's
handle, roles, removing teammates, ownership, handoff links (`kind: "org"`
invites, which carry a use count and an expiry and transfer the club), and
creating clubs. A call to any of these returns 403 with the reason. Stories are
images only; video is supported on feed posts' storage but not on stories.

---

## Organisations

### `GET /orgs`
List every organisation. Query: `q` (search name/handle, optional).
Response `200`: `{ organizations: Org[], count }`.

### `GET /orgs/{handle}`
Response `200`: `{ organization: Org }`. `404` if no such handle.

`Org` = `{ id, name, handle, bio, color, glyph, logo, banner, email, links,
venue, translations, status, verified, created_at }`.

### `PATCH /orgs/{handle}`
Body (any subset):
```json
{ "name": "…", "bio": "…", "color": "#3b82f6", "glyph": "AB", "email": "…",
  "links": { "website": "https://…", "instagram": "…", "x": "…", "linkedin": "…" },
  "venue": { "address": "…", "phone": "…", "hours": "…" },
  "translations": { "fr": { "bio": "…" } }, "logo": "https://…", "banner": "https://…" }
```
Response `200`: `{ organization: Org }`. Unknown fields are ignored; nothing
recognised → `400`.

### `POST /orgs/{handle}/logo` · `POST /orgs/{handle}/banner`
Body: the raw image bytes (`Content-Type: image/jpeg | image/png | image/webp`),
or JSON `{ "data": "<base64>" }`. Max 4 MB. The format is read from the bytes,
not the header. Response `200`: `{ url, organization: Org }`.

### `POST /orgs/{handle}/media`
Upload an image for a story or post. Same body rules as logo.
Response `201`: `{ url }`. A file that is not a real JPEG/PNG/WebP → `400`/`415`.

## Stories

### `GET /orgs/{handle}/stories`
Live stories. Response `200`: `{ handle, stories: [{ id, image_url, caption, place, link_url, overlays, created_at, expires_at }], note }`.

### `POST /orgs/{handle}/stories`
Body:
```json
{ "image_url": "<url from /media>", "caption": "…", "place": "…",
  "link_url": "https://…", "mentions": ["@handle"], "overlays": [] }
```
Response `201`: `{ story: { id, image_url, caption, created_at, expires_at } }`.
Stories expire after 24 hours.

### `DELETE /orgs/{handle}/stories/{id}`
Response `200`: `{ deleted: true, story_id }`. `404` if not that club's story.

## Feed posts

### `GET /orgs/{handle}/posts`
Response `200`: `{ handle, posts: [{ id, caption, media, created_at, edited_at }], count }`.

### `POST /orgs/{handle}/posts`
Body: `{ "caption": "…", "media": ["<url>", …] }`, 1 to 10 images, caption up to
2200 characters. Response `201`: `{ post: { id, caption, media, created_at } }`.

### `PATCH /orgs/{handle}/posts/{id}`
Body (any subset): `{ "caption", "place", "place_url", "audience": "everyone" |
"followers", "hide_likes", "hide_shares", "event_id" }`. Images cannot be
changed on a published post. Response `200`: `{ post }`.

### `DELETE /orgs/{handle}/posts/{id}`
Takes the post down (soft delete). Response `200`: `{ hidden: true, post_id }`.

## Events

### `GET /orgs/{handle}/events`
Query: `upcoming=true` (optional). Response `200`: `{ handle, events: Event[], count }`.

### `POST /orgs/{handle}/events`
Body:
```json
{ "title": "…", "start": "2026-10-15T18:00:00-04:00", "mode": "in-person" | "online",
  "location": "…", "category": "clubs" | "career" | "academic" | "official" | "nightlife",
  "description": "…", "image": "<url>" }
```
`title` and `start` (ISO-8601 with an offset) are required.
Response `201`: `{ event: Event }`.

### `PATCH /orgs/{handle}/events/{id}`
Body: any subset of the create fields. Response `200`: `{ event: Event }`.

### `DELETE /orgs/{handle}/events/{id}`
Response `200`: `{ deleted: true, event_id }`.

## Members and invites

### `GET /orgs/{handle}/team`
Response `200`: `{ handle, members: [{ id, name, email, role, status, permissions,
joined_at, created_at }], count }`. Pending invites appear here too, with `status: "invited"`. The assistant itself is never in this list.

### `GET /orgs/{handle}/invites`
Response `200`:
```json
{ "handle": "@…", "team_invites": [{ "id", "name", "email", "role", "status",
  "accepted", "joined_at", "created_at", "url" }],
  "claim_invites": [{ "id", "recipient_email", "max_uses", "use_count",
  "opened_count", "last_opened_at", "expires_at", "expired", "url" }] }
```

### `POST /orgs/{handle}/invites`
Team invite (covered): `{ "kind": "team", "email": "…", "name": "…", "role": "member" | "admin" }`.
Response `201`: `{ kind: "team", invite, url }`. The link is single-person.

Handoff link (not covered yet, see above): `{ "kind": "org", "email": "…",
"max_uses": 1, "expires_in_days": 14 }` → `403` for the assistant key.

### `DELETE /orgs/{handle}/invites/{id}`
Revokes a pending invite. Response `200`: `{ revoked: true, id }`. An invite
that was already accepted is a teammate → `409`.

## Stats

### `GET /orgs/{handle}/insights`
Response `200`:
```json
{ "handle": "@…",
  "stats": { "followers": 0, "new_followers_30d": 0, "posts": 0, "post_likes": 0,
             "post_comments": 0, "reposts": 0, "stories_live": 0, "story_views": 0,
             "events_total": 0, "events_upcoming": 0, "event_reminders": 0,
             "not_tracked": ["post_views", "event_rsvps"] },
  "daily_30d": [{ "day": "2026-10-01", "followers": 0, "new_followers": 0,
                  "posts": 0, "likes": 0, "comments": 0, "events": 0 }],
  "privacy": "Counts only…", "note": "…" }
```
Counts only: which students followed, liked, watched or set a reminder is never
returned. Post views and event RSVPs are not tracked by ConcordiaTracker, so
they are listed as `not_tracked` rather than reported as zero.
`event_reminders` counts students who tapped *Remind me* on an event.
