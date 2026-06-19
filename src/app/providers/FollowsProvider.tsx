import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, fireWrite } from '@/lib/supabase'
import { useAuth } from './auth'
import { useCommunityData } from './community-data'
import { FollowsContext, type FollowsContextValue } from './follows'

/**
 * Phase 8 — real follow persistence, backed by `org_follows` (per-user, own-row
 * RLS: nobody else can read who you follow). The app speaks org HANDLES; the table
 * keys by org_id, so we map through `CommunityProvider`'s `orgIdByHandle`. Loads
 * the signed-in user's follows on sign-in; toggles write through.
 */
export function FollowsProvider({ children }: { children: React.ReactNode }) {
  const { user: authUser } = useAuth()
  const { orgIdByHandle } = useCommunityData()
  const uid = authUser?.id
  // Stored as org_ids (the table's key); exposed to the app as handles.
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set())

  const handleById = useMemo(() => {
    const m: Record<string, string> = {}
    for (const [handle, id] of Object.entries(orgIdByHandle)) m[id] = handle
    return m
  }, [orgIdByHandle])

  useEffect(() => {
    let active = true
    void (async () => {
      if (!uid) {
        if (active) setFollowedIds(new Set())
        return
      }
      const { data } = await supabase.from('org_follows').select('org_id').eq('user_id', uid)
      if (!active) return
      setFollowedIds(new Set((data as { org_id: string }[] | null)?.map((r) => r.org_id) ?? []))
    })()
    return () => {
      active = false
    }
  }, [uid])

  const toggleFollow = useCallback(
    (handle: string) => {
      const orgId = orgIdByHandle[handle]
      if (!orgId || !uid) return
      setFollowedIds((prev) => {
        const next = new Set(prev)
        if (next.has(orgId)) {
          next.delete(orgId)
          fireWrite(supabase.from('org_follows').delete().eq('user_id', uid).eq('org_id', orgId))
        } else {
          next.add(orgId)
          fireWrite(
            supabase
              .from('org_follows')
              .upsert({ user_id: uid, org_id: orgId }, { onConflict: 'user_id,org_id' }),
          )
        }
        return next
      })
    },
    [orgIdByHandle, uid],
  )

  const followedHandles = useMemo(
    () => [...followedIds].map((id) => handleById[id]).filter(Boolean),
    [followedIds, handleById],
  )

  const value = useMemo<FollowsContextValue>(
    () => ({
      followedHandles,
      isFollowing: (handle) => {
        const id = orgIdByHandle[handle]
        return !!id && followedIds.has(id)
      },
      toggleFollow,
    }),
    [followedHandles, followedIds, orgIdByHandle, toggleFollow],
  )

  return <FollowsContext value={value}>{children}</FollowsContext>
}
