# Stripe setup

## Status: TEST mode is configured ✅

Products, prices, and the webhook endpoint already exist in **test mode**, and the
ids are in `.env.local`:

| Thing | Value |
|---|---|
| Semester pass | `$15.00 CAD` every 4 months (`ct_pro_semester`) |
| Monthly | `$5.00 CAD` every month (`ct_pro_monthly`) |
| Webhook | `https://concordiatracker.com/api/stripe-webhook` — 6 events |
| Free trial | 7 days, **card required** |

Verified against the Stripe API: both prices active, webhook enabled, and a real
embedded-checkout session builds with `amount_total: 0` (trial) and a client
secret.

---

## Remaining steps (you)

### 1. Run the migration

In the Supabase SQL editor, run **`db/stripe_billing.sql`**.

### 2. Copy the env vars into Vercel

**Vercel → Project → Settings → Environment Variables.** Values are in your local
`.env.local`:

| Variable | Notes |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` — **server only**, never prefix with `VITE_` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` |
| `STRIPE_PRICE_SEMESTER` | `price_1Txep0KBn5em0lgabtvnwVSP` |
| `STRIPE_PRICE_MONTHLY` | `price_1Txep0KBn5em0lgaWwVLZmch` |
| `STRIPE_TRIAL_DAYS` | `7` (omit or `0` to disable the trial) |
| `PUBLIC_SITE_URL` | `https://concordiatracker.com` |
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_test_…` — client, public by design |

`SUPABASE_SERVICE_ROLE_KEY` is already set from the reminders work.

Redeploy after adding them (Vite inlines `VITE_*` at build time).

### 3. Test the loop

Test card **4242 4242 4242 4242**, any future expiry, any CVC.

1. Settings → Billing → *Get the Semester pass* → the form appears **inline**
2. Pay → webhook flips `plan_status` to `pro` → Pro unlocks
3. Invoices fill in with PDF links
4. *Cancel* → "Cancels {date}", access continues to period end
5. *Resume* → back to active

**Local webhook testing** needs the Stripe CLI (the endpoint above points at
production):

```bash
stripe listen --forward-to localhost:5173/api/stripe-webhook
```

Use the `whsec_…` it prints as your **local** `STRIPE_WEBHOOK_SECRET`.

---

## Re-running / going live

`scripts/stripe-setup.mjs` is idempotent — it matches products by metadata and
prices by `lookup_key`, so re-running never creates duplicates.

> **Local only.** `scripts/` is gitignored (repo convention: go-live tooling
> stays off the public repo), so this file lives on your machine and won't be in
> a fresh clone. It contains no secrets — it reads them from `.env.local` — so
> drop the `scripts/` line from `.gitignore` if you'd rather keep it tracked.

```bash
node scripts/stripe-setup.mjs
```

**To go live** (your call — do this yourself, with your own keys):

1. Put your `sk_live_…` in `.env.local`
2. `node scripts/stripe-setup.mjs --live` — the `--live` flag is a deliberate
   guard so it can't happen by accident
3. Copy the new price ids + `whsec_…` into Vercel, along with `pk_live_…`

No application code changes between test and live — only keys.

---

## How entitlement works

`plan_status` is written **only** by the webhook, after verifying Stripe's
signature over the raw body. The client can never grant itself Pro — the billing
columns are revoked from `authenticated` at the database level.

It's kept separate from `pro_until` (survey rewards, gifted Pro), so cancelling a
subscription can't revoke a gift that hasn't expired, and vice versa.

Webhook deliveries are idempotent: each event id is claimed once in
`stripe_events`, so Stripe's retries can't double-apply a state change.
