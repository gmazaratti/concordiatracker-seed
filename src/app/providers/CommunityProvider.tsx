import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { eventFromRow, orgFromRow, type EventRow, type OrgRow } from '@/lib/supabase-adapters'
import { CommunityDataContext, type CommunityDataValue } from './community-data'
import type { CampusEvent, EventOrg } from '@/data/community'

const ORG_COLS = 'id, handle, name, verified, glyph, color, logo, banner, bio, links'
const EVENT_COLS =
  'id, org_id, title, start, mode, location, category, description, image, relevant_to, posted_at'

/** Loads the public Community feed (orgs + events) once on mount. The organizer
 * WRITE path (creating events from the portal) is still in-memory until Phase 10,
 * so portal-created events won't appear in this feed yet. */
export function CommunityProvider({ children }: { children: React.ReactNode }) {
  const [orgs, setOrgs] = useState<EventOrg[]>([])
  const [events, setEvents] = useState<CampusEvent[]>([])
  const [orgIdByHandle, setOrgIdByHandle] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    let active = true
    void (async () => {
      const [{ data: orgRows }, { data: evRows }] = await Promise.all([
        supabase.from('organizations').select(ORG_COLS),
        supabase.from('events').select(EVENT_COLS),
      ])
      if (!active) return
      const orgById = new Map<string, EventOrg>()
      const idByHandle: Record<string, string> = {}
      for (const row of (orgRows as OrgRow[] | null) ?? []) {
        orgById.set(row.id, orgFromRow(row))
        idByHandle[row.handle] = row.id
      }
      const evs: CampusEvent[] = []
      for (const row of (evRows as EventRow[] | null) ?? []) {
        const org = orgById.get(row.org_id)
        // Skip blank drafts (an organizer's not-yet-filled-in event).
        if (org && row.title?.trim()) evs.push(eventFromRow(row, org))
      }
      setOrgs([...orgById.values()])
      setEvents(evs)
      setOrgIdByHandle(idByHandle)
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => load(), [load])

  const value = useMemo<CommunityDataValue>(
    () => ({ orgs, events, loading, orgIdByHandle, refresh: load }),
    [orgs, events, loading, orgIdByHandle, load],
  )

  return <CommunityDataContext value={value}>{children}</CommunityDataContext>
}
