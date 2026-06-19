import { useState } from 'react'
import { Eye, EyeOff, MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import { Avatar, Markdown, StaffBadge, TierChip, VerifiedCheck } from './feedback-ui'
import { authorLabel, timeAgo, type Comment } from './feedback-data'
import { DropdownMenu, type MenuItem } from '@/components/ui/DropdownMenu'
import { cn } from '@/lib/cn'

/** The inline "Write a comment…" composer (shown on cards + the detail thread). */
export function CommentComposer({
  myName,
  myAvatar,
  busy,
  onAdd,
}: {
  myName: string
  myAvatar?: string
  busy?: boolean
  onAdd: (body: string) => void
}) {
  const [body, setBody] = useState('')
  const submit = () => {
    const t = body.trim()
    if (!t || busy) return
    onAdd(t)
    setBody('')
  }
  return (
    <div className="flex items-center gap-2.5 rounded-full border border-border bg-surface-2/40 py-1.5 pr-1.5 pl-2">
      <Avatar name={myName} avatarUrl={myAvatar} size="sm" />
      <input
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="Write a comment…"
        className="min-w-0 flex-1 bg-transparent text-[13px] text-fg placeholder:text-subtle focus:outline-none"
      />
      <button
        type="button"
        onClick={submit}
        disabled={busy || !body.trim()}
        aria-label="Post comment"
        className="grid size-8 shrink-0 place-items-center rounded-full text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-fg disabled:opacity-50"
      >
        <Plus size={18} aria-hidden />
      </button>
    </div>
  )
}

export function CommentList({
  comments,
  isAdmin,
  myUserId,
  onModerate,
  onDelete,
}: {
  comments: Comment[]
  isAdmin: boolean
  myUserId: string | null
  onModerate: (id: string, hidden: boolean) => void
  onDelete: (c: Comment) => void
}) {
  if (comments.length === 0) {
    return <p className="py-3 text-[13px] text-subtle">No comments yet — start the conversation.</p>
  }
  return (
    <ul className="space-y-4">
      {comments.map((c) => (
        <CommentRow
          key={c.id}
          c={c}
          isAdmin={isAdmin}
          mine={!!myUserId && c.user_id === myUserId}
          onModerate={onModerate}
          onDelete={onDelete}
        />
      ))}
    </ul>
  )
}

function CommentRow({
  c,
  isAdmin,
  mine,
  onModerate,
  onDelete,
}: {
  c: Comment
  isAdmin: boolean
  mine: boolean
  onModerate: (id: string, hidden: boolean) => void
  onDelete: (c: Comment) => void
}) {
  const items: MenuItem[] = []
  if (isAdmin) {
    items.push({
      id: 'hide',
      label: c.hidden ? 'Unhide' : 'Hide',
      icon: c.hidden ? Eye : EyeOff,
      onSelect: () => onModerate(c.id, !c.hidden),
    })
  }
  if (mine || isAdmin) {
    items.push({ id: 'del', label: 'Delete', icon: Trash2, danger: true, separated: isAdmin, onSelect: () => onDelete(c) })
  }

  return (
    <li className={cn('flex gap-2.5', c.hidden && 'opacity-60')}>
      <Avatar name={c.author_name} avatarUrl={c.author_avatar} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-semibold text-fg">{authorLabel(c.author_handle, c.author_name)}</span>
          <VerifiedCheck />
          {c.is_staff ? <StaffBadge /> : <TierChip tier={c.author_tier} />}
          {c.hidden && <span className="text-[11px] text-warning">Hidden</span>}
          <span className="ml-auto shrink-0 text-[11px] text-subtle">{timeAgo(c.created_at)}</span>
          {items.length > 0 && (
            <DropdownMenu
              icon={MoreHorizontal}
              ariaLabel="Comment options"
              items={items}
              triggerClassName="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-fg data-[state=open]:bg-surface-2"
            />
          )}
        </div>
        <Markdown text={c.body} className="mt-0.5 text-[13px] leading-relaxed text-muted" />
      </div>
    </li>
  )
}
