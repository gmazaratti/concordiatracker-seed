/**
 * Reading an identity out of an OAuth provider's metadata.
 *
 * PURE — no Supabase import, no React — because the rules here are the kind
 * that need checking against a dozen odd shapes, and a module that reaches for
 * `import.meta.env` cannot be run in Node.
 */

/**
 * A display name from whatever the provider actually sent.
 *
 * APPLE ONLY SENDS A NAME ON THE VERY FIRST SIGN-IN, and never again — not on
 * a re-install, not after the account is deleted and remade. So every read
 * here has to survive its absence rather than assume the first one captured
 * it. Apple also splits it, hence `given_name`/`family_name`.
 *
 * THE LOCAL-PART FALLBACK IS SKIPPED FOR HIDE MY EMAIL. Deriving a name from
 * the address works for `alex.degryse@gmail.com` and produces
 * "k7m2xq9ptr" for `k7m2xq9ptr@privaterelay.appleid.com` — a random string
 * presented to someone as their own name. "Student" is the honest answer, and
 * the profile editor is one click away.
 */
export function displayNameFrom(
  meta: Record<string, unknown> | undefined,
  email: string | null | undefined,
): string {
  const full = (meta?.full_name as string) || (meta?.name as string)
  if (full?.trim()) return full.trim()
  // Apple's shape when it does send one.
  const parts = [meta?.given_name, meta?.family_name].filter(
    (x): x is string => typeof x === 'string' && x.trim() !== '',
  )
  if (parts.length) return parts.join(' ').trim()
  const local = email?.split('@')[0]
  if (local && !isRelayEmail(email)) return local
  return 'Student'
}

/**
 * Apple's Hide My Email relay.
 *
 * These are REAL, deliverable addresses and are treated as valid everywhere —
 * nothing rejects them, and mail sent to one reaches the person. The only
 * thing they are unfit for is being read as a human name.
 */
export function isRelayEmail(email: string | null | undefined): boolean {
  return /@privaterelay\.appleid\.com$/i.test(email ?? '')
}
