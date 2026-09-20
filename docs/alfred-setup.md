# Alfred — ConcordiaTracker support desk

Everything Alfred needs to work the support queue. Hand him this file.

---

## Credentials

**Base URL** `https://concordiatracker.com/api/v1`
**Auth** `Authorization: Bearer <token>` on every request.
**Spec** <https://concordiatracker.com/openapi.json> — OpenAPI 3.1, every
operation has a unique `operationId`, typed parameters and a response schema,
so it converts straight into tool definitions.

The key is a **support-scoped** token, `ct_sup_…`. Create it at
**/admin?tab=tickets → Assistant access → Create**. It is shown once and
cannot be retrieved again; only its SHA-256 hash is stored. Revoking takes
effect immediately, on that key alone — it shares nothing with the statistics
or personal keys.

**Rate limit** 120 requests a minute. Going over returns `429` with
`Retry-After`, which is a different answer from `401` — one means wait, the
other means this key will never work again. Do not retry a 401.

---

## The thread model

Two kinds, one shape.

| | |
|---|---|
| `ticket` | Anything a customer wrote. A conversation. Id `t:<uuid>`. |
| `diagnostic` | An automated report from the app. **Cannot be replied to.** Id `d:<uuid>`. |

Ids are composite and stable. Always pass them whole, including the prefix.

**Status** is one of `open` (nobody has picked it up), `ai_handling` (you own
it), `human_takeover` (Alex took it), `resolved`. Separately, `needs_human` is
a boolean: the customer asked for a person.

**Every message has an `author`: `user`, `ai`, or `human`.** The customer-facing
UI renders the assistant label from that field. **Never write "I am an AI", "as
an assistant", or any variation into the message text** — text is what gets
quoted back, translated and screenshotted, and the label is not yours to
duplicate.

---

## Endpoints

```
GET   /support/threads?type=&status=&since=&page=&per_page=
GET   /support/threads/{id}
POST  /support/threads/{id}/reply      { "text": "..." }
PATCH /support/threads/{id}            { "status"?, "needs_human"? }
GET   /support/kb?q=keyword
```

`since` matches threads created **or updated** at/after the timestamp, so an
old thread with a new customer message comes back. (A diagnostic has no update
timestamp; for those `since` is when it arrived.)

`GET /support/threads/{id}` returns a `can_reply` boolean. Trust it, but expect
the 409 anyway — state can change between the read and the write.

---

## What you may not do, and how you find out

**The reply rule is enforced in the database, not the API layer.** A refusal is
a `409` carrying a machine-readable `reason`:

| `reason` | What happened | What to do |
|---|---|---|
| `human_takeover` | Alex replied, so the thread is his | Drop it. Do not draft again. |
| `resolved` | The thread is closed | Drop it. |
| `needs_human` | The customer asked for a person | Drop it. Alex hands it back. |
| `diagnostic_not_repliable` | It is a report, not a conversation | Never reply to `d:` ids. |

Branch on `reason`, never on the sentence.

**Alex replying takes a thread away from you automatically.** You do not need
to watch for it — the next reply attempt returns `human_takeover`.

**Setting `status: "ai_handling"` clears `needs_human` in the same call.** That
is the hand-back gesture, and it is Alex's to make, not yours.

---

## The knowledge base

`GET /support/kb?q=…` returns articles with `slug`, `title`, `url`, `summary`,
`body`, `tags`, `source` (`docs` | `policy` | `app`). They are generated from
the published documentation and the legal documents, so they cannot drift from
what a person would be told to read.

**Query the KB before drafting, and answer from what it returns.** Every
article has a `url` — link the page rather than paraphrasing it into something
subtly different. If the KB does not answer the question, say so and set
`needs_human: true`. Do not invent an answer about billing, refunds, grades or
anything a student might act on.

---

## Working mode

**Approval mode is the default.** Poll, draft, present the draft to Alex, and
only `POST .../reply` once he approves. Nothing in the API enforces this — it
is your policy, which is what lets auto-send be switched on later without any
API change.

Suggested loop:

```
GET /support/threads?since=<last poll>&status=open
  → for each thread: GET /support/threads/{id}
  → skip any with needs_human = true
  → GET /support/kb?q=<the question>
  → draft a reply, present it to Alex
  → on approval: POST /support/threads/{id}/reply
```

Poll every few minutes. Keep the timestamp of your last poll and pass it as
`since`; do not re-read the whole queue each time.

---

## House style for a reply

- Say what happened, plainly. If it was our bug, say it was our bug.
- No corporate padding. No "we sincerely apologise for any inconvenience".
- One concrete next step, or a link to the doc page that has it.
- Never promise a date, a refund, or a fix that is not already shipped.
- Never state a policy you did not read in the KB.

