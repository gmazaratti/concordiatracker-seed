import { useRef } from 'react'
import { Info, PenLine } from 'lucide-react'
import { CopyChip, ConfirmButton, Pill } from '../admin-ui'
import { atHandle } from '@/lib/handles'
import { inviteState, inviteUrl, isUnlimited, neverExpires, relTime, type ClubInvite, type InviteState } from './club-invites'

const STATE: Record<InviteState, { label: string; tone: string }> = {
  unused: { label: 'Unused', tone: 'neutral' },
  opened: { label: 'Opened', tone: 'blue' },
  claimed: { label: 'Claimed', tone: 'green' },
  'used-up': { label: 'Used up', tone: 'neutral' },
  expired: { label: 'Expired', tone: 'amber' },
}

/**
 * One invite, on two lines that wrap instead of clipping:
 *   1. name · status · the numbers that matter
 *   2. the link (it truncates inside its pill) and the actions
 *
 * Info is reachable three ways: a visible button, right-click on a desktop,
 * and a long-press on a phone. Long-press alone is too hidden to be the only
 * door, which is why the button is always there.
 */
export function InviteRow({
  invite: i,
  now,
  onInfo,
  onEdit,
  onDelete,
}: {
  invite: ClubInvite
  now: number
  onInfo: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const state = inviteState(i, now)
  const press = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancel = () => {
    if (press.current) clearTimeout(press.current)
    press.current = null
  }

  return (
    <li
      className="px-4 py-3.5"
      onContextMenu={(e) => {
        e.preventDefault()
        onInfo()
      }}
      onPointerDown={(e) => {
        if (e.pointerType !== 'touch') return
        press.current = setTimeout(onInfo, 550)
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="min-w-0 truncate text-[14px] font-semibold text-fg">{i.org_name}</span>
        <Pill tone={STATE[state].tone}>{STATE[state].label}</Pill>
        <span className="text-[11.5px] text-subtle">{i.mode === 'prefilled' ? 'Pre-filled' : 'Self-setup'}</span>
        <span className="flex basis-full flex-wrap items-center gap-x-3 text-[12px] text-muted tabular-nums sm:ml-auto sm:basis-auto">
          <span title="Opens (distinct browser visits)">{i.opens} open{i.opens === 1 ? '' : 's'}</span>
          <span title="Uses">
            {i.use_count}/{isUnlimited(i.max_uses) ? '∞' : i.max_uses} used
          </span>
          <span title={new Date(i.expires_at).toLocaleString()}>
            {neverExpires(i.expires_at)
              ? 'No expiry'
              : new Date(i.expires_at).getTime() < now
                ? `Expired ${relTime(i.expires_at, now)}`
                : `Expires ${relTime(i.expires_at, now)}`}
          </span>
        </span>
      </div>
      <p className="mt-0.5 truncate text-[12px] text-subtle">
        {atHandle(i.org_handle)}
        {i.claimed_email ? ` · claimed by ${i.claimed_email}` : ''}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="min-w-0 max-w-full flex-1 basis-56">
          <CopyChip value={inviteUrl(i.token)} title="Copy the invite link" />
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={onInfo} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[12px] text-muted transition-colors hover:bg-surface-2 hover:text-fg">
            <Info size={13} aria-hidden />
            Info
          </button>
          <button type="button" onClick={onEdit} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[12px] text-muted transition-colors hover:bg-surface-2 hover:text-fg">
            <PenLine size={13} aria-hidden />
            Edit
          </button>
          <ConfirmButton label="Delete" armedLabel="Confirm" danger onConfirm={onDelete} />
        </span>
      </div>
    </li>
  )
}
