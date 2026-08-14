import { BadgeCheck, CircleDashed, Users, type LucideIcon } from 'lucide-react'
import type { Provenance } from '@/data/types'
import { cn } from '@/lib/cn'
import { useT } from '@/i18n/i18n'
import type { Key } from '@/i18n/en'

/** First-class provenance indicator — wherever a date appears, the student can
 * see how trustworthy it is. A per-status ICON (clearer at a glance than a bare
 * dot) + short label; `confirmed` shows the corroboration count. The full
 * meaning lives in the `title` tooltip. */
const META: Record<
  Provenance['status'],
  { labelKey: Key; icon: LucideIcon; text: string; tipKey: Key }
> = {
  official: {
    labelKey: 'prov.official',
    icon: BadgeCheck,
    text: 'text-prov-official',
    tipKey: 'prov.officialTip',
  },
  confirmed: {
    labelKey: 'prov.confirmed',
    icon: Users,
    text: 'text-prov-confirmed',
    tipKey: 'prov.confirmedTip',
  },
  unverified: {
    labelKey: 'prov.unverified',
    icon: CircleDashed,
    text: 'text-prov-unverified',
    tipKey: 'prov.unverifiedTip',
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
  const t = useT()
  const meta = META[provenance.status]
  const Icon = meta.icon
  const count =
    provenance.status === 'confirmed' && provenance.confirmations
      ? ` · ${provenance.confirmations}`
      : ''
  return (
    <span
      title={t(meta.tipKey)}
      className={cn(
        'inline-flex items-center gap-1 text-[11px] font-medium',
        tone === 'quiet' ? 'text-subtle' : meta.text,
        className,
      )}
    >
      <Icon size={12} className={cn('shrink-0', meta.text)} aria-hidden />
      {t(meta.labelKey)}
      {count}
    </span>
  )
}
