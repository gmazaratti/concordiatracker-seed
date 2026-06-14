import type { Provenance } from '@/data/types'
import { cn } from '@/lib/cn'

/** First-class provenance indicator — wherever a date appears, the student can
 * see how trustworthy it is. A colored dot + short label; `confirmed` shows the
 * corroboration count. The full meaning lives in the `title` tooltip. */
const META: Record<
  Provenance['status'],
  { label: string; dot: string; text: string; tip: string }
> = {
  official: {
    label: 'Official',
    dot: 'bg-prov-official',
    text: 'text-prov-official',
    tip: 'From the course syllabus or registrar',
  },
  confirmed: {
    label: 'Confirmed',
    dot: 'bg-prov-confirmed',
    text: 'text-prov-confirmed',
    tip: 'Entered by a student and corroborated by classmates',
  },
  unverified: {
    label: 'Unverified',
    dot: 'bg-prov-unverified',
    text: 'text-prov-unverified',
    tip: 'Entered by one student — not yet corroborated',
  },
}

export function ProvenanceBadge({
  provenance,
  className,
}: {
  provenance: Provenance
  className?: string
}) {
  const meta = META[provenance.status]
  const count =
    provenance.status === 'confirmed' && provenance.confirmations
      ? ` · ${provenance.confirmations}`
      : ''
  return (
    <span
      title={meta.tip}
      className={cn(
        'inline-flex items-center gap-1.5 text-[11px] font-medium',
        meta.text,
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', meta.dot)} aria-hidden />
      {meta.label}
      {count}
    </span>
  )
}
