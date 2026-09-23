/**
 * Comparing handles, when a handle can be null.
 *
 * IT CAN BE NULL, AND IT IS. `user_profile.handle` is nullable — a row is
 * created at first sign-in and the handle is chosen during onboarding, so
 * anybody who stopped halfway has a name and no handle. Four live profiles
 * are in exactly that state, and one of them follows the founder, which put
 * her in `my_friends()` and made `f.handle.toLowerCase()` throw. That threw
 * during render, which unmounted the whole Social section.
 *
 * SO THE COMPARISON IS THE FUNCTION, not a `?? ''` sprinkled at five call
 * sites. Every one of those five was written by somebody who believed the
 * type; the sixth would have been too.
 *
 * `null` MATCHES NOTHING, including another null: two people who have not
 * picked a handle are not the same person, and a search for "" must not
 * return everybody who has not finished signing up.
 */
export function lc(value: string | null | undefined): string {
  return (value ?? '').toLowerCase()
}

/** Case-insensitive, null-safe, and never true for a missing handle. */
export function sameHandle(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = lc(a).replace(/^@/, '')
  const y = lc(b).replace(/^@/, '')
  return x !== '' && x === y
}

/** Does this person match what was typed? Name OR handle, either missing. */
export function matchesQuery(
  query: string,
  ...fields: (string | null | undefined)[]
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return fields.some((f) => lc(f).includes(q))
}

/**
 * A handle with exactly one `@`.
 *
 * Organisations store theirs WITH the sign and people store theirs without,
 * so every surface that shows both has a prefix that is right for one of them.
 * The admin org list rendered `@{o.handle}` and printed `@@reggiesmtl`.
 */
export function atHandle(handle: string | null | undefined): string {
  const h = (handle ?? '').trim().replace(/^@+/, '')
  return h ? `@${h}` : ''
}
