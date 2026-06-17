import { ArrowRight, Check, Users } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { correctionStrength, type PeerCorrection } from '@/data/peer-corrections'
import { formatFull } from '@/lib/date'
import { cn } from '@/lib/cn'

const STRENGTH = {
  strong: { label: 'Strong signal', bars: 3, text: 'text-success', bar: 'bg-success' },
  medium: { label: 'Worth a look', bars: 2, text: 'text-info', bar: 'bg-info' },
  weak: { label: 'Early signal', bars: 1, text: 'text-muted', bar: 'bg-border-strong' },
} as const

const BAR_HEIGHTS = ['h-2', 'h-2.5', 'h-3']

/** The "Waze for academics" prompt: the crowd moved an imported date, so it's
 * SUGGESTED to you — never applied automatically. The raw count ("N of M
 * classmates") and a strength meter are shown honestly, so a one-person change
 * reads as thin and a clear majority reads as strong. */
export function PeerSuggestion({
  correction,
  onApplied,
}: {
  correction: PeerCorrection
  /** When embedded in the edit modal, sync the date field to the accepted date. */
  onApplied?: (proposedDue: string) => void
}) {
  const { assessments, courseById, applyPeerCorrection, dismissPeerCorrection } = useAppData()
  const a = assessments.find((x) => x.id === correction.assessmentId)
  if (!a) return null
  const course = courseById(a.courseId)
  const meta = STRENGTH[correctionStrength(correction)]
  const { changedCount: n, sectionSize: m } = correction

  function update() {
    if (!a) return
    applyPeerCorrection(a.id)
    onApplied?.(correction.proposedDue)
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-3.5">
      <div className="flex items-center gap-2">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
          <Users size={15} aria-hidden />
        </span>
        <span className="text-[12px] font-semibold text-fg">Peer suggestion</span>
        <span className={cn('ml-auto inline-flex items-center gap-1.5 text-[11px] font-medium', meta.text)}>
          <span className="flex items-end gap-0.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={cn('w-1 rounded-full', BAR_HEIGHTS[i], i < meta.bars ? meta.bar : 'bg-border')}
              />
            ))}
          </span>
          {meta.label}
        </span>
      </div>

      <p className="mt-2 text-[13px] leading-snug text-fg">
        <span className="font-semibold">
          {n} of {m} classmates
        </span>
        {course && (
          <span className="text-muted">
            {' '}
            in {course.code} · section {course.section}
          </span>
        )}{' '}
        moved <span className="font-medium">“{a.title}”</span>:
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
        <span className="text-subtle line-through">{formatFull(a.due)}</span>
        <ArrowRight size={13} className="text-subtle" aria-hidden />
        <span className="rounded-md bg-accent-soft px-2 py-0.5 font-semibold text-accent">
          {formatFull(correction.proposedDue)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={update}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
        >
          <Check size={14} aria-hidden />
          Update yours
        </button>
        <button
          type="button"
          onClick={() => dismissPeerCorrection(a.id)}
          className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
        >
          Dismiss
        </button>
        <span className="ml-auto text-[11px] text-subtle">You decide — nothing changes automatically.</span>
      </div>
    </div>
  )
}
