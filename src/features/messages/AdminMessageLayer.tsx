import { useCallback, useEffect, useState } from 'react'
import { Check, Loader2, Send } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/cn'

interface AdminMessage {
  id: number
  sender_name: string
  body: string
  created_at: string
}

/**
 * A note from the founder, on your screen.
 *
 * THIS IS THE ONE UNPROMPTED INTERRUPT BESIDES A SEAT ALERT, and it earns
 * itself the same way: it only appears because a person typed it to you
 * specifically, usually about something you reported. It is not a
 * notification feed, there is no broadcast, and there is deliberately no
 * dismiss — one button, and pressing it is what records that you read it.
 *
 * WHY IT DOES NOT BLOCK THE APP. A modal over the whole screen would make an
 * ordinary "thanks, fixed it" feel like a billing failure. This sits in the
 * corner, above the mobile bar, and waits.
 *
 * Polling, not realtime: the same shape as SeatAlertLayer — on mount, on tab
 * focus, and every 90s while visible. One row per poll for a table almost
 * always empty is cheaper than holding a socket open for every signed-in
 * student, and nothing here is urgent to the second.
 */
export function AdminMessageLayer() {
  const [queue, setQueue] = useState<AdminMessage[]>([])
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [showReply, setShowReply] = useState(false)

  const [polls, setPolls] = useState(0)
  const poll = useCallback(() => setPolls((n) => n + 1), [])

  useEffect(() => {
    let alive = true
    void supabase.rpc('my_admin_messages').then(({ data, error }) => {
      // A missing migration must leave the app alone, not break it.
      if (!alive || error) return
      setQueue((data ?? []) as AdminMessage[])
    })
    return () => {
      alive = false
    }
  }, [polls])

  useEffect(() => {
    const onFocus = () => document.visibilityState === 'visible' && poll()
    document.addEventListener('visibilitychange', onFocus)
    const t = window.setInterval(() => document.visibilityState === 'visible' && poll(), 90_000)
    return () => {
      document.removeEventListener('visibilitychange', onFocus)
      window.clearInterval(t)
    }
  }, [poll])

  const msg = queue[0]
  if (!msg) return null

  async function acknowledge(withReply: boolean) {
    if (busy || !msg) return
    setBusy(true)
    try {
      await supabase.rpc('ack_admin_message', {
        p_id: msg.id,
        p_reply: withReply ? reply.trim() || null : null,
      })
      setSent(true)
      // A beat before it leaves, so pressing the button visibly did something.
      window.setTimeout(() => {
        setQueue((q) => q.slice(1))
        setReply('')
        setShowReply(false)
        setSent(false)
      }, 900)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={`Message from ${msg.sender_name}`}
      className={cn(
        'ct-admin-msg fixed right-3 bottom-20 z-[60] w-[min(22rem,calc(100vw-1.5rem))] md:bottom-4',
        'overflow-hidden rounded-2xl border border-accent/40 bg-surface shadow-2xl',
      )}
    >
      <div className="flex items-center gap-2 border-b border-border bg-accent-soft/40 px-3.5 py-2">
        <span className="grid size-5 shrink-0 place-items-center rounded-md bg-accent/20" aria-hidden>
          <span className="block size-2 rounded-full bg-accent" />
        </span>
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-fg">
          {msg.sender_name}
        </span>
        <span className="shrink-0 text-[10.5px] tracking-wide text-subtle uppercase">
          ConcordiaTracker
        </span>
      </div>

      <div className="px-3.5 py-3">
        <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap text-fg">{msg.body}</p>

        {showReply && !sent && (
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={2}
            autoFocus
            maxLength={1000}
            placeholder="Write back…"
            aria-label="Your reply"
            className="mt-2.5 w-full resize-y rounded-lg border border-border bg-canvas px-2.5 py-2 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
          />
        )}

        {sent ? (
          <p className="mt-2.5 flex items-center gap-1.5 text-[12.5px] font-medium text-success">
            <Check size={14} aria-hidden />
            {reply.trim() ? 'Sent — thanks' : 'Got it'}
          </p>
        ) : (
          <div className="mt-2.5 flex items-center gap-2">
            {showReply ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void acknowledge(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 size={13} className="animate-spin" aria-hidden />
                ) : (
                  <Send size={13} aria-hidden />
                )}
                Send
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void acknowledge(false)}
                className="rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                Got it
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowReply((v) => !v)}
              className="text-[12.5px] text-muted transition-colors hover:text-fg"
            >
              {showReply ? 'Never mind' : 'Reply'}
            </button>
            {queue.length > 1 && (
              <span className="ml-auto text-[11px] text-subtle">
                {queue.length - 1} more
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
