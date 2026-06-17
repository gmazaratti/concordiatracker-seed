import { ArrowRight, Users } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { useQuickActions } from '@/app/providers/quick-actions'

/** A calm, discoverable entry to the peer-correction flow on the launch view: one
 * line if classmates have moved any of your imported dates. Opens the first
 * suggestion (the full prompt lives in the edit modal). */
export function PeerNudge() {
  const { peerCorrections } = useAppData()
  const { openAssessment } = useQuickActions()
  if (peerCorrections.length === 0) return null

  const n = peerCorrections.length
  const first = peerCorrections[0]

  return (
    <button
      type="button"
      onClick={() => openAssessment(first.assessmentId)}
      className="group flex w-full items-center gap-2.5 rounded-xl border border-accent/30 bg-accent-soft px-3.5 py-2.5 text-left transition-colors duration-150 hover:border-accent/50"
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent">
        <Users size={15} aria-hidden />
      </span>
      <span className="min-w-0 flex-1 text-[13px] text-fg">
        <span className="font-medium">
          {n} classmate date {n === 1 ? 'change' : 'changes'} to review
        </span>
        <span className="text-muted"> — your section moved some deadlines.</span>
      </span>
      <ArrowRight
        size={15}
        className="shrink-0 text-accent transition-transform duration-150 group-hover:translate-x-0.5"
        aria-hidden
      />
    </button>
  )
}
