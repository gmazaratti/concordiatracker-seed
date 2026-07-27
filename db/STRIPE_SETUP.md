# Stripe setup (test mode first)

Everything in the app is built. These are the account-side steps that need your
credentials — do them all in **TEST mode**; nothing here moves real money.

## 1. Run the migration

In the Supabase SQL editor, run **`db/stripe_billing.sql`**.

## 2. Create the test products + prices

Install the CLI (`https://docs.stripe.com/stripe-cli`), then:

```bash
stripe login
```

Create the two prices (test mode):

```bash
stripe products create --name="ConcordiaTracker Pro — Semester pass"
stripe products create --name="ConcordiaTracker Pro — Monthly"
```

Then a recurring price for each (swap in the `prod_…` ids the commands print):

```bash
stripe prices create --product=prod_SEMESTER --unit-amount=1500 --currency=cad \
  --recurring.interval=month --recurring.interval-count=4
stripe prices create --product=prod_MONTHLY --unit-amount=500 --currency=cad \
  --recurring.interval=month
```

> The semester pass is billed as a 4-month recurring price so it auto-renews per
> term. Change `interval-count` if you want a different term length.

## 3. Environment variables

**Local** (`.env.local`, gitignored) and **Vercel → Project → Settings → Environment Variables**:

| Variable | Where | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | server only | `sk_test_…` — never prefix with `VITE_` |
| `STRIPE_WEBHOOK_SECRET` | server only | from step 4 |
| `STRIPE_PRICE_SEMESTER` | server only | `price_…` from step 2 |
| `STRIPE_PRICE_MONTHLY` | server only | `price_…` from step 2 |
| `STRIPE_TRIAL_DAYS` | server only | e.g. `7`. Omit/`0` = no trial |
| `PUBLIC_SITE_URL` | server only | `https://concordiatracker.com` |
| `VITE_STRIPE_PUBLISHABLE_KEY` | client | `pk_test_…` — safe to expose |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | already set for reminders |

The trial **requires a card**: Checkout collects the payment method up front and
charges when the trial ends. If the card is missing at that point the
subscription cancels instead of silently granting free access.

## 4. The webhook

Local testing:

```bash
stripe listen --forward-to localhost:5173/api/stripe-webhook
```

That prints a `whsec_…` — put it in `STRIPE_TRIAL_DAYS`'s neighbour,
`STRIPE_WEBHOOK_SECRET`.

For production, add an endpoint in the Stripe dashboard pointing at
`https://concordiatracker.com/api/stripe-webhook` and subscribe to:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

Copy that endpoint's signing secret into `STRIPE_WEBHOOK_SECRET` on Vercel.

## 5. Test the loop

Test card: **4242 4242 4242 4242**, any future expiry, any CVC.

1. Settings → Billing → *Get the Semester pass* → the form appears **inline**
2. Pay → the webhook flips `plan_status` to `pro` → Pro unlocks
3. Invoices list fills in, with PDF links
4. *Cancel subscription* → shows "Cancels {date}", access continues
5. *Resume subscription* → back to active

Force a renewal without waiting:

```bash
stripe trigger invoice.paid
```

## Going live (your call — I don't touch live keys)

Repeat steps 2–4 with live-mode products/prices and a live webhook, then swap the
`sk_live_…` / `pk_live_…` / live `whsec_…` values in Vercel. Nothing in the code
changes.

## How entitlement works

`plan_status` is written **only** by the webhook, after verifying Stripe's
signature — the client can never grant itself Pro. It's kept separate from
`pro_until` (survey rewards, gifted Pro), so cancelling a subscription can't
revoke a gift that hasn't expired, and vice versa.
