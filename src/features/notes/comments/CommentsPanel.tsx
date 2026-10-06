import { useState } from 'react'
import { Check, MessageSquare, RotateCcw, Trash2 } from 'lucide-react'
import { PersonAvatar } from '@/features/community/PersonAvatar'
import { cn } from '@/lib/cn'
import { ago } from '../note-format'
import type { NotePerson } from '../sharing-api'
import type { NoteRole } from '../types'
import type { Thread } from './comments-api'

export interface Draft {
  threadId: string
  quote: string
  anchor: { from: unknown; to: unknown } | null
}

/**
 * Comment threads, in the side panel. A new comment starts from selected text
 * (the Comment button above the page); here you write it, reply, resolve.
 * Resolved threads fold away at the bottom rather than disappearing — a
 * resolved question is still the record of how something was decided.
 */
export function CommentsPanel({
  threads, people, myId, role, active, draft, onActive, onPostDraft, onCancelDraft, onReply, onResolve, onDelete,
}: {
  threads: Thread[]
  people: NotePerson[]
  myId: string | null
  role: NoteRole
  active: string | null
  draft: Draft | null
  onActive: (id: string | null) => void
  onPostDraft: (body: string) => void
  onCancelDraft: () => void
  onReply: (threadId: string, body: string) => void
  onResolve: (threadId: string, resolved: boolean) => void
  onDelete: (commentId: string) => void
}) {
  const [showResolved, setShowResolved] = useState(false)
  const who = (id: string) => people.find((p) => p.userId === id)
  const open = threads.filter((t) => !t.resolved)
  const resolved = threads.filter((t) => t.resolved)
  const canResolve = role === 'owner' || role === 'editor'

  return (
    <div className="flex flex-col gap-3 p-4">
      {draft && (
        <div className="ct-animate-pop rounded-xl border border-accent/50 bg-surface p-3 shadow-sm">
          <p className="mb-2 line-clamp-2 border-l-2 border-accent pl-2 text-[12.5px] text-muted">“{draft.quote}”</p>
          <Composer autoFocus placeholder="Add a comment" onSubmit={onPostDraft} onCancel={onCancelDraft} />
        </div>
      )}

      {open.length === 0 && !draft && (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <MessageSquare size={22} className="text-subtle" aria-hidden />
          <p className="text-[13px] text-muted">No comments yet.</p>
          <p className="max-w-[15rem] text-[12px] text-subtle">Select some text and press Comment to start one.</p>
        </div>
      )}

      {open.map((t) => (
        <ThreadCard key={t.id} thread={t} active={t.id === active} who={who} myId={myId} canResolve={canResolve}
          onActive={() => onActive(t.id)} onReply={(b) => onReply(t.id, b)} onResolve={() => onResolve(t.id, true)} onDelete={onDelete} />
      ))}

      {resolved.length > 0 && (
        <button type="button" onClick={() => setShowResolved((s) => !s)} className="self-start text-[12.5px] font-medium text-muted hover:text-fg">
          {showResolved ? 'Hide' : 'Show'} {resolved.length} resolved
        </button>
      )}
      {showResolved && resolved.map((t) => (
        <ThreadCard key={t.id} thread={t} active={false} who={who} myId={myId} canResolve={canResolve} faded
          onActive={() => onActive(t.id)} onReply={() => {}} onResolve={() => onResolve(t.id, false)} onDelete={onDelete} />
      ))}
    </div>
  )
}

function ThreadCard({ thread, active, who, myId, canResolve, faded, onActive, onReply, onResolve, onDelete }: {
  thread: Thread
  active: boolean
  who: (id: string) => NotePerson | undefined
  myId: string | null
  canResolve: boolean
  faded?: boolean
  onActive: () => void
  onReply: (body: string) => void
  onResolve: () => void
  onDelete: (id: string) => void
}) {
  return (
    <div onClick={onActive}
      className={cn('rounded-xl border bg-surface p-3 transition-[border-color,box-shadow,opacity] duration-200',
        active ? 'border-accent shadow-md' : 'border-border hover:border-border-strong', faded && 'opacity-70')}>
      <div className="mb-2 flex items-start gap-2">
        {thread.quote && <p className="line-clamp-2 min-w-0 flex-1 border-l-2 border-amber-400 pl-2 text-[12px] text-muted">“{thread.quote}”</p>}
        {canResolve && (
          <button type="button" title={faded ? 'Reopen' : 'Resolve'} aria-label={faded ? 'Reopen thread' : 'Resolve thread'}
            onClick={(e) => { e.stopPropagation(); onResolve() }}
            className="ml-auto grid size-7 shrink-0 place-items-center rounded-md text-subtle hover:bg-surface-2 hover:text-success">
            {faded ? <RotateCcw size={14} aria-hidden /> : <Check size={15} aria-hidden />}
          </button>
        )}
      </div>
      <ul className="flex flex-col gap-2.5">
        {thread.comments.map((c) => {
          const p = who(c.userId)
          return (
            <li key={c.id} className="group flex gap-2">
              <PersonAvatar person={{ handle: p?.handle ?? '', name: p?.name ?? null, avatar_url: p?.avatarUrl ?? null }} className="size-6" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[12px]">
                  <span className="font-semibold text-fg">{p?.name || (p?.handle ? `@${p.handle}` : 'Someone')}</span>
                  <span className="text-subtle">{ago(c.createdAt)}</span>
                  {c.userId === myId && (
                    <button type="button" aria-label="Delete comment" onClick={(e) => { e.stopPropagation(); onDelete(c.id) }}
                      className="ml-auto opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 text-subtle hover:text-danger">
                      <Trash2 size={12} aria-hidden />
                    </button>
                  )}
                </p>
                <p className="text-[13px] leading-snug whitespace-pre-wrap break-words text-fg">{c.body}</p>
              </div>
            </li>
          )
        })}
      </ul>
      {active && !faded && <div className="mt-2.5"><Composer placeholder="Reply" onSubmit={onReply} /></div>}
    </div>
  )
}

function Composer({ placeholder, onSubmit, onCancel, autoFocus }: { placeholder: string; onSubmit: (b: string) => void; onCancel?: () => void; autoFocus?: boolean }) {
  const [text, setText] = useState('')
  const send = () => {
    if (!text.trim()) return
    onSubmit(text.trim())
    setText('')
  }
  return (
    <div onClick={(e) => e.stopPropagation()} className="flex flex-col gap-1.5">
      <textarea autoFocus={autoFocus} value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={4000} placeholder={placeholder}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send() } if (e.key === 'Escape') onCancel?.() }}
        className="w-full resize-none rounded-lg border border-border bg-surface-2 px-2.5 py-2 text-[13px] text-fg outline-none focus:border-accent" />
      <div className="flex justify-end gap-1.5">
        {onCancel && <button type="button" onClick={onCancel} className="rounded-md px-2.5 py-1 text-[12.5px] text-muted hover:bg-surface-2">Cancel</button>}
        <button type="button" onClick={send} disabled={!text.trim()} className="rounded-md bg-accent px-2.5 py-1 text-[12.5px] font-medium text-accent-contrast hover:bg-accent-hover disabled:opacity-40">
          {onCancel ? 'Comment' : 'Reply'}
        </button>
      </div>
    </div>
  )
}
