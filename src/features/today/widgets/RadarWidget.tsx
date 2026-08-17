import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CheckCircle2, Eye } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { ACADEMIC_CALENDAR } from '@/data/academic-calendar'
import { loadAcademicProfile } from '@/lib/academic-record'
import { radarSummary, runRadar } from '@/features/radar/rules'
import { cn } from '@/lib/cn'
import { WidgetCard } from './WidgetCard'

/**
 * The radar's headline, on Today.
 *
 * The whole point of a warning system is that you do not have to remember to go
 * and look at it. This shows the single worst thing and nothing else — a widget
 * that lists five problems is a second due list, and Today already has one of
 * those.
 */
export function RadarWidget() {
  const { courses, pastCourses, assessments } = useAppData()
  const [recordComplete, setRecordComplete] = useState(false)

  useEffect(() => {
    let alive = true
    void loadAcademicProfile()
      .then((p) => alive && setRecordComplete(p.recordComplete))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const now = useMemo(() => new Date(), [])
  const signals = useMemo(
    () =>
      runRadar({
        now,
        courses,
        pastCourses,
        assessments,
        calendar: ACADEMIC_CALENDAR,
        recordComplete,
      }),
    [now, courses, pastCourses, assessments, recordComplete],
  )

  const summary = radarSummary(signals)
  const top = signals[0]
  const Icon =
    summary.severity === 'clear'
      ? CheckCircle2
      : summary.severity === 'watch'
        ? Eye
        : AlertTriangle
  const tone =
    summary.severity === 'critical'
      ? 'text-danger'
      : summary.severity === 'warning'
        ? 'text-warning'
        : summary.severity === 'watch'
          ? 'text-info'
          : 'text-success'

  return (
    <WidgetCard title="Radar">
      <Link to="/app/radar" className="group block">
        <span className="flex items-start gap-2">
          <Icon size={15} className={cn('mt-0.5 shrink-0', tone)} aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-[12.5px] leading-snug font-medium text-fg">
              {top ? top.title : 'Nothing on the radar'}
            </span>
            <span className="mt-0.5 block text-[11.5px] text-subtle">
              {top && signals.length > 1
                ? `and ${signals.length - 1} more to look at`
                : top
                  ? 'Tap for what it means'
                  : 'No collisions, no deadlines closing'}
            </span>
          </span>
        </span>
        <span className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-medium text-accent group-hover:underline">
          Open radar
          <ArrowRight size={11} aria-hidden />
        </span>
      </Link>
    </WidgetCard>
  )
}
