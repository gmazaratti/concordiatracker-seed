import { useMemo, useState } from 'react'
import { ChevronDown, Sparkles } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { useUiState } from '@/app/providers/ui-state'
import { useTypewriter } from '@/app/hooks/useTypewriter'
import { term } from '@/data/mock'
import { buildBriefing, focusOptions, type FocusId } from '@/lib/briefing'
import { termWorkload, workloadInsight } from '@/lib/workload'
import { COURSE_COLORS } from '@/lib/course-color'
import { StudyPlanModal } from './StudyPlanModal'
import { cn } from '@/lib/cn'

/**
 * The Debrief — ONE card at the top of Today that replaces the old separate
 * debrief + workload cards (and no longer repeats the due list sitting right
 * below it, which was most of the clutter).
 *
 * Reads top-down: the term's shape → what it means for you right now → what you
 * want to prioritise. Changing the focus genuinely recomputes the briefing from
 * your own data, and the text types in so you can see it land.
 */
export function DebriefPanel() {
  const { courses, assessments } = useAppData()
  const { uiState, patchUiState } = useUiState()
  const [focus, setFocus] = useState<FocusId>('balanced')
  const [planOpen, setPlanOpen] = useState(false)

  const collapsed = !!uiState.debriefCollapsed

  const weeks = useMemo(
    () => termWorkload(assessments, term.start, term.end),
    [assessments],
  )
  const insight = useMemo(() => workloadInsight(weeks, courses), [weeks, courses])
  const max = useMemo(() => Math.max(1, ...weeks.map((w) => w.weight)), [weeks])

  const options = useMemo(() => focusOptions(courses, assessments), [courses, assessments])
  const briefing = useMemo(
    () => buildBriefing(courses, assessments, focus, term.start, term.end),
    [courses, assessments, focus],
  )

  // Re-typed on every focus change → visible proof it recalculated.
  const main = useTypewriter(briefing.text, { speed: 11 })
  const detail = useTypewriter(briefing.detail, { speed: 8, delay: 260 })

  const hasChart = weeks.length > 0 && weeks.some((w) => w.weight > 0)
  if (!hasChart && assessments.length === 0) return null

  return (
    <>
      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-fg">Your term, week by week</h2>
            <p className="text-[11.5px] text-subtle">Workload by weight</p>
          </div>
          <button
            type="button"
            onClick={() => patchUiState({ debriefCollapsed: !collapsed })}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand debrief' : 'Collapse debrief'}
            className="grid size-7 shrink-0 place-items-center rounded-md text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <ChevronDown size={16} className={cn('transition-transform duration-200', collapsed && '-rotate-90')} aria-hidden />
          </button>
        </div>

        {!collapsed && (
          <>
            {/* Term shape: the chart they asked to lead with. */}
            {hasChart && (
              <>
                <div className="mt-4 flex items-end gap-1.5 sm:gap-2" style={{ height: 92 }} aria-hidden>
                  {weeks.map((w) => {
                    const isPeak = insight?.week === w.week
                    return (
                      <div key={w.week} className="flex h-full flex-1 flex-col justify-end">
                        <div
                          className={cn(
                            'w-full rounded-md transition-[height] duration-500',
                            isPeak ? 'bg-accent' : w.current ? 'bg-accent/45' : w.weight > 0 ? 'bg-accent/20' : 'bg-surface-2',
                          )}
                          style={{ height: `${Math.max(w.weight > 0 ? 6 : 3, (w.weight / max) * 100)}%` }}
                          title={`Week ${w.week}`}
                        />
                      </div>
                    )
                  })}
                </div>
                <div className="mt-1.5 flex gap-1.5 sm:gap-2">
                  {weeks.map((w) => (
                    <span
                      key={w.week}
                      className={cn(
                        'flex-1 text-center text-[10.5px] tabular-nums',
                        w.current ? 'font-semibold text-accent' : insight?.week === w.week ? 'text-fg' : 'text-subtle',
                      )}
                    >
                      {w.week}
                    </span>
                  ))}
                </div>
              </>
            )}

            {/* The briefing: types in on every recompute. */}
            <div className="mt-4 border-t border-border pt-3.5">
              <p
                className="min-h-[2.6rem] text-[13.5px] leading-relaxed text-fg"
                aria-live="polite"
              >
                {main.shown}
                {main.typing && <span className="ct-caret" aria-hidden />}
              </p>
              {briefing.detail && (
                <p className="mt-1 min-h-[1.2rem] text-[12.5px] leading-relaxed text-muted">
                  {detail.shown}
                </p>
              )}
            </div>

            {/* Focus picker: what the student wants to prioritise. */}
            <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
              <span className="mr-0.5 text-[11.5px] font-medium text-subtle">Prioritise:</span>
              {options.map((o) => {
                const active = o.id === focus
                const courseId = o.id.startsWith('course:') ? o.id.slice(7) : null
                const hex = courseId
                  ? COURSE_COLORS.find((c) => c.id === courses.find((x) => x.id === courseId)?.color)?.hex
                  : undefined
                return (
                  <button
                    key={o.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFocus(o.id)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors duration-150',
                      active
                        ? 'border-accent bg-accent-soft text-fg'
                        : 'border-border text-muted hover:border-border-strong hover:text-fg',
                    )}
                  >
                    {hex && <span className="size-1.5 rounded-full" style={{ backgroundColor: hex }} aria-hidden />}
                    {o.label}
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => setPlanOpen(true)}
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
              >
                <Sparkles size={14} aria-hidden />
                Plan my week
              </button>
            </div>
          </>
        )}
      </section>

      {planOpen && <StudyPlanModal onClose={() => setPlanOpen(false)} />}
    </>
  )
}