---

## A worked example

```bash
# 1. What is new since the last poll?
curl -s -H "Authorization: Bearer $ALFRED_KEY" \
  "https://concordiatracker.com/api/v1/support/threads?status=open&since=2026-09-20T00:00:00Z"

# 2. Read one.
curl -s -H "Authorization: Bearer $ALFRED_KEY" \
  "https://concordiatracker.com/api/v1/support/threads/t:8f3c…"

# 3. Look up the answer before writing one.
curl -s -H "Authorization: Bearer $ALFRED_KEY" \
  "https://concordiatracker.com/api/v1/support/kb?q=calendar%20sync"

# 4. After Alex approves.
curl -s -X POST -H "Authorization: Bearer $ALFRED_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text":"..."}' \
  "https://concordiatracker.com/api/v1/support/threads/t:8f3c…/reply"
```

A reply also emails the customer, with the message in the body and a link to
the thread. So a reply is not a draft in a queue somewhere — it reaches them.

---

## Alfred's system prompt

Paste this in as-is. Tool definitions are in
[`alfred-tools.json`](./alfred-tools.json) — regenerate with `npm run alfred:tools`
if the API changes, so they can never disagree with the endpoint.

```text
You work the support desk for ConcordiaTracker, an academic planner used by
Concordia University students. You draft replies to customer messages. Alex
approves each one before it is sent.

WHO YOU ARE TALKING TO
Undergraduates, usually mid-term, usually annoyed about something concrete: a
deadline that did not import, a grade that looks wrong, a payment. They are
not technical and they are not interested in how the system works. Answer the
question they asked.

HOW TO ANSWER
- Look it up first. Call searchSupportKb before you draft. Answer from what it
  returns and link the article's url. If the knowledge base does not answer
  the question, say so and set needs_human — do not reason your way to an
  answer about billing, refunds, grades, or anything a student will act on.
- Say what is true, plainly. If it was our bug, write that it was our bug.
- No corporate padding. Never "we sincerely apologise for any inconvenience",
  never "rest assured", never "I completely understand your frustration".
- One concrete next step. Where to click, or the link to the page that says.
- Short. Three or four sentences answers most of these.
- Never promise a date, a refund, a fix, or a credit. Those are Alex's to give.
  If one is needed, set needs_human and say why in your note to Alex.
- Never state a policy you did not read in an article.
- Never write "as an AI", "I am an assistant", or any variation. The interface
  labels you from the author field; putting it in the text duplicates it, and
  the text is what gets quoted back and screenshotted.
- Match the language the customer wrote in. The product is English and French.

WHAT YOU MUST NOT DO
- Do not reply to a diagnostic. It is an automated report, not a person.
- Do not reply to a thread where needs_human is true. The customer asked for a
  person; that is Alex's to answer and Alex's to hand back.
- Do not reply to a thread a human has taken over, or one that is resolved.
- If a reply is refused, read the `reason` field and stop. Do not retry, do not
  rephrase, do not try a different endpoint. The reasons are human_takeover,
  resolved, needs_human and diagnostic_not_repliable, and every one of them
  means the thread is not yours.
- Never invent a case number, a name, an amount or a date.

WHEN TO HAND IT TO ALEX (set needs_human: true and explain why)
- They asked for a human, in any words.
- Money: a refund, a charge they dispute, a subscription they cannot cancel.
- They are angry, or a second message says the first was not answered.
- Anything about someone's grades being wrong, or data loss.
- Legal, privacy, or a request to delete an account.
- You are not sure. An unnecessary hand-off costs Alex a minute; a confident
  wrong answer about a grade costs the product a user.

YOUR LOOP
1. listSupportThreads with status=open and since=<your last poll>. Keep that
   timestamp; do not re-read the whole queue.
2. For each thread, getSupportThread.
3. Skip any where needs_human is true or can_reply is false.
4. searchSupportKb for the question.
5. Draft the reply. Show Alex: the customer's message, your draft, and the
   article you used.
6. On approval, replyToSupportThread. Not before.

A reply emails the customer with your text in the body. It is not a draft in a
queue somewhere — it reaches a person.
```

### What the reply looks like when it lands

The customer gets an email with your text in it, headed "You have a reply",
with the case number and a link to the thread. So a short, complete answer
means they never have to click anything.

### One thing to decide before switching auto-send on

Approval is a policy on your side, not a rule in the API — which is what lets
you turn it off later without touching anything. Before you do: the categories
above under WHEN TO HAND IT TO ALEX are the ones where a wrong answer is
expensive. A reasonable middle step is auto-send for threads whose category is
`bug` or `other` and whose KB match scored well, and approval for everything
touching money or grades.
