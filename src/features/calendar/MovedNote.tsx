import { useState } from 'react'
import { ArrowRight, CalendarClock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatMonthDay } from '@/lib/date'

/**
 * "Moodle moved this."
 *
 * The alternative was letting the sync rewrite the date in place, which is the
 * version that quietly costs someone a deadline: they remember the twelfth,
 * they glance at the calendar, it says the nineteenth, and there is nothing to
 * tell them whether the professor moved it or they misread it in the first
 * place. Showing BOTH dates makes it a fact they can act on.
 *
 * It is dismissed, not decided. Moodle is the professor's own system, so the
 * new date is not a suggestion to accept or reject — it is what is true now.
 * What the student needs is to have SEEN it, which is what "Got it" records.
 * (A peer's proposed change is a different thing and keeps its Update/Dismiss
 * pair, because there the crowd might be wrong.)
 */
export function MovedNote({ id, from, to }: { id: string; from: string; to: string }) {
  const [gone, setGone] = useState(false)
  const [busy, setBusy] = useState(false)
  if (gone) return null

  async function ack() {
    if (busy) return
    setBusy(true)
    // Optimistic: the note is an FYI, so a failed write costs one repeat
    // sighting tomorrow. Blocking the dismissal on the network would be worse.
    setGone(true)
    await supabase.rpc('ack_todo_move', { p_id: id })
  }

  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-md bg-warning/10 px-2 py-1 text-[11px] text-fg">
      <CalendarClock size={12} className="shrink-0 text-warning" aria-hidden />
      <span className="font-medium">Moodle moved this</span>
      <span className="text-subtle line-through">{formatMonthDay(new Date(from))}</span>
      <ArrowRight size={11} className="shrink-0 text-subtle" aria-hidden />
      <span className="font-medium">{formatMonthDay(new Date(to))}</span>
      <button
        type="button"
        onClick={() => void ack()}
        className="ml-auto rounded px-1.5 py-0.5 font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg"
      >
        Got it
      </button>
    </p>
  )
}
