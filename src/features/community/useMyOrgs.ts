import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/providers/auth'

/**
 * The organisations this person can publish as.
 *
 * Owner OR an active member, and APPROVED either way — the same two conditions
 * `ct_can_act_as_org` enforces on every write. This hook exists so the UI can
 * offer the button at all; the database is what decides whether the write
 * lands, and a mismatch here costs a hidden button, never a leak.
 */
export interface PublishableOrg {
  id: string
  handle: string
  name: string
  logo: string | null
  color: string | null
  glyph: string | null
  verified: boolean
}

interface Row {
  id: string
  handle: string
  name: string
  logo: string | null
  color: string | null
  glyph: string | null
  verified: boolean | null
}

const COLS = 'id, handle, name, logo, color, glyph, verified'

export function useMyOrgs(): { orgs: PublishableOrg[]; loading: boolean } {
  // THE SESSION IS ALREADY IN MEMORY. This used to call
  // `supabase.auth.getUser()`, which is a network round trip, before it could
  // even start asking which orgs are yours — so "Your story" sat blank for a
  // beat every time the feed mounted. The provider already holds the user.
  const { user: authUser } = useAuth()
  const uid = authUser?.id
  const [orgs, setOrgs] = useState<PublishableOrg[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    void (async () => {
      if (!uid) {
        setOrgs([])
        setLoading(false)
        return
      }
      // Two reads rather than an `or` across a join: PostgREST cannot express
      // "owner of, or a member of" in one filter, and an embedded resource
      // would return orgs with an empty members array as well.
      const [owned, memberOf] = await Promise.all([
        supabase.from('organizations').select(COLS).eq('owner_id', uid).eq('status', 'approved'),
        supabase
          .from('org_members')
          .select(`org:organizations!inner(${COLS})`)
          .eq('user_id', uid)
          .eq('status', 'active')
          .eq('organizations.status', 'approved'),
      ])
      if (!alive) return

      const seen = new Map<string, PublishableOrg>()
      const add = (r: Row | null | undefined) => {
        if (!r?.id || seen.has(r.id)) return
        seen.set(r.id, {
          id: r.id,
          handle: r.handle,
          name: r.name,
          logo: r.logo,
          color: r.color,
          glyph: r.glyph,
          verified: !!r.verified,
        })
      }
      for (const r of (owned.data ?? []) as Row[]) add(r)
      for (const row of (memberOf.data ?? []) as { org: Row | Row[] | null }[]) {
        // PostgREST returns an embedded to-one as an object, but types it as a
        // list often enough that guarding is cheaper than being surprised.
        const o = row.org
        if (Array.isArray(o)) o.forEach(add)
        else add(o)
      }
      setOrgs([...seen.values()])
      setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [uid])

  return { orgs, loading }
}
