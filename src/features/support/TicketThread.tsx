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
  // A retry counter rather than a re-fetch call: the fetch stays inside the
  // effect, so nothing setStates synchronously in an effect body.
  const [attempt, setAttempt] = useState(0)
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
        if (!alive) return
        // Cleared here rather than at the top of the effect: a synchronous
        // setState in an effect body is the cascading-render lint, and a
        // retry that succeeds is the only thing that should clear the banner.
        setError(null)
        setMessages(rows)
      })
      .catch((e: unknown) => {
        if (!alive) return
        setError(e instanceof Error ? e.message : 'Could not load this conversation.')
        // THE SPINNER HAS TO STOP. `messages === null` used to mean both "still
        // loading" and "the load failed", so a query that always threw span
        // forever with the reason printed underneath in small type. An empty
        // array is the honest state here: we asked, we got nothing back, and
        // the error banner says why.
        setMessages([])
      })
    return () => {
      alive = false
    }
  }, [ticketId, attempt])

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
    <div className={cn('flex min-h-0 min-w-0 flex-1 flex-col', className)}>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages === null ? (
          <div className="grid place-items-center py-10">
            <Loader2 className="size-5 animate-spin text-accent" aria-label="Loading" />
          </div>
        ) : messages.length === 0 && !error ? (
          <p className="py-10 text-center text-[12.5px] text-subtle">
            No messages in this conversation yet.
          </p>
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
        <div className="flex items-start gap-3 border-t border-danger/30 bg-danger/10 px-4 py-2 text-[12px] text-danger">
          <span className="min-w-0 flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="shrink-0 font-medium underline underline-offset-2 hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}

      {/*
        THE SAME PILL THE DMs USE. This was a two-row rectangle with
        `resize-y`, which drew the browser's native resize grip — the pair of
        diagonal lines in the bottom-right corner that looked like a
        rendering fault. A message box you can drag taller is also the wrong
        affordance next to one you cannot, and support is a conversation like
        any other here.
      */}
      <div className="flex items-end gap-2 border-t border-border p-2.5">
        <div className="flex min-w-0 flex-1 items-end gap-1 rounded-[20px] border border-border bg-canvas py-1 pr-1 pl-3.5 transition-colors duration-150 focus-within:border-accent">
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
            rows={1}
            placeholder={perspective === 'staff' ? 'Reply to this person…' : 'Write a message…'}
            aria-label="Your message"
            className="max-h-28 min-h-[30px] flex-1 resize-none self-center bg-transparent py-1 text-[15px] text-fg placeholder:text-subtle focus:outline-none lg:text-[14px]"
          />
          {/* Grows in with the first character — see Chat.tsx. */}
          <button
            type="button"
            onClick={() => void send()}
            disabled={!draft.trim() || sending}
            tabIndex={draft.trim() ? 0 : -1}
            aria-label="Send message"
            className={cn(
              'grid h-8 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-accent-contrast',
              'transition-[width,opacity,transform] duration-200 ease-out hover:bg-accent-hover',
              draft.trim() ? 'w-8 scale-100 opacity-100' : 'pointer-events-none w-0 scale-75 opacity-0',
            )}
          >
            {sending ? (
              <Loader2 size={15} className="animate-spin" aria-hidden />
            ) : (
              <Send size={15} aria-hidden />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
