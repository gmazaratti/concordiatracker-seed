import { useState } from 'react'
import { Ban, Flag, MoreHorizontal } from 'lucide-react'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import { ReportSheet } from '@/components/ReportSheet'
import { isOrgBlocked, unblockOrg, useOrgBlocks } from '@/lib/org-blocks'
import { BlockOrgDialog } from './BlockOrgDialog'

/**
 * The ⋯ on a club's profile: Report the club, Block or Unblock it.
 * A club's own team never sees it (you do not report yourself).
 */
export function OrgSafetyMenu({ org }: { org: { id: string; handle: string; name: string } }) {
  const blocks = useOrgBlocks()
  const blocked = isOrgBlocked(blocks, org.id)
  const [reporting, setReporting] = useState(false)
  const [blocking, setBlocking] = useState(false)

  return (
    <>
      <DropdownMenu
        ariaLabel={`More options for ${org.name}`}
        icon={MoreHorizontal}
        triggerClassName="grid size-[38px] place-items-center rounded-lg border border-border text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
        items={[
          { id: 'report', label: 'Report club', icon: Flag, danger: true, onSelect: () => setReporting(true) },
          blocked
            ? { id: 'unblock', label: 'Unblock', icon: Ban, onSelect: () => void unblockOrg(org.id) }
            : { id: 'block', label: 'Block club', icon: Ban, danger: true, onSelect: () => setBlocking(true) },
        ]}
      />
      {reporting && (
        <ReportSheet
          target="club"
          subject={`Reported club ${org.handle}`}
          details={[`Club: ${org.name} ${org.handle} (${org.id})`]}
          onClose={() => setReporting(false)}
        />
      )}
      {blocking && <BlockOrgDialog org={org} onClose={() => setBlocking(false)} />}
    </>
  )
}

/** Shown in place of a blocked club's posts and events. */
export function BlockedOrgNotice({ org }: { org: { id: string; name: string } }) {
  const [busy, setBusy] = useState(false)
  return (
    <div className="mt-5 rounded-xl border border-dashed border-border-strong bg-surface/50 px-5 py-8 text-center">
      <p className="text-[14px] font-semibold text-fg">You blocked {org.name}</p>
      <p className="mx-auto mt-1 max-w-xs text-[12.5px] leading-relaxed text-subtle">
        Its posts, stories and events are hidden from you.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true)
          void unblockOrg(org.id).finally(() => setBusy(false))
        }}
        className="mt-3 rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium text-fg hover:bg-surface-2 disabled:opacity-50"
      >
        Unblock
      </button>
    </div>
  )
}
