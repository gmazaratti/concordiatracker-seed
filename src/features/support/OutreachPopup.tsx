import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Briefcase, Globe, Heart, MessageCircle, Send } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/providers/auth'
import { haptic } from '@/lib/haptics'
import { cn } from '@/lib/cn'

interface Popup {
  id: string
  ticket_id: string | null
  title: string
  body: string
  min_seconds: number
}

/** Where to find us. One list, so adding a handle is a one-line change. */
const SOCIALS = [
  { label: 'concordiatracker.com', href: 'https://concordiatracker.com', icon: Globe },
  { label: '@concordiatracker on the app', href: '/@concordiatracker', icon: MessageCircle },
  { label: 'Alex on LinkedIn', href: 'https://linkedin.com/in/alexdegryse', icon: Briefcase },
]

/**
 * A personal note from the team (db/personal_outreach.sql), shown ONCE, full
 * screen, the next time the student opens the app.
 *
 * It holds for a few seconds before it can be closed, because the whole point
 * is that it is written to them and not a banner to swipe past. The answer box
 * replies on the support ticket the same note opened, so their reply lands in
 * our inbox (and alerts us) like any other. They can also answer later from
 * Messages: the ticket stays there either way.
 */
export function OutreachPopup() {
  const { user } = useAuth()
  const [popup, setPopup] = useState<Popup | null>(null)
  const [left, setLeft] = useState(0)
  const [text, setText] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  useEffect(() => {
    if (!user) return
    let alive = true
    void supabase
      .from('outreach_popups')
      .select('id, ticket_id, title, body, min_seconds')
      .is('seen_at', null)
      .order('created_at')
      .limit(1)
      .then(({ data }) => {
        const row = (data?.[0] as Popup | undefined) ?? null
        if (alive && row) {
          setPopup(row)
          setLeft(row.min_seconds)
        }
      })
    return () => {
      alive = false
    }
  }, [user])

  // The countdown that keeps it on screen long enough to be read.
  useEffect(() => {
    if (!popup || left <= 0) return
    const id = window.setTimeout(() => setLeft((n) => n - 1), 1000)
    return () => window.clearTimeout(id)
  }, [popup, left])

  if (!popup) return null
  const locked = left > 0

  async function close() {
    if (!popup || locked) return
    const id = popup.id
    setPopup(null)
    await supabase.rpc('seen_outreach_popup', { p_id: id })
  }

  async function send() {
    if (!popup?.ticket_id || !text.trim()) return
    setState('sending')
    const { error } = await supabase.rpc('reply_ticket', { p_ticket_id: popup.ticket_id, p_body: text.trim() })
    if (error) {
      setState('error')
      return
    }
    haptic('success')
    setState('sent')
    await supabase.rpc('seen_outreach_popup', { p_id: popup.id })
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={popup.title}
      className="ct-animate-fade fixed inset-0 z-[140] overflow-y-auto bg-canvas"
    >
      <div className="mx-auto flex min-h-full w-full max-w-xl flex-col px-5 py-[calc(2.5rem+env(safe-area-inset-top))] sm:py-16">
        <span className="ct-done-pop grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
          <Heart size={22} aria-hidden />
        </span>
        <p className="mt-5 text-[11.5px] font-semibold tracking-wide text-accent uppercase">
          A personal note, written just for you
        </p>
        <h1 className="mt-1.5 font-display text-[28px] leading-tight font-semibold text-balance text-fg">{popup.title}</h1>
        <div className="mt-4 text-[15px] leading-relaxed whitespace-pre-line text-muted">{popup.body}</div>

        {popup.ticket_id && state !== 'sent' && (
          <div className="mt-6">
            <label htmlFor="outreach-answer" className="mb-1.5 block text-[12.5px] font-medium text-fg">
              Your answers
            </label>
            <textarea
              id="outreach-answer"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder="Type here, even a couple of words helps."
              className="w-full resize-none rounded-xl border border-border bg-surface px-3.5 py-3 text-[16px] leading-relaxed text-fg outline-none focus:border-accent sm:text-[14px]"
            />
            {state === 'error' && (
              <p className="mt-1.5 text-[12.5px] text-danger">That did not send. Try again, or answer later in Messages.</p>
            )}
            <button
              type="button"
              onClick={() => void send()}
              disabled={!text.trim() || state === 'sending'}
              className="mt-2.5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-[14px] font-semibold text-accent-contrast disabled:opacity-40"
            >
              <Send size={15} aria-hidden /> {state === 'sending' ? 'Sending' : 'Send to the team'}
            </button>
          </div>
        )}
        {state === 'sent' && (
          <p className="mt-6 rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-[14px] font-medium text-fg">
            Got it, thank you. We will reply in Messages, under Support.
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          {SOCIALS.map((s) => (
            <a
              key={s.href}
              href={s.href}
              target={s.href.startsWith('http') ? '_blank' : undefined}
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[12.5px] text-muted hover:border-accent hover:text-fg"
            >
              <s.icon size={13} aria-hidden /> {s.label}
            </a>
          ))}
        </div>

        <div className="mt-auto pt-8">
          <button
            type="button"
            onClick={() => void close()}
            disabled={locked}
            className={cn(
              'w-full rounded-xl border border-border py-3 text-[14px] font-medium transition-colors',
              locked ? 'text-subtle' : 'text-fg hover:bg-surface-2',
            )}
          >
            {locked ? `You can close this in ${left}s` : state === 'sent' ? 'Close' : 'Close, I will answer later in Messages'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
