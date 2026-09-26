/**
 * Permanently delete an account. Called by the account holder (Settings →
 * Account → Delete account, through /api/stripe-billing) and by an admin
 * acting on an emailed request (/api/admin?action=delete-user).
 *
 * ORDER MATTERS, and each step is safe to repeat if a later one fails:
 *   1. Billing first. A paying subscription is cancelled and the Stripe
 *      customer deleted BEFORE any data goes, because deleting the account and
 *      leaving the card to be charged is the one outcome worse than not
 *      deleting it. If Stripe refuses, nothing else happens.
 *   2. ct_delete_account() (db/account_deletion.sql) deletes the rows that would
 *      otherwise survive with an email, a name or someone's words in them, and
 *      lists the storage files to remove.
 *   3. Those files are deleted through the Storage API (deleting the storage row
 *      alone leaves the file in the bucket).
 *   4. The auth user is deleted, which cascades every table keyed to it.
 *
 * Stripe keeps its own payment records after the customer is deleted, as it is
 * required to; that is Stripe's retention, not ours, and the policy says so.
 */
import type Stripe from 'stripe'

export interface DeleteResult {
  ok: boolean
  error?: string
  deleted?: Record<string, number>
  filesRemoved?: number
  billing?: 'none' | 'cancelled'
}

interface Env {
  url: string
  service: string
  stripe: Stripe | null
}

export async function deleteAccount(userId: string, env: Env): Promise<DeleteResult> {
  const svc = { apikey: env.service, Authorization: `Bearer ${env.service}`, 'Content-Type': 'application/json' }

  // 1. Billing.
  let billing: DeleteResult['billing'] = 'none'
  const prof = await fetch(`${env.url}/rest/v1/user_profile?user_id=eq.${userId}&select=stripe_customer_id`, { headers: svc })
    .then((r) => r.json())
    .catch(() => null)
  const customer = Array.isArray(prof) ? (prof[0]?.stripe_customer_id as string | null) : null
  if (customer) {
    if (!env.stripe) return { ok: false, error: 'Billing is not configured, so the subscription could not be cancelled. Nothing was deleted.' }
    try {
      // Deleting a customer cancels every subscription it has, immediately.
      await env.stripe.customers.del(customer)
      billing = 'cancelled'
    } catch (e) {
      const code = (e as { code?: string }).code
      if (code !== 'resource_missing') {
        return { ok: false, error: 'The subscription could not be cancelled, so nothing was deleted. Try again, or email concordiatracker@gmail.com.' }
      }
    }
  }

  // 2. Rows.
  const rpc = await fetch(`${env.url}/rest/v1/rpc/ct_delete_account`, {
    method: 'POST',
    headers: svc,
    body: JSON.stringify({ p_user: userId }),
  })
  if (!rpc.ok) return { ok: false, error: `Deletion stopped: ${(await rpc.text()).slice(0, 200)}` }
  const plan = (await rpc.json()) as {
    deleted: Record<string, number>
    files: { bucket: string; name: string }[]
    survey_files: unknown[]
  }

  // 3. Files.
  const byBucket = new Map<string, string[]>()
  for (const f of plan.files ?? []) byBucket.set(f.bucket, [...(byBucket.get(f.bucket) ?? []), f.name])
  for (const f of plan.survey_files ?? []) {
    const path = typeof f === 'string' ? f : (f as { path?: string })?.path
    if (path) byBucket.set('survey-outlines', [...(byBucket.get('survey-outlines') ?? []), path])
  }
  let filesRemoved = 0
  for (const [bucket, prefixes] of byBucket) {
    const r = await fetch(`${env.url}/storage/v1/object/${bucket}`, {
      method: 'DELETE',
      headers: svc,
      body: JSON.stringify({ prefixes }),
    })
    if (!r.ok) return { ok: false, error: `Files in ${bucket} could not be removed; the account was not deleted. Try again.` }
    filesRemoved += prefixes.length
  }

  // 4. The account, and everything keyed to it.
  const del = await fetch(`${env.url}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: svc })
  if (!del.ok && del.status !== 404) return { ok: false, error: 'The account could not be removed. Try again.' }

  return { ok: true, deleted: plan.deleted, filesRemoved, billing }
}
