import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { eventFromRow, orgFromRow, optionalCols, type EventRow, type OrgRow } from '@/lib/supabase-adapters'
import { CommunityDataContext, type CommunityDataValue } from './community-data'
import type { CampusEvent, EventOrg } from '@/data/community'

// owner_id so a PERSON can be shown as an organizer. Derived, never granted:
// the badge appears when they own an approved org and goes away by itself.
const ORG_COLS = 'id, owner_id, handle, name, verified, glyph, color, logo, banner, bio, links'
const EVENT_COLS =
  'id, org_id, title, start, mode, location, category, description, image, relevant_to, posted_at'

/** Loads the public Community feed (orgs + events) once on mount. The organizer
 * WRITE path (creating events from the portal) is still in-memory until Phase 10,
 * so portal-created events won't appear in this feed yet. */
export function CommunityProvider({ children }: { children: React.ReactNode }) {
  const [orgs, setOrgs] = useState<EventOrg[]>([])
  const [events, setEvents] = useState<CampusEvent[]>([])
  const [orgIdByHandle, setOrgIdByHandle] = useState<Record<string, string>>({})
  const [orgNameByOwner, setOrgNameByOwner] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    let active = true
    void (async () => {
      // Appended only if the bilingual migration has been applied — see
      // optionalCols. Without this guard a pending migration blanks the feed.
      // Probed SEPARATELY per migration rather than as one list: bundling
      // them means a project that has `translations` but not `venue` loses
      // both, which is the blackout this guard exists to prevent.
      const [orgExtra, evExtra, orgVenue, evSeries] = await Promise.all([
        optionalCols(supabase, 'organizations', ['translations']),
        optionalCols(supabase, 'events', ['translations']),
        optionalCols(supabase, 'organizations', ['email', 'venue']),
        optionalCols(supabase, 'events', ['series_id', 'recurrence']),
      ])
      const [{ data: orgRows }, { data: evRows }] = await Promise.all([
        supabase.from('organizations').select(ORG_COLS + orgExtra + orgVenue),
        // The team's read policy returns its own drafts too; a draft is not
        // something the student side of the same account should see.
        supabase.from('events').select(EVENT_COLS + evExtra + evSeries).eq('is_draft', false),
      ])
      if (!active) return
      const orgById = new Map<string, EventOrg>()
      const idByHandle: Record<string, string> = {}
      const byOwner: Record<string, string> = {}
      for (const row of (orgRows as (OrgRow & { owner_id?: string | null })[] | null) ?? []) {
        orgById.set(row.id, orgFromRow(row))
        idByHandle[row.handle] = row.id
        if (row.owner_id) byOwner[row.owner_id] = row.name ?? row.handle
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
      setOrgNameByOwner(byOwner)
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => load(), [load])

  const value = useMemo<CommunityDataValue>(
    () => ({ orgs, events, loading, orgIdByHandle, orgNameByOwner, refresh: load }),
    [orgs, events, loading, orgIdByHandle, orgNameByOwner, load],
  )

  return <CommunityDataContext value={value}>{children}</CommunityDataContext>
}
