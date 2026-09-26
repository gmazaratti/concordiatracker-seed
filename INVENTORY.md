# ConcordiaTracker data inventory

Audit date: 2026-09-26. Read-only audit of production (`qagtygymiivnyfwrtmzl`), the codebase at
`2265ef4`, and the privacy policy served at `/privacy` (`src/features/legal/legal-content.ts`,
dated September 26, 2026).

How this was gathered (so it can be re-run):

- **Database:** `information_schema.columns` for every public base table (76 tables), every `inet`
  column in every schema, foreign keys to `auth.users` with their delete rule, `pg_policies`, and
  `cron.job`, all queried live. Nothing was read from `db/` without checking the live schema too.
- **Browser storage:** every `localStorage` / `sessionStorage` / `document.cookie` call in `src/`
  and `index.html`.
- **Third parties:** every outbound host in `api/` and `src/`, plus the live responses from
  `/_vercel/insights/script.js` and `/_vercel/speed-insights/script.js` (both 200).
- **Logs:** every `console.*` call in `api/`.

"Disclosed" means the privacy policy says it plainly: **Y** = yes, **P** = partly or inaccurately,
**N** = not at all. "Admins" means accounts in `public.admins` (currently the founder, the
`concordiatracker@gmail.com` account, `alfred.qa@…`, and the `alfred@…` agent account). The
service role (server functions, cron jobs, the SQL editor) can read every table and is not
repeated in each row.

Retention "account lifetime" assumes deletion by an admin deleting the `auth.users` row (see
Mismatch 1: the in-app delete button does not delete anything). "Cascade" means the row is
removed with the account. "Survives (SET NULL)" means the row stays with its `user_id` cleared.

---

## 1. Identity and account

