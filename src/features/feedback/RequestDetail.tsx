import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Loader2 } from 'lucide-react'
import {
  addComment,
  adminDeleteComment,
  adminModerateComment,
  deleteOwnComment,
  listComments,
  type Comment,
  type FeatureRequest,
  type ReactionSummary,
} from './feedback-data'
import { Markdown } from './feedback-ui'
import { RequestHeader, type ModeratePatch } from './RequestCard'
import { ReactionBar } from './ReactionBar'
import { CommentComposer, CommentList } from './CommentThread'

/** Full-screen thread view — Back header, the request post + reactions, the
 * comment thread, and a composer. Reactions are owned by the board (passed in);
 * comments are loaded + managed here. */
export function RequestDetail({
  r,
  reactions,
  canReact,
  canComment,
  isAdmin,
  myUserId,
  myName,
  myAvatar,
  onToggleReaction,
  onModerate,
  onDelete,
  onClose,
  onCommentCountChange,
}: {
  r: FeatureRequest
  reactions: ReactionSummary[]
  canReact: boolean
  canComment: boolean
  isAdmin: boolean
  myUserId: string | null
  myName: string
  myAvatar?: string
  onToggleReaction: (emoji: string) => void
  onModerate: (patch: ModeratePatch) => void
  onDelete: () => void
  onClose: () => void
  onCommentCountChange: (delta: number) => void
}) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setComments(await listComments(r.id))
    } finally {
      setLoading(false)
    }
  }, [r.id])
  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const add = async (body: string) => {
    setBusy(true)
    try {
      await addComment(r.id, body)
      onCommentCountChange(1)
      await load()
    } catch {
      /* surfaced via reload */
    } finally {
      setBusy(false)
    }
  }
  const del = async (c: Comment) => {
    try {
      if (isAdmin) await adminDeleteComment(c.id)
      else await deleteOwnComment(c.id)
      onCommentCountChange(-1)
      await load()
    } catch {
      /* ignore */
    }
  }
  const moderate = async (id: string, hidden: boolean) => {
    try {
      await adminModerateComment(id, hidden)
      await load()
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-canvas">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors duration-150 hover:text-fg"
          >
            <ArrowLeft size={16} aria-hidden />
            Back
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-5 py-6">
        <article className="rounded-2xl border border-border bg-surface p-5">
          <RequestHeader
            r={r}
            isAdmin={isAdmin}
            onModerate={onModerate}
            onDelete={() => {
              onDelete()
              onClose()
            }}
          />
          <h1 className="mt-3.5 text-[18px] leading-snug font-semibold text-fg">{r.title}</h1>
          {r.body && <Markdown text={r.body} className="mt-2 text-[14px] leading-relaxed text-muted" />}
          <div className="mt-4">
            <ReactionBar reactions={reactions} canReact={canReact} onToggle={onToggleReaction} />
          </div>
        </article>

        <section className="mt-5">
          <h2 className="mb-3 text-[13px] font-semibold text-fg">
            {loading ? 'Comments' : `${comments.length} comment${comments.length === 1 ? '' : 's'}`}
          </h2>
          {loading ? (
            <div className="grid place-items-center py-8">
              <Loader2 className="size-5 animate-spin text-accent" aria-label="Loading" />
            </div>
          ) : (
            <CommentList comments={comments} isAdmin={isAdmin} myUserId={myUserId} onModerate={moderate} onDelete={del} />
          )}
          <div className="mt-4">
            {canComment ? (
              <CommentComposer myName={myName} myAvatar={myAvatar} busy={busy} onAdd={add} />
            ) : (
              <p className="text-[12px] text-subtle">Sign in to comment.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
