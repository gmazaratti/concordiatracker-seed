import { useCallback, useEffect, useState } from 'react'
import { loadOrgRoles, myPosition, type OrgRoleDef } from '@/lib/org-roles'

/**
 * The club's roles and where the signed-in person ranks, loaded once per
 * screen and handed down — one fetch for a whole member list rather than one
 * per row. `refresh()` re-reads after anything that changed them.
 *
 * `mine` is -1 until it arrives, which every "may I" check reads as "no": a
 * control that flashes enabled and then disables itself is worse than one
 * that waits.
 */
export function useOrgRoles(orgId: string | undefined) {
  const [roles, setRoles] = useState<OrgRoleDef[] | null>(null)
  const [mine, setMine] = useState(-1)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!orgId) return
    let alive = true
    void Promise.all([loadOrgRoles(orgId), myPosition(orgId)])
      .then(([r, p]) => {
        if (!alive) return
        setRoles(r)
        setMine(p)
        setError('')
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : 'Could not load roles.')
      })
    return () => {
      alive = false
    }
  }, [orgId, tick])

  const refresh = useCallback(() => setTick((t) => t + 1), [])
  return { roles, mine, error, refresh }
}

/** Owners come back as the sentinel; everything above a million is "owner". */
export const isOwnerRank = (pos: number) => pos > 1_000_000
