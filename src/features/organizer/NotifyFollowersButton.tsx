import { useEffect, useState } from 'react'
import { Bell, Check, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'

type State =
  | { kind: 'loading' }
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; recipients: number; at: string }
  | { kind: 'empty' }
  | { kind: 'error'; message: string }

const fmt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

/**
 * "Notify followers" on a published event, for real (db/event_notify.sql).
 *
 * The server decides who may send (the club's owner or an admin), sends one
 * in-app notification per follower through the same audience club posts use
 * (their notification setting respected), and records it ONCE per event, so a
 * double-click or a retry answers "already sent" instead of sending twice.
 * Only a count ever comes back. There is no Revert: a sent notification
 * cannot be unsent, and "revert to send again" was a duplicate-send button.
 *
 * `demo` keeps the portal's sandbox a sandbox: nothing is sent.
 */
export function NotifyFollowersButton({
  eventId,
  disabled,
  disabledReason,
  demo,
}: {
  eventId: string
  disabled?: boolean
  disabledReason?: string
  demo?: boolean
}) {
  const [state, setState] = useState<State>(demo ? { kind: 'idle' } : { kind: 'loading' })

  useEffect(() => {
    if (demo) return
    let alive = true
    void supabase.rpc('event_notify_status', { p_event: eventId }).then(({ data }) => {
      if (!alive) return
      const d = data as { status?: string; sent_at?: string; recipients?: number } | null
      setState(d?.status === 'sent' ? { kind: 'sent', recipients: d.recipients ?? 0, at: d.sent_at ?? '' } : { kind: 'idle' })
    })
    return () => {
      alive = false
    }
  }, [eventId, demo])

  async function send() {
    if (state.kind === 'sending') return
    if (demo) {
      setState({ kind: 'sent', recipients: 0, at: new Date().toISOString() })
      return
    }
    setState({ kind: 'sending' })
    const { data, error } = await supabase.rpc('notify_event_followers', { p_event: eventId })
    if (error) {
      setState({ kind: 'error', message: error.message || 'That did not send. Try again.' })
      return
    }
    const d = data as { status: string; recipients?: number; sent_at?: string }
    if (d.status === 'no_audience') setState({ kind: 'empty' })
    else setState({ kind: 'sent', recipients: d.recipients ?? 0, at: d.sent_at ?? new Date().toISOString() })
  }

  if (state.kind === 'loading') {
    return <Loader2 size={16} className="animate-spin text-subtle" aria-label="Checking whether followers were notified" />
  }
  if (state.kind === 'sent') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-success/40 bg-success/10 px-2.5 py-1.5 text-[12px] font-medium text-success" role="status">
        <Check size={14} aria-hidden />
        {demo
          ? 'Followers notified (sandbox: nothing sent)'
          : `Sent to ${state.recipients} follower${state.recipients === 1 ? '' : 's'}${state.at ? ` · ${fmt(state.at)}` : ''}`}
      </span>
    )
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={disabled || state.kind === 'sending'}
        title={disabled ? disabledReason : undefined}
        onClick={() => void send()}
      >
        {state.kind === 'sending' ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Bell size={14} aria-hidden />}
        {state.kind === 'sending' ? 'Sending…' : 'Notify followers'}
      </Button>
      {state.kind === 'empty' && (
        <span className="text-[12px] text-subtle" role="status">No followers to notify yet. Try again once people follow your club.</span>
      )}
      {state.kind === 'error' && (
        <span className="text-[12px] text-danger" role="alert">{state.message}</span>
      )}
    </span>
  )
}