| Data | Stored where | Visible to | Retention | Disclosed |
|---|---|---|---|---|
| Email, auth provider, provider identities (Google `sub`, Apple `sub`), sign-in timestamps, OAuth profile metadata (name, avatar URL) | `auth.users`, `auth.identities` (Supabase-managed, in our database) | The user (own session); admins via admin console user list | Account lifetime, cascade | P (says "via Google OAuth"; Apple and email/password are not mentioned) |
| Password hash (email sign-ups) | `auth.users.encrypted_password` | Nobody in the app; service role only | Account lifetime | N |
| Name, email copy, handle, bio, links, avatar URL, program, school, major, minor, year of study, role, `at_concordia` | `public.user_profile` | The user; other users per `profile_public` / `program_public` / `courses_public`; admins (all fields) | Account lifetime, cascade | P (only "email, display name, profile picture" listed) |
| Plan and billing state: `plan_status`, `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `subscription_price_id`, `current_period_end`, `cancel_at_period_end`, `trial_end`, `subscription_amount_cents`, `pro_until`, `comped`, `team_pro`, `pro_gift_*` | `public.user_profile` | The user (own plan); admins | Account lifetime | P (policy says only that card numbers are not stored) |
| Attribution: `referral_source`, `referred_by_code`, `signup_ref`, `ui_state.heardFrom`, `ui_state.heardFromDetail`, `ui_state.heardFromReferrer` (another user's handle) | `public.user_profile` | Admins (Attribution tab drill-down shows face, name, handle, email, answer) | Account lifetime | N |
| Admin-only notes and flags: `admin_notes`, `is_internal`, `can_upload_blueprints`, `vanity_code` | `public.user_profile` | Admins | Account lifetime | N |
| UI state: widget layout, tips seen, tour and survey prompts, `visitDays`, chat themes, course order | `public.user_profile.ui_state` (jsonb) | The user; admins can read the row | Account lifetime | P ("interface preferences" is described as browser-only) |
| Privacy settings: `profile_public`, `dm_policy`, `schedule_visibility`, `allow_org_dms`, `notify_org_posts` | `public.user_profile` | The user; admins | Account lifetime | N |
| Staff and agent flags | `public.admins`, `public.agent_accounts`, `public.assistant_grant` | Admins | Until removed | N/A (staff only) |
| API tokens (hash only, prefix, scope, usage counts, last used) | `public.api_tokens` | Token owner; admins | Until revoked; cascade | N |

## 2. Academic data

| Data | Stored where | Visible to | Retention | Disclosed |
|---|---|---|---|---|
| Courses: code, name, term, section, credits, professor, professor email, TA name and email, office hours, room, meeting times, syllabus URL, final percent and letter, enrollment state, quick links | `public.courses` | The user; admins (`admin_user_courses`, also on the admin API scope) | Account lifetime, cascade | Y (course names), P (professor/TA contact details not mentioned) |
| Assessments: title, due date, weight, grade (percent or raw), status, notes, description, provenance, blueprint source | `public.assignments` | The user; admins | Account lifetime, cascade; soft-deleted rows kept (`deleted`, `deleted_at`) | Y |
| Personal tasks: title, due, note, checklist steps, repeat group; Moodle-synced items | `public.todos` | The user | Account lifetime, cascade | N (see §7) |
| Saved and planned courses, saved schedules (with share token), seat watches | `saved_courses`, `saved_schedules`, `seat_watches` | The user; a schedule share link exposes that schedule to anyone holding it | Account lifetime, cascade | N |
| Degree programme choice | `user_profile.program_id`, `major_id` | The user; public profile if `program_public` | Account lifetime | P |
| Reminders scheduled for deadlines (title, body, URL, fire time) | `public.reminders` | The user | Account lifetime, cascade; sent rows not pruned | N |
| Shared outlines ("blueprints") the user published: course, professor, professor email, office hours, room, items | `public.shared_blueprints` | Everyone (that is the feature) | **Survives account deletion (SET NULL)** | N |
| Blueprint votes | `public.blueprint_votes` | Aggregated publicly | Cascade | N |
| Course reviews (imported from concordia.courses, 166 rows) | `public.course_reviews` | Everyone (aggregated) | Survives (SET NULL) | N |

## 3. Syllabus uploads and parsing

| Data | Stored where | Visible to | Retention | Disclosed |
|---|---|---|---|---|
| The uploaded PDF | Storage bucket `parse-failures` (private), path `<user>/<event>.pdf` | The uploader (own folder policy, not exposed in UI); admins; the assistant account only while the upload is a failed one waiting for review (`ct_assistant_may_read_upload`) | 30 days, deleted by `cleanupFailedParses` on the daily Moodle cron (verified live 2026-09-26) | Y |
| Parse record: file name, byte size, SHA-256 of the file, read path, item count, course code, duration, success/failure, error reason, retry result (extracted items), review status, resolution note, delivery record | `public.parse_events` | The user (own rows via `my_parse_retry`); admins (Parses tab); assistant (review queue) | **Indefinite** (not pruned); cascade on account deletion | Y ("file name, date, whether it could be read"); P (hash, error text and extracted retry result not mentioned) |
| Syllabus text or PDF sent for extraction | Google Generative Language API (Gemini), per request | Google | Per Google's API terms (not controlled by us) | **N** |

## 4. Social: profiles, follows, messages

| Data | Stored where | Visible to | Retention | Disclosed |
|---|---|---|---|---|
| Follows (person to person) | `public.user_follows` | Both parties; follower/following lists are readable by anyone including signed-out visitors (`profile_follow_list` granted to anon) | Cascade | N |
| Club follows | `public.org_follows` | The user; clubs see a count only | Cascade | N |
| Legacy friendships | `public.friendships` | Both parties | Cascade | N |
| Blocks | `public.profile_blocks` | The blocker; admins (Social graph tab) | Cascade | N |
| Direct messages person to person: body, attachment (jsonb snapshot of a schedule, record, class, event), reply target, sent and read times | `public.messages` | Sender and recipient only (RLS `messages_select_own`). No admin read path in the app; the service role can read them | Cascade (either party deleting the account deletes the thread rows they are an end of) | N |
| Messages to or from a club | `public.messages` with `sender_org` / `recipient_org` | The student, every active member of that club, **and every admin** (`ct_is_org_member` returns true for `is_admin()`) | Cascade on the student's deletion | N |
| Reactions, per-chat read-receipt preference | `message_reactions`, `dm_prefs` | Thread participants | Cascade | N |
| Reported messages: the reported message's full text is copied into a support ticket | `public.tickets` + `ticket_messages` | Admins; support API token | Survives account deletion (SET NULL) | N |
| Short "notes" (status line) | `public.user_notes` | Followers per feature rules | `expires_at` | N |
| Notifications: title, body text, link, actor name, read time | `public.notifications` | The user | Cascade; not pruned | P (policy mentions "notifications" only under deletion) |
| Push subscriptions: endpoint, encryption keys, **user agent** | `public.push_subscriptions` | Service role | Cascade | N |

## 5. Clubs, posts and the organizer portal

| Data | Stored where | Visible to | Retention | Disclosed |
|---|---|---|---|---|
| Clubs: name, handle, bio, links, logo, banner, contact email, venue, application answers | `public.organizations` | Public when approved; admins always | Until deleted by an admin; **survives the owner's account deletion (SET NULL)** | N |
| Membership: name, **email**, role, title, permissions, invite token | `public.org_members` | Club team; admins | Cascade on the member's account (user_id column), survives via `invited_user` SET NULL | N |
| Club invites: recipient email, token, use counts, last opener's email, claim details | `public.org_invites` | Admins; the club | Survives (SET NULL) | N |
| Invite trail: open/claim/join events with account id, **email**, and a browser visitor id | `public.org_invite_events` | Admins | Survives (SET NULL) | N |
| Club audit log: actor name, **actor email**, before/after snapshots | `public.org_activity` | Club members with `view_activity`; admins | Indefinite | N |
| Posts, comments, likes, comment likes, reposts, saves, story views (with liked flag), event reminders | `org_posts`, `post_comments`, `post_likes`, `post_comment_likes`, `reposts`, `saves`, `story_views`, `event_reminders` | Posts/comments public; likes as counts; story views as a count to the club | Cascade for the user's rows; posts authored for a club survive (SET NULL) | N |
| Teacher portal: account, courses, outlines, TAs (email) | `teacher_accounts`, `teacher_courses`, `teacher_course_tas` | Teacher; admins | Cascade (TAs survive SET NULL) | Educator Agreement only |

## 6. Support, feedback and surveys

| Data | Stored where | Visible to | Retention | Disclosed |
|---|---|---|---|---|
| Support tickets: email, name, subject, category, status, lookup token, `context` = `{page}` for signed-in, `{page, ua}` (**user agent**) for signed-out docs submissions | `public.tickets` | The user; admins; support API token (the assistant) | **Survives account deletion (SET NULL)**, email and name stay | N |
| Ticket message bodies (both sides) | `public.ticket_messages` | Same | Survives (SET NULL) | N |
| Diagnostic bug reports: **user email**, title, description, page | `public.bug_reports` | The user; admins; support API; public if `public = true` | Survives (SET NULL) | N |
| Data reports (course data corrections) | `public.data_reports` | The user; admins | Survives (SET NULL) | N |
| Feature requests, comments, votes, reactions (with author name, avatar, handle) | `feature_request*` | Public | Cascade | N |
| In-app survey answers | `public.survey_response` | Admins | Cascade | N |
| Public survey: ratings, answers, **email**, reward code, uploaded outline files | `public.public_survey` + bucket `survey-outlines` (private) | Admins | Survives (SET NULL); files not pruned | N |
| Programme suggestions | `public.program_suggestions` | Admins | Cascade | N |
| Access requests (teacher/organizer): name, email, message | `public.access_requests` | Admins | Survives (SET NULL) | N |
| Messages from an admin to a user, and the user's reply | `public.admin_messages` | The user; admins | Cascade | N |

## 7. Integrations

| Data | Stored where | Visible to | Retention | Disclosed |
|---|---|---|---|---|
| Moodle calendar link (a capability URL with `userid` and `authtoken`) | `public.moodle_connections.ics_url`, column-grant hidden, even from its owner | Service role only | Until disconnected; cascade | **N** |
| Moodle sync state: status, last sync, last error, event count | `public.moodle_connections` | The user; admins (`admin_user_extras`) | Cascade | N |
| Moodle events: title verbatim, due date, `note` (course category + description text, HTML stripped), iCal UID (`external_id`), `moved_from` | `public.todos` where `source = 'moodle'` | The user | Cascade; never deleted by sync | N |
| Calendar feed: capability token, layers, fetch count, **last fetcher's user agent** | `public.calendar_feeds` | The user | Until rotated/disabled; cascade | N |
| Weather widget | Browser request to `api.open-meteo.com` with the fixed SGW campus coordinates | Open-Meteo sees the visitor's IP | Per Open-Meteo | N (no personal data sent, but the request exposes the IP) |

## 8. Devices, sessions and IP addresses

| Data | Stored where | Visible to | Retention | Disclosed |
|---|---|---|---|---|
| Live sessions: **IP**, **user agent**, created/refreshed times | `auth.sessions` (Supabase-managed, in our database) | The user (Settings → Devices); **admins** (`admin_user_extras.sessions`, shows IP) | Until sign-out | P ("hosting and database providers process your IP") |
| Device history: session id, **user agent**, **raw IP (`inet`)**, first/last seen, ended at. 21 rows, 21 with an IP | `public.user_device_history`, copied from `auth.sessions` by `ct_snapshot_devices()` | The user; **admins** (`admin_user_extras.past_devices`, shows IP) | 90 days (pruned inside `ct_snapshot_devices`, only when that function runs) | **N, and contradicted**: the policy says "We do not store your IP address ourselves" |
| Auth audit log | `auth.audit_log_entries` (has `ip_address`) | Service role | Currently 0 rows | N/A |

## 9. First-party analytics (`site_events`)

15,504 rows since 2026-07-27. Kinds recorded: `view`, `ping`.

| Data | Stored where | Visible to | Retention | Disclosed |
|---|---|---|---|---|
| `visitor_id` (random, per browser), `session_id` (random, per tab) | `public.site_events` | Admins (Traffic, Online now) | See below | Y |
| `user_id` when signed in | `public.site_events` | Admins, incl. per-user visit history (`admin_user_visits`, also on the admin API scope) | See below | P (disclosed, but the same section calls the data "anonymous") |
| Route shape (tokens, uuids and ids replaced by `:token` / `:id` in the browser before sending) | `public.site_events.path` | Admins | See below | Y |
| Referrer host only, UTM source/medium/campaign (40 chars each), `device` = mobile/desktop from viewport width, `ref` slug from the `ct_ref` cookie | `public.site_events` | Admins | See below | P (`device` and `ref` not listed) |
| Retention | `prune_site_events()` exists (pings 7 days, views 180 days) but **no cron job calls it** (live `cron.job` has 4 jobs, none of them this) | | **Indefinite in practice** | **P, contradicted**: policy promises 7 / 180 days |

No IP, no user agent and no geography is written to `site_events`. The insert policy is `true`
for anyone, which is how anonymous visitors are counted.

## 10. Browser storage and cookies

| Key | Type | Holds | Expiry | Disclosed |
|---|---|---|---|---|
| `sb-…-auth-token` (Supabase default key) | localStorage | Access token, refresh token, user object | Until sign-out | **P, contradicted**: policy says sessions use cookies and tokens are "never exposed to client-side JavaScript" |
| `ct_ref` | **Cookie**, 30 days, `SameSite=Lax` | Source slug (e.g. `reddit`), set by `/r` | 30 days | **N**: policy says cookies are for session management only |
| `ct_ref` | localStorage | A referrer's vanity code from `?ref=` | Until cleared | N |
| `__stripe_mid` / `__stripe_sid` | **Cookies set by Stripe.js** (loaded by `EmbeddedCheckoutPanel` via `@stripe/stripe-js`) | Stripe's fraud-detection device ids | about 1 year / 30 minutes | **N** |
| `ct_vid` / `ct_sid` | localStorage / sessionStorage | Analytics visitor and session ids | Until cleared / tab close | Y |
| `ct_utm`, `ct_last_view` | sessionStorage | Campaign tags, last view dedupe | Tab close | Y |
| `ct_theme`, `ct_theme_custom`, `ct_theme_vars`, `ct_theme_held`, `ct_lang`, `ct_reduce_motion`, `ct_sidebar_collapsed`, `ct_today_prefs`, `ct_calendar_prefs`, `ct_courses_view`, `ct_community_view`, `ct_money_profile` (fee status, faculty) | localStorage | Preferences | Until cleared | Y ("interface preferences") |
| `ct_community_recents` (recent searches), `ct_seen_feed` (post ids seen), `ct_muted_orgs`, `ct_activity_dismissed`, `ct_message_alerts`, `ct_notif_toast_seen`, `ct_prompts_*`, `ct_install_dismissed`, `ct_moodle_nudge_dismissed`, `ct_demo_gpa`, `ct_admin_last_seen_stats`, `ct_survey_claim` | localStorage / sessionStorage | Per-device conveniences | Until cleared | P |
| `ct_auth_return`, `ct_oauth_attempt`, `ct_portal_session`, `ct_signup_attempts` (email addresses tried, for throttling), `ct_stale_chunk_reload` | localStorage / sessionStorage | Auth flow state | Short TTLs (15 min to 30 min) or tab close | N |

## 11. Third parties

| Party | Receives | Returns / stores | Disclosed |
|---|---|---|---|
| Supabase (database, auth, storage) | Everything above; request logs keep IP, user agent, path and query | Auth sessions with IP and UA | Y |
| Vercel (hosting) | Every request: IP, UA, URL. `/api/calendar/<token>.ics` puts the feed's capability token in request logs | Runtime logs (plan retention) | Y |
| **Vercel Web Analytics + Speed Insights** (`@vercel/analytics`, `@vercel/speed-insights`, mounted in `App.tsx`, both scripts live) | Page URLs **without redaction** (no `beforeSend`), so invite tokens in `/join/<token>` and query strings such as `?chat=`, `?event=`, `?retry=` are sent; referrer; device/browser/OS; web vitals | Vercel derives **country/region from the IP** | **P, contradicted**: policy says no third-party analytics provider and no tracking script |
| Stripe | Email, customer id, subscription; card data entered on Stripe Checkout; Stripe.js (js.stripe.com) receives the visitor's IP and device signals and sets its own cookies | Customer, subscription, invoice status (stored in `user_profile`), webhook ids (`stripe_events`) | Y |
| Resend | Recipient email, subject, HTML body (renewal notice, support replies, club invites) | Delivery status (not stored today). Open/click tracking is a Resend domain setting; **could not be verified** (API key is send-only) | Y |
| Google OAuth / Apple Sign In | Sign-in request | Email, name (Apple: first sign-in only), Google avatar URL | P (Apple missing) |
| **Google Gemini** | Syllabus text or PDF | Extracted items | **N** |
| Moodle (`moodle.concordia.ca`) | Our server fetches the user's calendar link daily | Calendar events | **N** |
| Concordia Open Data, eConcordia | Course codes only, no user data | Catalogue, sections, outlines | N/A |
| Web push services (Google FCM, Apple, Mozilla) | Encrypted notification payloads to the subscription endpoint | Nothing | N |
| Google Fonts, `i.ibb.co` (5 club logos/banners), `lh3.googleusercontent.com` (Google avatars), Instagram CDN (one image), Open-Meteo | The visitor's IP and user agent, from the browser | Nothing stored by us | N |

## 12. Logs

| Log | Contents | Retention |
|---|---|---|
| Our `console.*` in `api/` (6 calls) | Stripe renewal-notice failure; Resend rejection body (can echo the recipient address); Moodle save failure body (first 300 chars of a PostgREST error, can include event titles); Gemini error body (first 400 chars) | Vercel runtime log retention |
| Vercel request logs | IP, UA, method, full URL (incl. the calendar token path) | Vercel plan retention |
| Supabase API and auth logs | IP, UA, path, query, auth events | Supabase plan retention |
| No passwords, codes or file contents are logged by our code. Parse errors store a short reason, not document text. | | |

## 13. Admin panel (every user attribute an admin can see)

User list and overview: name, email, handle, avatar, program, school, plan and full billing
state, Stripe customer lookup by email, attribution (heard-from answer, referrer, source code),
signup and onboarding dates, admin notes, flags, courses with grades (`admin_user_courses`),
per-user visit history (`admin_user_visits`), audit trail, live sessions and past devices **with
IP and user agent**, Moodle status and last error, Pro sources, support tickets and bug reports,
survey answers, parse history with file download, social graph (follows, blocks), club
messages, club invites with opener emails, and the admin message thread.

## 14. Assistant and API (per user)

| Scope | Can read about a user |
|---|---|
| `me` (personal token) | Only the token owner's own courses, assignments, GPA, notes |
| `owner` | Aggregate counts only, never an identity |
| `support` | Tickets (email, name, bodies, context) and bug reports (email, body) for every user |
| `admin` / `assistant` (the `alfred@` account) | The named allowlist of admin RPCs, including `admin_list_users`, `admin_user_summary`, `admin_user_courses` (grades), `admin_user_visits`, `admin_audit_for_user`, `admin_tickets`, `admin_list_survey_responses`, `admin_public_survey`, `admin_social_graph`, `admin_messages_for`. Club DMs through admin membership. The review queue and a failed upload's file while it waits for review. **Not** `admin_user_extras` (so not IPs). |

---

## Answers to the eight questions

**1. Are IP addresses stored anywhere we control?** Yes. `public.user_device_history.ip`
(`inet`, raw, 21 rows, copied from `auth.sessions.ip` by `ct_snapshot_devices()`, kept 90 days),
shown to the user in Settings → Devices and to admins in `admin_user_extras`. `auth.sessions.ip`
is Supabase-managed but lives in our database and is also shown to admins. `auth.audit_log_entries`
and `auth.mfa_challenges` have IP columns (0 rows in the audit log). `site_events` stores no IP.

**2. Is geographic data derived or stored?** Not by us: no country, city or region column exists
anywhere in the schema. Vercel Web Analytics derives country/region from the IP on Vercel's side.
The weather widget uses a fixed campus coordinate, not the user's location.

**3. Is there a per-user connected-devices list?** Yes. Live devices are `auth.sessions` rows;
past devices are `public.user_device_history`. A device is identified by the Supabase session id
and described by its user-agent string and IP. There is no fingerprinting.

**4. What message data exists, and who can read it?** `public.messages` (body, attachment
snapshot, reply target, sent/read times, request flag, org ends), plus `message_reactions` and
`dm_prefs`. Person-to-person messages: sender and recipient only through RLS; the service role
and the SQL editor can read them. Messages to or from a club: the student, every active member
of that club, and every admin (including the `alfred@` agent account through its admin row).
A reported message's text is copied into a support ticket that admins and the support token can
read.

**5. Is Vercel Web Analytics enabled?** Yes. `<Analytics />` and `<SpeedInsights />` are mounted
in production (`src/App.tsx`), and both scripts answer 200 on concordiatracker.com. They record
page views with the full URL (no `beforeSend` redaction), referrer, browser, OS, device type,
country/region derived from IP, and Core Web Vitals.

**6. Is Resend open/click tracking enabled?** Could not be verified from here. It is a per-domain
setting in the Resend dashboard, and the project's API key is restricted to sending
(`GET /domains` answered 401 "restricted to only send emails"). Our code adds no tracking
pixels or rewritten links itself. **Alex: check Resend → Domains → concordiatracker.com →
Tracking.**

**7. What Moodle data is pulled and stored?** The calendar link itself (hidden from every API
reader, including its owner), connection status, last sync time, last error text and event
count; and for each event a `todos` row with the verbatim title, due date, a note made of the
course category and the description text, the iCal UID, and the previous date when Moodle moved
it. Nothing is deleted when an event disappears from Moodle.

**8. What do support tickets and diagnostics store?** Tickets: email, name, subject, category,
status, source, a lookup token, and `context` (the page; plus the user agent for signed-out
submissions from the docs). Every message body on both sides is in `ticket_messages`. No
attachments are supported. Bug reports store the user's email, title, description and page.
Readable by the user (own), admins, and the support API token. Both survive account deletion.

---

## Mismatches (collected but not disclosed, or disclosed inaccurately)

1. **The in-app "Delete account" button is a mock** (`AccountSection.tsx`: "Account deletion is
   mocked in this seed"). The policy promises it "immediately and permanently removes" all data.
2. **Deletion does not remove everything.** Rows that survive with `user_id` cleared: tickets
   (email, name), ticket messages, bug reports (email), public survey (email, outline files),
   access requests (email), org invite events (email), org invites (last opener email), club
   activity log (actor email), shared blueprints, course reviews, clubs they owned, posts they
   wrote for a club, data reports, `site_events` (visitor id). `admin_audit_log` keeps target
   emails with no foreign key at all. The policy says "all associated data".
3. **IP addresses are stored by us** in `user_device_history` (90 days) and shown to admins with
   `auth.sessions` IPs. The policy says "We do not store your IP address ourselves".
4. **User-agent strings are stored** in `user_device_history`, `auth.sessions` (admin-visible),
   `push_subscriptions`, `tickets.context.ua`, and `calendar_feeds.last_fetch_agent`. The
   analytics section says browser/device information is not collected.
5. **Vercel Web Analytics and Speed Insights run on the site.** The policy says "We do not use
   Google Analytics or any other third-party analytics provider, and no advertising or tracking
   script runs on this site". They also receive unredacted URLs, including single-use invite
   tokens, and derive country from IP.
6. **Google Gemini receives syllabus contents.** Not listed among third parties.
7. **Moodle** (calendar link, synced events and their descriptions) is not mentioned.
8. **Apple Sign In and email/password** accounts are not mentioned; identification is described
   as "via Google OAuth" only.
9. **Social and messaging data is not disclosed**: profiles (bio, links, handle), follows, blocks,
   direct messages, reactions, read receipts, notes, club membership, posts, comments, likes,
   reposts, story views, notifications, push subscriptions.
10. **Admins can read club DMs**, and reported messages are copied into tickets. The policy says
    "You can only read and modify your own data".
11. **Support, feedback and survey data** (tickets, bug reports, feature requests, surveys, the
    public survey's email and uploaded outline files, data reports, access requests) is not
    disclosed.
12. **Attribution data** (`signup_ref`, `referred_by_code`, "how did you hear about us" answers,
    the referrer's handle) is not disclosed.
13. **The `ct_ref` cookie is an attribution cookie**, not an essential one. The policy says
    cookies are used "only for session management".
14. **Sessions are not cookies and are readable by JavaScript.** Supabase keeps the session in
    localStorage. The policy says tokens are "never exposed to client-side JavaScript".
15. **Analytics retention is not enforced.** `prune_site_events()` is never scheduled, so page
    views and pings are kept indefinitely against a promised 7 / 180 days.
16. **"Anonymous" analytics are linked to accounts** when signed in, and admins see a per-user
    visit history (also through the admin API scope). The policy discloses the association but
    labels the whole section anonymous.
17. **Browser requests to third parties** (Google Fonts, ImgBB, Google avatar host, Instagram CDN,
    Open-Meteo, web push services) expose the visitor's IP and are not disclosed.
18. **Admin-only notes, the audit log and per-user visit history** are not disclosed.
19. **Billing state from Stripe** (customer and subscription ids, status, amounts, dates) is stored
    in `user_profile` and not described.
20. **Calendar feed tokens appear in hosting request logs** (the token is in the URL path by
    design, since calendar apps cannot send headers).
21. **Parse records keep a file hash, error text and the extracted retry result indefinitely**;
    the policy mentions only file name, date and outcome.
22. **Public follower lists**: `profile_follow_list` is callable by signed-out visitors for any
    handle, including private profiles. Not disclosed (and possibly not intended).
23. **Resend tracking status is unknown** (see question 6). If open/click tracking is on, it is
    undisclosed.
24. **Stripe.js sets `__stripe_mid` and `__stripe_sid` cookies** on our domain for fraud detection
    (found while verifying Part 2). Not disclosed; the policy says cookies are session-only.

---

## Added after this audit (Part 2, 2026-09-26)

New collection introduced by `db/product_analytics.sql` (applied to production the same day).
**None of it is in the privacy policy yet**; see the note at the end.

| Data | Stored where | Visible to | Retention | Disclosed |
|---|---|---|---|---|
| First-touch attribution: UTM source/medium/campaign (40 chars each), referrer domain, landing route (ids and tokens stripped), channel, first-seen time | Browser `localStorage.ct_first_touch`; at signup copied to `user_profile.signup_*` and `first_seen_at` | Admins (Product tab, aggregated) | Account lifetime; deleted on opt-out | N |
| Product events: `signup_completed`, `first_course_added`, `first_assignment_completed`, `feature_used` (one per feature per day), `pro_cancel_scheduled`, `pro_cancelled`, `account_delete_requested`. Properties are a fixed allowlist of short values (channel, source, days since signup, feature, plan) | `public.analytics_events` (RLS on, no client read) | Admins, aggregated only, through admin-gated report functions | No expiry set; `user_id` cleared on account deletion; rows deleted on opt-out | N |
| Email engagement: Resend email id, template name, event (sent, delivered, opened, clicked, bounced, complained, failed), time, account id when not opted out. **No address, subject, link, IP or user agent** | `public.email_events` | Admins, aggregated | No expiry set | N |
| Churn answers: kind, reason from a fixed list, optional note (500 chars), plan | `public.churn_feedback` | Admins | No expiry set; `user_id` cleared on deletion; stored without an id for opted-out users | N |
| Analytics opt-out flag | `user_profile.analytics_opt_out` | The user; admins | Account lifetime | N |
| `ct_first_touch` | localStorage | First-touch record above | Until cleared | N |

Also added: the source links `/ig`, `/li` and `/qr` set the same `ct_ref` cookie as `/r`.
