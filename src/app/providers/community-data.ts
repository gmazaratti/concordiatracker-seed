import { createContext, useContext } from 'react'
import type { CampusEvent, EventOrg } from '@/data/community'

/**
 * Phase 8 — the real Community data (orgs + events) loaded from Supabase. This is
 * the single fetch point; `useCommunity` (the read surface every screen uses) and
 * `FollowsProvider` read through it, so swapping the source touched only this.
 */
export interface CommunityDataValue {
  orgs: EventOrg[]
  events: CampusEvent[]
  loading: boolean
  /** org_id keyed by handle — follows persist by org_id, the app speaks handles. */
  orgIdByHandle: Record<string, string>
  refresh: () => void
}

export const CommunityDataContext = createContext<CommunityDataValue | null>(null)

export function useCommunityData(): CommunityDataValue {
  const ctx = useContext(CommunityDataContext)
  if (!ctx) throw new Error('useCommunityData must be used within <CommunityProvider>')
  return ctx
}
