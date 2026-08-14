import { useEffect, useRef, useState } from 'react'
import { Loader2, Send } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatDueDateTime } from '@/lib/date'
import { ticketThread, replyToTicket, type TicketMessage } from '@/lib/tickets'

/**
 * The conversation view — shared by the student's support panel and the admin
 * inbox, so both sides read the same thread in the same shape. Staff messages
 * sit left with a distinct tint; the viewer's own sit right.
 *
 * `perspective` only changes which side is "mine". It never decides how a
 * message is labelled — that comes from author_role on the server, so a user
 * can't post something that renders as Support.
 */
export function TicketThread({
  ticketId,
  perspective,
  onReplied,
  className,
}: {
  ticketId: string
  perspective: 'user' | 'staff'
  onReplied?: () => void
  className?: string
}) {
  const [messages, setMessages] = useState<TicketMessage[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [loadedFor, setLoadedFor] = useState(ticketId)
  const endRef = useRef<HTMLDivElement>(null)

  // Clearing the old thread on a ticket switch is an adjust-state-during-render,
  // not an effect: resetting in the effect body would render the previous
  // conversation for a frame and trips react-hooks/set-state-in-effect.
  if (loadedFor !== ticketId) {
    setLoadedFor(ticketId)
    setMessages(null)
    setError(null)
  }

  useEffect(() => {
    let alive = true
    void ticketThread(ticketId)
      .then((rows) => {
        if (alive) setMessages(rows)
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : 'Could not load this conversation.')
      })
    return () => {
      alive = false
    }
  }, [ticketId])

  // Land at the newest message, the way any chat does.
  useEffect(() => {
    if (messages) endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  async function send() {
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    setError(null)
    try {
      await replyToTicket(ticketId, body)
      setDraft('')
      setMessages(await ticketThread(ticketId))
      onReplied?.()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not send that message.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages === null ? (
          <div className="grid place-items-center py-10">
            <Loader2 className="size-5 animate-spin text-accent" aria-label="Loading" />
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.author_role === perspective
            return (
              <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[85%] min-w-0', mine && 'text-right')}>
                  <p className="mb-1 text-[11px] text-subtle">
                    {m.author_name} · {formatDueDateTime(m.created_at)}
                  </p>
                  <div
                    className={cn(
                      'inline-block rounded-xl px-3.5 py-2.5 text-left text-[13.5px] leading-relaxed whitespace-pre-wrap',
                      mine
                        ? 'bg-accent-soft text-fg'
                        : 'border border-border bg-surface-2 text-muted',
                    )}
                  >
                    {m.body}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <p className="border-t border-danger/30 bg-danger/10 px-4 py-2 text-[12px] text-danger">
          {error}
        </p>
      )}

      <div className="flex items-end gap-2 border-t border-border p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter makes a new line — chat convention.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send()
            }
          }}
          rows={2}
          placeholder={perspective === 'staff' ? 'Reply to this person…' : 'Write a message…'}
          aria-label="Your message"
          className="min-h-[42px] flex-1 resize-y rounded-lg border border-border bg-canvas px-3 py-2 text-[13.5px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={!draft.trim() || sending}
          aria-label="Send message"
          className="grid size-[42px] shrink-0 place-items-center rounded-lg bg-accent text-accent-contrast transition-colors duration-150 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? (
            <Loader2 size={16} className="animate-spin" aria-hidden />
          ) : (
            <Send size={16} aria-hidden />
          )}
        </button>
      </div>
    </div>
  )
}
