import { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff, MoreHorizontal, Pin, Sparkles, Trash2 } from 'lucide-react'
import { authorLabel, EMOJI_PALETTE, fmtDate, REQ_STATUSES, type FeatureRequest, type ReactionSummary } from './feedback-data'
import { Avatar, Markdown, RequestStatusChip, TierChip, VerifiedCheck } from './feedback-ui'
import { founderRole } from './founders'
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
          <VerifiedCheck founder={!!founderRole(r.author_handle, r.author_name)} />
          <TierChip tier={r.author_tier} handle={r.author_handle} name={r.author_name} />
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
  onAdminBump,
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
  /** Admin-only: dial the seed reactions (undefined for non-admins). */
  onAdminBump?: (emoji: string, delta: number) => void
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
        <div className="flex min-w-0 items-center gap-2">
          <ReactionBar reactions={reactions} canReact={canReact} onToggle={onToggleReaction} />
          {onAdminBump && <AdminReactionEditor seed={r.seed_reactions} onBump={onAdminBump} />}
        </div>
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

/** Admin-only: dial seed reactions on a request up/down to make the board feel
 * lively. A popover of the emoji palette with +/− steppers; each nudge is
 * optimistic (the parent persists via admin_bump_reaction). */
function AdminReactionEditor({
  seed,
  onBump,
}: {
  seed?: Record<string, number>
  onBump: (emoji: string, delta: number) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const stepper =
    'grid size-6 place-items-center rounded-md border border-border text-[13px] text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg disabled:opacity-40 disabled:pointer-events-none'

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title="Boost reactions (admin)"
        className={cn(
          'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11.5px] font-medium transition-colors duration-150',
          open ? 'border-accent/50 bg-accent-soft/40 text-fg' : 'border-border text-subtle hover:bg-surface-2 hover:text-fg',
        )}
      >
        <Sparkles size={12} aria-hidden />
        Boost
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-20 mb-2 w-56 rounded-xl border border-border bg-surface p-2 shadow-[var(--ct-shadow)]">
          <p className="px-1.5 pb-1 text-[11px] text-subtle">Seed reactions · admin only</p>
          <ul>
            {EMOJI_PALETTE.map((e) => {
              const n = seed?.[e] ?? 0
              return (
                <li key={e} className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-surface-2/40">
                  <span className="text-[15px] leading-none">{e}</span>
                  <span className="flex-1 text-[12px] text-subtle tabular-nums">
                    {n > 0 ? `+${n}` : '—'}
                  </span>
                  <button type="button" className={stepper} disabled={n === 0} onClick={() => onBump(e, -1)} aria-label={`Remove one ${e}`}>
                    −
                  </button>
                  <button type="button" className={stepper} onClick={() => onBump(e, 1)} aria-label={`Add one ${e}`}>
                    +
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
