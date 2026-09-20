import { useCallback, useEffect, useState } from 'react'
import { Check, Loader2, Send, ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatTime } from '@/lib/date'
import { cn } from '@/lib/cn'

interface AdminMessage {
  id: number
  /**
   * Returned by the RPC and DELIBERATELY NOT SHOWN. A student hearing from
   * "Alex Degryse" has to work out who that is; hearing from "Admin" they
   * already know — it is the product talking to them. The real name stays in
   * the audit log, which is where it is the useful fact.
   */
  sender_name: string
  body: string
  created_at: string
}

/**
 * A note from the team, on your screen.
 *
 * THIS IS THE ONE UNPROMPTED INTERRUPT BESIDES A SEAT ALERT, and it earns
 * itself the same way: it only appears because a person typed it to you
 * specifically, usually about something you reported. It is not a
 * notification feed, there is no broadcast, and there is deliberately no
 * dismiss — one button, and pressing it is what records that you read it.
 *
 * IT IS SHAPED LIKE A CHAT, because it is one. A paragraph with a "Reply"
 * link under it reads as a form; a bubble with a composer beneath reads as a
 * conversation, which is what "they can write back" actually means. Enter
 * sends and Shift+Enter breaks the line, the way every chat box does, and the
 * reply is echoed back as your own bubble so sending visibly went somewhere.
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
    const text = reply.trim()
    if (withReply && !text) return
    setBusy(true)
    try {
      await supabase.rpc('ack_admin_message', {
        p_id: msg.id,
        p_reply: withReply ? text : null,
      })
      setSent(true)
      // A beat before it leaves, so pressing the button visibly did something.
      window.setTimeout(() => {
        setQueue((q) => q.slice(1))
        setReply('')
        setShowReply(false)
        setSent(false)
      }, 1100)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Message from ConcordiaTracker admin"
      className={cn(
        'ct-admin-msg fixed right-3 bottom-20 z-[60] w-[min(22.5rem,calc(100vw-1.5rem))] md:bottom-4',
        'flex flex-col overflow-hidden rounded-2xl border border-border-strong bg-surface shadow-2xl',
      )}
    >
      {/* Who it is from, said once, at the top. */}
      <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-3.5 py-2.5">
        <span
          className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-accent"
          aria-hidden
        >
          <ShieldCheck size={13} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] leading-tight font-semibold text-fg">Admin</span>
          <span className="block text-[10.5px] leading-tight text-subtle">ConcordiaTracker</span>
        </span>
        {queue.length > 1 && (
          <span className="shrink-0 rounded-full bg-surface px-1.5 py-0.5 text-[10.5px] text-subtle">
            {queue.length - 1} more
          </span>
        )}
      </div>

      {/* The conversation. */}
      <div className="max-h-[42vh] overflow-y-auto px-3.5 py-3">
        <div className="max-w-[92%]">
          <p className="rounded-2xl rounded-tl-md bg-surface-2 px-3 py-2 text-[13.5px] leading-relaxed whitespace-pre-wrap text-fg">
            {msg.body}
          </p>
          <p className="mt-1 pl-1 text-[10.5px] text-subtle">
            {formatTime(new Date(msg.created_at))}
          </p>
        </div>

        {/* Their own reply, echoed on the right the instant it is sent, so the
            panel reads as a conversation rather than a form that cleared. */}
        {sent && reply.trim() && (
          <div className="mt-2 ml-auto max-w-[92%]">
            <p className="rounded-2xl rounded-br-md bg-accent px-3 py-2 text-[13.5px] leading-relaxed whitespace-pre-wrap text-accent-contrast">
              {reply.trim()}
            </p>
          </div>
        )}
      </div>

      {/* The footer is one of three things: the confirmation, the composer, or
          the two ways out. */}
      {sent ? (
        <div className="flex items-center gap-1.5 border-t border-border px-3.5 py-2.5 text-[12.5px] font-medium text-success">
          <Check size={14} aria-hidden />
          {reply.trim() ? 'Sent — thanks' : 'Got it'}
        </div>
      ) : showReply ? (
        <div className="border-t border-border px-3 py-2.5">
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-canvas py-1.5 pr-1.5 pl-3 focus-within:border-accent">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void acknowledge(true)
                }
                if (e.key === 'Escape') {
                  e.preventDefault()
                  setShowReply(false)
                }
              }}
              rows={1}
              autoFocus
              maxLength={1000}
              placeholder="Write a reply…"
              aria-label="Your reply"
              className="max-h-24 min-h-[1.5rem] flex-1 resize-none bg-transparent py-1 text-[13.5px] leading-relaxed text-fg placeholder:text-subtle focus:outline-none"
            />
            <button
              type="button"
              disabled={busy || !reply.trim()}
              onClick={() => void acknowledge(true)}
              aria-label="Send reply"
              className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-accent-contrast transition-opacity duration-150 hover:opacity-90 disabled:opacity-40"
            >
              {busy ? (
                <Loader2 size={14} className="animate-spin" aria-hidden />
              ) : (
                <Send size={14} aria-hidden />
              )}
            </button>
          </div>
          <div className="mt-1.5 flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => setShowReply(false)}
              className="text-[11.5px] text-subtle transition-colors hover:text-fg"
            >
              Cancel
            </button>
            <span className="text-[11px] text-subtle tabular-nums">
              Enter to send · {1000 - reply.length} left
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 border-t border-border px-3.5 py-2.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => void acknowledge(false)}
            className="rounded-lg bg-accent px-3.5 py-1.5 text-[12.5px] font-medium text-accent-contrast transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
          >
            Got it
          </button>
          <button
            type="button"
            onClick={() => setShowReply(true)}
            className="rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium text-muted transition-colors duration-150 hover:border-border-strong hover:text-fg"
          >
            Reply
          </button>
        </div>
      )}
    </div>
  )
}
