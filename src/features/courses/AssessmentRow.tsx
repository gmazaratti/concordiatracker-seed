import type { Assessment, AssessmentStatus } from '@/data/types'
import { ProvenanceBadge } from '@/components/ProvenanceBadge'
import { useAppData } from '@/app/providers/app-data'
import { STATUS_META } from '@/lib/status'
import { KIND_LABEL } from '@/lib/assessment'
import { gradeToPercent } from '@/lib/grade'
import { percentToGrade } from '@/lib/gpa'
import { daysUntil, relativeDueLabel } from '@/lib/date'
import { cn } from '@/lib/cn'
import { GradeInput } from './GradeInput'

/** Order the status menu reads top-to-bottom — lifecycle, not alphabetical. */
const STATUS_ORDER: AssessmentStatus[] = [
  'not-started',
  'awaiting-grade',
  'done',
  'late',
  'extension',
  'missed',
]

function dueTone(due: string): string {
  const days = daysUntil(due)
  if (days < 0) return 'text-danger'
  if (days === 0) return 'text-warning'
  return 'text-subtle'
}

/** One row of the course grade editor. In the Grades tab it owns the full write
 * surface — status (all six), and a grade in either entry form; in the Notes tab
 * it's a free-form note. Every row carries its date's provenance, first-class. */
export function AssessmentRow({
  assessment,
  tab,
}: {
  assessment: Assessment
  tab: 'grades' | 'notes'
}) {
  const { setStatus, setGrade, setNotes } = useAppData()
  const meta = STATUS_META[assessment.status]
  const pct = gradeToPercent(assessment.grade)
  const resolved = pct === null ? null : percentToGrade(pct)

  return (
    <div className="px-3.5 py-3">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2.5">
        <div className="min-w-0 flex-1 basis-[200px]">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-muted">
              {KIND_LABEL[assessment.kind]}
            </span>
            <span className="text-[14px] text-fg">{assessment.title}</span>
            <span className="text-[12px] text-subtle">· {assessment.weight}%</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px]">
            <span className={cn('font-medium', dueTone(assessment.due))}>
              {relativeDueLabel(assessment.due)}
            </span>
            <ProvenanceBadge provenance={assessment.provenance} />
          </div>
        </div>

        {tab === 'grades' ? (
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor={`status-${assessment.id}`}>
              Status for {assessment.title}
            </label>
            <div className="relative">
              <span
                className={cn(
                  'pointer-events-none absolute top-1/2 left-2.5 size-1.5 -translate-y-1/2 rounded-full',
                  meta.dot,
                )}
                aria-hidden
              />
              <select
                id={`status-${assessment.id}`}
                value={assessment.status}
                onChange={(e) =>
                  setStatus(assessment.id, e.target.value as AssessmentStatus)
                }
                className="appearance-none rounded-md border border-border-strong bg-surface-2 py-1 pr-6 pl-6 text-[12px] font-medium text-fg focus-visible:outline-none"
              >
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_META[s].label}
                  </option>
                ))}
              </select>
            </div>

            <GradeInput
              grade={assessment.grade}
              onChange={(g) => setGrade(assessment.id, g)}
            />

            <span className="w-14 shrink-0 text-right text-[12px] font-medium tabular-nums">
              {resolved ? (
                <span className="text-fg">
                  {resolved.letter}
                  <span className="text-subtle"> · {resolved.points.toFixed(1)}</span>
                </span>
              ) : (
                <span className="text-subtle">—</span>
              )}
            </span>
          </div>
        ) : (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 text-[11px] font-medium',
              meta.text,
            )}
          >
            <span className={cn('size-1.5 rounded-full', meta.dot)} aria-hidden />
            {meta.label}
          </span>
        )}
      </div>

      {tab === 'notes' && (
        <textarea
          value={assessment.notes}
          onChange={(e) => setNotes(assessment.id, e.target.value)}
          placeholder="Add a note — what to review, where you lost marks, prof's feedback…"
          rows={2}
          className="mt-2 w-full resize-y rounded-lg border border-border bg-surface-2 px-2.5 py-2 text-[13px] text-fg placeholder:text-subtle focus-visible:border-border-strong focus-visible:outline-none"
        />
      )}
    </div>
  )
}
