import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Send } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { PersonAvatar } from '../PersonAvatar'
import { addComment, loadComments, type PostComment } from '@/lib/social-posts'
import { cn } from '@/lib/cn'

/**
 * Comments, as a sheet.
 *
 * WHY NOT INLINE. They used to expand under the post, which pushes every
 * card below it down the page — so opening comments moves the thing you were
 * reading, and closing them moves it back. On a phone that is the whole
 * screen rearranging itself around a tap. A sheet leaves the feed exactly
 * where it was.
 *
 * It rides on `ModalShell`, which already slides up from the bottom edge on
 * a phone, can be flicked away, traps focus and closes on Escape.
 *
 * THE QUICK EMOJI ROW IS ONE TAP TO A COMMENT, not a reaction — this product
 * has no reaction model and inventing one here would put a count nobody else
 * can see next to counts everybody can. It simply drops the character into
 * the field, which is what the reference does too.
 */
const QUICK = ['❤️', '🙌', '🔥', '👏', '😢', '😍', '😮', '😂']

export function CommentsSheet({
  postId,
  initial,
  onCount,
  onClose,
}: {
  postId: string
  /** What the card already loaded, so the sheet opens with content rather
   *  than a spinner it does not need. */
  initial: PostComment[] | null
  onCount: (n: number) => void
  onClose: () => void
}) {
  const [rows, setRows] = useState<PostComment[] | null>(initial)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (rows !== null) return
    let alive = true
    void loadComments(postId)
      .then((r) => alive && setRows(r))
      .catch(() => alive && setRows([]))
    return () => {
      alive = false
    }
  }, [postId, rows])

  const submit = async () => {
    const text = body.trim()
    if (!text || busy) return
    setBusy(true)
    const err = await addComment(postId, text)
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    setBody('')
    setError(null)
    // Re-read rather than invent the row: the server stamps the id and the
    // time, and a locally-made comment jumps when the list next refreshes.
    const fresh = await loadComments(postId)
    setRows(fresh)
    onCount(fresh.length)
  }

  return (
    <ModalShell label="Comments" onClose={onClose} widthClass="sm:max-w-md" scroll={false}>
      <div className="flex h-[72vh] flex-col sm:h-[68vh]">
        <header className="shrink-0 border-b border-border/70 pb-2.5 text-center">
          <h2 className="text-[14px] font-semibold text-fg">Comments</h2>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {rows === null ? (
            <p className="py-8 text-center text-[12.5px] text-subtle">Loading…</p>
          ) : rows.length === 0 ? (
            <div className="py-14 text-center">
              <p className="text-[15px] font-medium text-fg">No comments yet</p>
              <p className="mt-1 text-[13px] text-subtle">Start the conversation.</p>
            </div>
          ) : (
            <ul className="space-y-3.5">
              {rows.map((c) => (
                <li key={c.id} className="flex gap-3">
                  <Link to={`/@${c.handle}`} className="shrink-0">
                    <PersonAvatar
                      person={{ handle: c.handle, name: c.name, avatar_url: c.avatarUrl }}
                      className="size-8"
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] leading-snug text-fg">
                      <Link to={`/@${c.handle}`} className="font-semibold hover:underline">
                        {c.handle}
                      </Link>{' '}
                      <span className="text-subtle">{ago(c.createdAt)}</span>
                    </p>
                    <p className="mt-0.5 text-[14px] leading-snug whitespace-pre-wrap text-fg">
                      {c.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <p className="px-4 pb-1 text-[11.5px] text-warning">{error}</p>}

        <div className="shrink-0 border-t border-border/70 px-3 pt-2 pb-3">
          <div className="-mx-1 mb-2 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {QUICK.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setBody((b) => b + e)}
                aria-label={`Add ${e}`}
                className="grid size-9 shrink-0 place-items-center rounded-full text-[19px] transition-transform duration-150 hover:bg-surface-2 active:scale-90"
              >
                {e}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2 rounded-[20px] border border-border bg-canvas py-1 pr-1 pl-3.5 transition-colors duration-150 focus-within:border-accent">
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
              placeholder="Add a comment…"
              maxLength={1000}
              aria-label="Add a comment"
              className="min-w-0 flex-1 self-center bg-transparent py-1.5 text-[15px] text-fg placeholder:text-subtle focus:outline-none lg:text-[14px]"
            />
            {/* Grows in with the first character — same rule as the DM composer. */}
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!body.trim() || busy}
              tabIndex={body.trim() ? 0 : -1}
              aria-label="Post comment"
              className={cn(
                'grid h-8 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-accent-contrast',
                'transition-[width,opacity,transform] duration-200 ease-out hover:bg-accent-hover',
                body.trim() ? 'w-8 scale-100 opacity-100' : 'pointer-events-none w-0 scale-75 opacity-0',
              )}
            >
              <Send size={15} className="translate-x-px" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  )
}

const MINUTE = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000
/** Module level: a clock read in a component body trips `react-hooks/purity`. */
function ago(iso: string): string {
  const d = Math.max(0, Date.now() - new Date(iso).getTime())
  if (d < MINUTE) return 'now'
  if (d < HOUR) return `${Math.floor(d / MINUTE)}m`
  if (d < DAY) return `${Math.floor(d / HOUR)}h`
  if (d < 7 * DAY) return `${Math.floor(d / DAY)}d`
  return `${Math.floor(d / (7 * DAY))}w`
}
