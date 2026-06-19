import { Eye, EyeOff, MoreHorizontal, Pin, Trash2 } from 'lucide-react'
import { authorLabel, fmtDate, REQ_STATUSES, type FeatureRequest, type ReactionSummary } from './feedback-data'
import { Avatar, Markdown, RequestStatusChip, TierChip, VerifiedCheck } from './feedback-ui'
import { CommentComposer } from './CommentThread'
import { ReactionBar } from './ReactionBar'
import { DropdownMenu, type MenuItem } from '@/components/ui/DropdownMenu'
import { cn } from '@/lib/cn'

export type ModeratePatch = Partial<Pick<FeatureRequest, 'pinned' | 'hidden' | 'status'>>

const moderationTrigger =
  'ml-0.5 inline-flex size-7 items-center justify-center rounded-md text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-fg data-[state=open]:bg-surface-2 data-[state=open]:text-fg'

/** The admin "…" moderation menu items for a request (used by RequestHeader). */
function requestMenuItems(
  r: FeatureRequest,
  onModerate: (patch: ModeratePatch) => void,
  onDelete: () => void,
): MenuItem[] {
  return [
    { id: 'pin', label: r.pinned ? 'Unpin' : 'Pin', icon: Pin, onSelect: () => onModerate({ pinned: !r.pinned }) },
    {
      id: 'hide',
      label: r.hidden ? 'Unhide' : 'Hide',
      icon: r.hidden ? Eye : EyeOff,
      onSelect: () => onModerate({ hidden: !r.hidden }),
    },
    ...REQ_STATUSES.filter((s) => s.value !== r.status).map((s, i) => ({
      id: `status-${s.value}`,
      label: `Mark ${s.label.toLowerCase()}`,
      onSelect: () => onModerate({ status: s.value }),
      separated: i === 0,
    })),
    { id: 'delete', label: 'Delete', icon: Trash2, danger: true, separated: true, onSelect: onDelete },
  ]
}

/** Post header: avatar + author + ✓ + tier on the left; status + pin + admin "…". */
export function RequestHeader({
  r,
  isAdmin,
  onModerate,
  onDelete,
}: {
  r: FeatureRequest
  isAdmin: boolean
  onModerate: (patch: ModeratePatch) => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-start gap-3">
      <Avatar name={r.author_name} avatarUrl={r.author_avatar} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span className="text-[13px] font-medium text-fg">{authorLabel(r.author_handle, r.author_name)}</span>
          <VerifiedCheck />
          <TierChip tier={r.author_tier} />
        </div>
        <span className="text-[12px] text-subtle">{fmtDate(r.created_at)}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <RequestStatusChip status={r.status} />
        {r.pinned && <Pin size={13} className="text-accent" aria-label="Pinned" />}
        {r.hidden && (
          <span className="inline-flex items-center gap-1 text-[11px] text-warning">
            <EyeOff size={12} aria-hidden /> Hidden
          </span>
        )}
        {isAdmin && (
          <DropdownMenu
            icon={MoreHorizontal}
            ariaLabel="Moderate request"
            items={requestMenuItems(r, onModerate, onDelete)}
            triggerClassName={moderationTrigger}
          />
        )}
      </div>
    </div>
  )
}

export function RequestCard({
  r,
  reactions,
  commentCount,
  canReact,
  canComment,
  isAdmin,
  myName,
  myAvatar,
  onToggleReaction,
  onOpen,
  onModerate,
  onDelete,
  onAddComment,
}: {
  r: FeatureRequest
  reactions: ReactionSummary[]
  commentCount: number
  canReact: boolean
  canComment: boolean
  isAdmin: boolean
  myName: string
  myAvatar?: string
  onToggleReaction: (emoji: string) => void
  onOpen: () => void
  onModerate: (patch: ModeratePatch) => void
  onDelete: () => void
  onAddComment: (body: string) => void
}) {
  return (
    <li className={cn('rounded-2xl border bg-surface p-5', r.hidden ? 'border-dashed border-warning/50' : 'border-border')}>
      <RequestHeader r={r} isAdmin={isAdmin} onModerate={onModerate} onDelete={onDelete} />

      <button
        type="button"
        onClick={onOpen}
        className="mt-3.5 block w-full text-left text-[15px] leading-snug font-semibold text-fg transition-colors duration-150 hover:text-accent"
      >
        {r.title}
      </button>
      {r.body && <Markdown text={r.body} className="mt-1.5 text-[13px] leading-relaxed text-muted" />}

      <div className="mt-4 flex items-center justify-between gap-3">
        <ReactionBar reactions={reactions} canReact={canReact} onToggle={onToggleReaction} />
        <button
          type="button"
          onClick={onOpen}
          className="shrink-0 text-[12px] text-subtle transition-colors duration-150 hover:text-fg"
        >
          {commentCount} comment{commentCount === 1 ? '' : 's'}
        </button>
      </div>

      {canComment && (
        <div className="mt-3 border-t border-border pt-3">
          <CommentComposer myName={myName} myAvatar={myAvatar} onAdd={onAddComment} />
        </div>
      )}
    </li>
  )
}
