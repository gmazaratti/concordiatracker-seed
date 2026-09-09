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
  /**
   * Every graded course on record, this term included.
   *
   * The term figure alone answers "how is this semester going" and nothing
   * else — and the number a student is actually asked for, on an application or
   * by a parent, is the cumulative one. Showing only the term GPA in a panel
   * headed "Term standing" was defensible; leaving the overall one with
   * nowhere to live was not.
   */
  overallGpa: number | null
  overallCredits: number
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
      <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
        <Gpa
          label={`${data.termName} ${t('courses.gpaSuffix')}`}
          credits={t('today.creditsCount', { count: data.credits })}
          gpa={data.gpa}
        />
        <Gpa
          label="Overall"
          credits={t('today.creditsCount', { count: data.overallCredits })}
          gpa={data.overallGpa}
          quiet
        />
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

/** One GPA, with the credits it is computed over — because a 4.0 across six
 *  credits and a 4.0 across ninety are not the same claim. */
function Gpa({
  label,
  credits,
  gpa,
  quiet = false,
}: {
  label: string
  credits: string
  gpa: number | null
  quiet?: boolean
}) {
  return (
    <div className="px-3.5 py-3">
      <p className="truncate text-[12px] text-subtle">{label}</p>
      <p
        className={cn(
          'mt-0.5 font-display leading-none font-semibold text-fg',
          quiet ? 'text-[22px]' : 'text-[26px]',
        )}
      >
        {gpa === null ? '—' : gpa.toFixed(2)}
        <span className="ml-1 text-[12px] font-normal text-subtle">/ 4.30</span>
      </p>
      <p className="mt-1 text-[11px] text-subtle">{credits}</p>
    </div>
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
