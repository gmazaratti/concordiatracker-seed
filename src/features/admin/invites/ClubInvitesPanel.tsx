import { useCallback, useState } from 'react'
import { Plus } from 'lucide-react'
import { EmptyState, ErrorState, Loading, Panel, RefreshButton } from '../admin-ui'
import { useAdminList } from '../admin-data'
import { InviteRow } from './InviteRow'
import { NewInviteModal } from './NewInviteModal'
import { EditInviteModal } from './EditInviteModal'
import { InviteInfoModal } from './InviteInfoModal'
import { deleteClubInvite, listClubInvites, type ClubInvite } from './club-invites'

/**
 * Club invites — the one way to bring a club onto the platform.
 *
 * Replaces three overlapping panels (outreach links, the create-and-hand-off
 * form, and the test-club button) with one list and one "New invite". Every
 * invite ever sent is a row here, including the ones made before this
 * existed: nothing was migrated away, the list reads the same table.
 */
export function ClubInvitesPanel() {
  const loader = useCallback(() => listClubInvites(), [])
  const { items, loading, error, reload } = useAdminList<ClubInvite>(loader)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<ClubInvite | null>(null)
  const [info, setInfo] = useState<ClubInvite | null>(null)
  const [now] = useState(() => Date.now())

  return (
    <Panel
      title="Club invites"
      sub={loading ? 'Loading…' : `${items.length} link${items.length === 1 ? '' : 's'}`}
      action={
        <span className="flex shrink-0 items-center gap-2">
          <RefreshButton onClick={reload} busy={loading} />
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[13px] font-semibold text-accent-contrast transition-colors hover:bg-accent-hover"
          >
            <Plus size={15} aria-hidden />
            New invite
          </button>
        </span>
      }
    >
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} />
      ) : items.length === 0 ? (
        <EmptyState>No invites yet. “New invite” makes one link per club.</EmptyState>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((i) => (
            <InviteRow
              key={i.token}
              invite={i}
              now={now}
              onInfo={() => setInfo(i)}
              onEdit={() => setEditing(i)}
              onDelete={() => void deleteClubInvite(i.token).then(reload)}
            />
          ))}
        </ul>
      )}
      {creating && <NewInviteModal onClose={() => setCreating(false)} onCreated={reload} />}
      {editing && <EditInviteModal invite={editing} onClose={() => setEditing(null)} onSaved={reload} />}
      {info && <InviteInfoModal invite={info} onClose={() => setInfo(null)} />}
    </Panel>
  )
}
