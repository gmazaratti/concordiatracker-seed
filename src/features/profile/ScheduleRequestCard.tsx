import { useEffect, useState } from 'react'
import { AlertTriangle, CalendarRange, Check, Loader2, X } from 'lucide-react'
import { useAuth } from '@/app/providers/auth'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/cn'

/**
 * "Can I see your schedule?", answered for THE PERSON WHO ASKED.
 *
 * Allow grants that one person access (db/account_deletion.sql →
 * schedule_grants, read by can_see_schedule / get_friend_schedule). It does
 * not touch "Let friends see my schedule" in Settings, which stays the switch
 * for everyone you have accepted. It used to be the only answer, so saying yes
 * to one person quietly said yes to all of them.
 *
 * The card reads the live grant, so it shows the truth if you revoke it later,
 * and "Stop sharing" is on the card as well as the grant.
 */
export function ScheduleRequestCard({ mine, bare, requester }: { mine: boolean; bare?: boolean; requester?: string }) {
  const { user } = useAuth()
  const [granted, setGranted] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user || !requester || mine) return
    let alive = true
    supabase
      .from('schedule_grants')
      .select('grantee')
      .eq('owner', user.id)
      .eq('grantee', requester)
      .maybeSingle()
      .then(({ data, error: e }) => {
        if (alive) setGranted(e ? false : !!data)
      })
    return () => {
      alive = false
    }
  }, [user, requester, mine])

  async function change(allow: boolean) {
    if (!requester || busy) return
    setBusy(true)
    setError('')
    const { data, error: e } = await supabase.rpc(allow ? 'grant_schedule' : 'revoke_schedule', { p_grantee: requester })
    setBusy(false)
    if (e || (allow && data !== true)) {
      setError(allow ? 'Could not share it. Try again.' : 'Could not stop sharing. Try again.')
      return
    }
    setGranted(allow)
    if (!allow) setDenied(false)
  }

  const shell = cn(
    'rounded-xl border bg-canvas p-3',
    !bare && 'mt-1.5',
    bare && 'w-[290px] max-w-full',
    granted ? 'border-success/40' : 'border-border',
  )

  // ── The sender's own copy: the decision is not theirs. ──────────────────
  if (mine) {
    return (
      <div className={shell}>
        <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-fg">
          <CalendarRange size={14} className="text-subtle" aria-hidden />
          You asked to see their schedule
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-subtle">
          They will see Allow or Deny here. If they allow it, their classes appear on their profile for you. You do not
          get a notification.
        </p>
      </div>
    )
  }

  if (granted) {
    return (
      <div className={shell}>
        <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-success">
          <Check size={14} aria-hidden />
          They can see your schedule
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-subtle">
          Only this person, and only times and rooms. Nobody else&rsquo;s access changed.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void change(false)}
          className="mt-2 rounded-lg border border-border px-2.5 py-1 text-[12px] font-medium text-muted hover:bg-surface-2 hover:text-fg disabled:opacity-50"
        >
          Stop sharing with them
        </button>
        {error && <p className="mt-1.5 text-[12px] text-danger">{error}</p>}
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
        <p className="mt-1 text-[12px] leading-relaxed text-subtle">Nothing was shared and they were not told.</p>
      </div>
    )
  }

  return (
    <div className={shell}>
      <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-fg">
        <CalendarRange size={14} className="text-accent" aria-hidden />
        They are asking to see your schedule
      </p>
      <ul className="mt-2 space-y-1 text-[12px] leading-relaxed text-muted">
        <li>
          They would see <strong className="font-medium text-fg">when and where your classes meet</strong>: times and
          rooms.
        </li>
        <li>
          <strong className="font-medium text-fg">Never your grades</strong>, your assignments or anything else.
        </li>
        <li>
          Allowing shares it with <strong className="font-medium text-fg">this person only</strong>. You can stop any
          time from this card.
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
          disabled={busy || granted === null || !requester}
          onClick={() => void change(true)}
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
