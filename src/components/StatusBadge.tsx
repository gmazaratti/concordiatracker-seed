import type { AssessmentStatus } from '@/data/types'
import { STATUS_META } from '@/lib/status'
import { cn } from '@/lib/cn'

export function StatusBadge({
  status,
  className,
}: {
  status: AssessmentStatus
  className?: string
}) {
  const meta = STATUS_META[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[11px] font-medium',
        meta.text,
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', meta.dot)} aria-hidden />
      {meta.label}
    </span>
  )
}
