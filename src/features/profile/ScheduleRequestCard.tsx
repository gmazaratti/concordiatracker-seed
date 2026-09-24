import { useEffect, useState } from 'react'
import { AlertTriangle, CalendarRange, Check, Loader2, X } from 'lucide-react'
import { useAuth } from '@/app/providers/auth'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/cn'

/**
 * "Can I see your schedule?" — rendered as a decision, not a set of directions.
 *
 * It used to send a sentence telling the other person which settings screen to
 * go and find. That asks somebody to go hunting for a switch on the word of
 * someone who wants something from them, and it puts the explanation of what
 * they would be sharing in a place they have to navigate to. The prompt goes
 * where the question is, with its limits written on it.
 *
 * THERE IS NO REQUEST RECORD. The answer is the `schedule_visibility` setting
 * that already exists, so this card reads live state rather than keeping a
 * second copy that can drift out of step with the switch in Settings — and
 * changing your mind later is that same switch, not an undo of this card.
 *
 * Which means: Allow is not "allow this person". It turns on "friends can see
 * my schedule", and the card says so, because a button that quietly does more
 * than its label is the one thing this screen cannot do.
 */
export function ScheduleRequestCard({ mine, bare }: { mine: boolean; bare?: boolean }) {
  const { user } = useAuth()
  const [visible, setVisible] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    let alive = true
    void supabase
      .from('user_profile')
      .select('schedule_visibility')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return
        setVisible((data as { schedule_visibility?: string } | null)?.schedule_visibility === 'friends')
      })
    return () => {
      alive = false
    }
  }, [user])

  async function allow() {
    if (!user || busy) return
    setBusy(true)
    setError('')
    const { error: e } = await supabase
      .from('user_profile')
      .update({ schedule_visibility: 'friends' })
      .eq('user_id', user.id)
    setBusy(false)
    if (e) {
      setError('Could not turn that on. Try again, or use Settings → Privacy.')
      return
    }
    setVisible(true)
  }

  const shell = cn(
    'rounded-xl border bg-canvas p-3',
    !bare && 'mt-1.5',
    bare && 'w-[290px] max-w-full',
    visible ? 'border-success/40' : 'border-border',
  )

  // ── The sender's own copy ─────────────────────────────────────────────────
  // They must not see Allow/Deny: the decision is not theirs, and a disabled
  // pair of buttons would only make it look like it might be.
  if (mine) {
    return (
      <div className={shell}>
        <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-fg">
          <CalendarRange size={14} className="text-subtle" aria-hidden />
          You asked to see their schedule
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-subtle">
          They will see Allow or Deny here. If they allow it, their classes appear on their
          profile. You do not get a notification.
        </p>
      </div>
    )
  }

  // ── The recipient's copy ──────────────────────────────────────────────────
  if (visible) {
    return (
      <div className={shell}>
        <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-success">
          <Check size={14} aria-hidden />
          Your friends can see your schedule
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-subtle">
          Times and rooms only. Turn it off any time in Settings → Privacy.
        </p>
      </div>
    )
  }

  if (denied) {
    return (
      <div className={shell}>
        <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-muted">
          <X size={14} className="text-subtle" aria-hidden />
          You kept your schedule private
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-subtle">
          Nothing was shared and they were not told. You can change this any time.
        </p>
      </div>
    )
  }

  return (
    <div className={shell}>
      <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-fg">
        <CalendarRange size={14} className="text-accent" aria-hidden />
        They are asking to see your schedule
      </p>

      {/* The limits are on the card, not behind a link. This is the moment the
          decision is made, so it is the only place the detail is worth reading. */}
      <ul className="mt-2 space-y-1 text-[12px] leading-relaxed text-muted">
        <li>
          They would see <strong className="font-medium text-fg">when and where your classes meet</strong>:
          times and rooms.
        </li>
        <li>
          <strong className="font-medium text-fg">Never your grades</strong>, your assignments or
          anything else.
        </li>
        <li>
          Allowing turns on{' '}
          <strong className="font-medium text-fg">&ldquo;Let friends see my schedule&rdquo;</strong>,
          so it applies to everyone you have accepted, not just them.
        </li>
      </ul>

      {error && (
        <p className="mt-2 flex items-start gap-1.5 text-[12px] text-danger">
          <AlertTriangle size={13} className="mt-px shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      )}

      <div className="mt-2.5 flex gap-2">
        <button
          type="button"
          disabled={busy || visible === null}
          onClick={() => void allow()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy && <Loader2 size={13} className="animate-spin" aria-hidden />}
          Allow
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setDenied(true)}
          className="rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-50"
        >
          Deny
        </button>
      </div>
    </div>
  )
}
