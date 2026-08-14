import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import { useT } from '@/i18n/i18n'

export interface TermGlanceData {
  termName: string
  gpa: number | null
  credits: number
  coursesGraded: number
  coursesTotal: number
  openItems: number
  overdue: number
}

/** Right-rail summary for the course list — the term seen from above. Mirrors
 * Today's glance visual language so the two screens read as one system. */
export function TermGlance(data: TermGlanceData) {
  const t = useT()
  return (
    <Card className="overflow-hidden">
      <p className="border-b border-border px-3.5 py-2.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">
        {t('courses.termStanding')}
      </p>
      <div className="border-b border-border px-3.5 py-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[12px] text-subtle">
            {data.termName} {t('courses.gpaSuffix')}
          </span>
          <span className="text-[12px] text-subtle">{t('today.creditsCount', { count: data.credits })}</span>
        </div>
        <div className="mt-0.5 font-display text-[28px] leading-none font-semibold text-fg">
          {data.gpa === null ? '—' : data.gpa.toFixed(2)}
          <span className="ml-1.5 text-[13px] font-normal text-subtle">/ 4.30</span>
        </div>
      </div>
      <div className="divide-y divide-border">
        <Row
          label={t('courses.coursesGraded')}
          value={t('courses.xOfY', { a: data.coursesGraded, b: data.coursesTotal })}
        />
        <Row label={t('courses.openItems')} value={String(data.openItems)} />
        <Row label={t('today.overdue')} value={String(data.overdue)} danger={data.overdue > 0} />
      </div>
    </Card>
  )
}

function Row({
  label,
  value,
  danger = false,
}: {
  label: string
  value: string
  danger?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3.5 py-2.5">
      <span className="text-[12px] text-subtle">{label}</span>
      <span
        className={cn(
          'text-[15px] leading-tight font-semibold',
          danger ? 'text-danger' : 'text-fg',
        )}
      >
        {value}
      </span>
    </div>
  )
}
