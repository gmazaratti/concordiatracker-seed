import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { buildStudyPlan } from '@/lib/study-plan'
import { KIND_LABEL } from '@/lib/assessment'
import { relativeDueLabel } from '@/lib/date'
import { COURSE_COLORS } from '@/lib/course-color'
import { ModalShell } from '@/command/ModalShell'
import { Segmented } from '@/features/settings/controls'
import { cn } from '@/lib/cn'

const HORIZONS = [
  { value: '7', label: 'This week' },
  { value: '14', label: 'Two weeks' },
  { value: '30', label: 'This month' },
]

/**
 * "What should I work on?" — a ranked plan over the chosen horizon. The ordering
 * is real arithmetic (weight × urgency × how much the course can still move),
 * and every row shows WHY it's there, so it's checkable rather than magic.
 */
export function StudyPlanModal({ onClose }: { onClose: () => void }) {
  const { courses, assessments } = useAppData()
  const [horizon, setHorizon] = useState('14')

  const plan = useMemo(
    () => buildStudyPlan(courses, assessments, { horizonDays: Number(horizon), limit: 6 }),
    [courses, assessments, horizon],
  )

  return (
    <ModalShell label="Study plan" onClose={onClose} widthClass="sm:max-w-lg">
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
            <Sparkles size={18} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-[19px] leading-tight font-semibold text-fg">
              What to work on
            </h2>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{plan.headline}</p>
          </div>
        </div>

        <div className="mt-4">
          <Segmented value={horizon} onChange={setHorizon} options={HORIZONS} ariaLabel="Planning horizon" />
        </div>

        {plan.items.length === 0 ? (
          <p className="mt-5 rounded-xl border border-dashed border-border-strong px-4 py-8 text-center text-[13px] text-subtle">
            Nothing open in this window. Enjoy it — or get a head start on what&rsquo;s next.
          </p>
        ) : (
          <ol className="mt-4 space-y-2">
            {plan.items.map((item, i) => {
              const hex = COURSE_COLORS.find((c) => c.id === item.course?.color)?.hex
              const overdue = item.daysLeft < 0
              return (
                <li key={item.assessment.id} className="rounded-xl border border-border bg-surface p-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-[11.5px] font-bold text-muted tabular-nums">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: hex }} aria-hidden />
                        <span className="truncate text-[11.5px] font-medium text-subtle">
                          {item.course?.code ?? 'Course'} · {KIND_LABEL[item.assessment.kind]}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[13.5px] font-medium text-fg">
                        {item.assessment.title}
                      </p>
                      <p className="mt-0.5 text-[11.5px] text-subtle">
                        <span className={cn(overdue && 'font-medium text-danger')}>
                          {relativeDueLabel(item.assessment.due)}
                        </span>
                        {item.reasons.length > 0 && <> · {item.reasons.join(' · ')}</>}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[15px] font-semibold text-fg tabular-nums">{item.share}%</p>
                      <p className="text-[10.5px] text-subtle">of your time</p>
                    </div>
                  </div>
                  {/* Share bar — a visual read of the same number. */}
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${item.share}%` }} />
                  </div>
                </li>
              )
            })}
          </ol>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-[11px] leading-relaxed text-subtle">
            Ranked by weight × urgency × how much each class can still move.
          </p>
          <Link
            to="/app/courses"
            onClick={onClose}
            className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-accent hover:underline"
          >
            Courses
            <ArrowRight size={13} aria-hidden />
          </Link>
        </div>
      </div>
    </ModalShell>
  )
}
