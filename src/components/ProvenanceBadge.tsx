import { BadgeCheck, CircleDashed, Users, type LucideIcon } from 'lucide-react'
import type { Provenance } from '@/data/types'
import { cn } from '@/lib/cn'

/** First-class provenance indicator — wherever a date appears, the student can
 * see how trustworthy it is. A per-status ICON (clearer at a glance than a bare
 * dot) + short label; `confirmed` shows the corroboration count. The full
 * meaning lives in the `title` tooltip. */
const META: Record<
  Provenance['status'],
  { label: string; icon: LucideIcon; text: string; tip: string }
> = {
  official: {
    label: 'Official',
    icon: BadgeCheck,
    text: 'text-prov-official',
    tip: 'From the course syllabus or registrar',
  },
  confirmed: {
    label: 'Confirmed',
    icon: Users,
    text: 'text-prov-confirmed',
    tip: 'Entered by a student and corroborated by classmates',
  },
  unverified: {
    label: 'Unverified',
    icon: CircleDashed,
    text: 'text-prov-unverified',
    tip: 'Entered by one student — not yet corroborated',
  },
}

export function ProvenanceBadge({
  provenance,
  className,
  tone = 'color',
}: {
  provenance: Provenance
  className?: string
  /** 'color' tints the label its status color; 'quiet' keeps the colored ICON
   * but neutralizes the label so dense rows don't turn into a rainbow. */
  tone?: 'color' | 'quiet'
}) {
  const meta = META[provenance.status]
  const Icon = meta.icon
  const count =
    provenance.status === 'confirmed' && provenance.confirmations
      ? ` · ${provenance.confirmations}`
      : ''
  return (
    <span
      title={meta.tip}
      className={cn(
        'inline-flex items-center gap-1 text-[11px] font-medium',
        tone === 'quiet' ? 'text-subtle' : meta.text,
        className,
      )}
    >
      <Icon size={12} className={cn('shrink-0', meta.text)} aria-hidden />
      {meta.label}
      {count}
    </span>
  )
}
