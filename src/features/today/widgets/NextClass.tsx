import { GraduationCap, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAppData } from '@/app/providers/app-data'
import { courseColor } from '@/lib/course-color'
import { WidgetCard, WidgetEmpty } from './WidgetCard'
import { findNextClass, type UpcomingClass } from './meeting-times'

/**
 * The next class you actually have to walk to.
 *
 * Reads `course.meetingTimes`, which the app has always stored and never
 * surfaced anywhere except the course info panel. No new data, no new fetch —
 * this widget is entirely a matter of using what's already there.
 */

/** "in 25 min" / "in 3 h" / "Thu 10:15" — precise when it's close, calm when not. */
function whenLabel(next: UpcomingClass): string {
  if (next.inMinutes < 60) return `in ${next.inMinutes} min`
  if (next.today) return `in ${Math.round(next.inMinutes / 60)} h`
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return `${days[next.slot.day]} ${next.slot.start}`
}

export function NextClassWidget() {
  const { courses } = useAppData()
  const next = findNextClass(courses, new Date())

  return (
    <WidgetCard title="Next class" icon={GraduationCap}>
      {!next ? (
        <WidgetEmpty>
          Add meeting times to a course and the next one shows up here.
        </WidgetEmpty>
      ) : (
        <Link
          to={`/app/courses/${next.course.id}`}
          className="block px-3.5 py-3 transition-colors duration-150 hover:bg-surface-2/50"
        >
          <span className="flex items-center gap-2">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: courseColor(next.course.color).hex }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-fg">
              {next.course.code}
            </span>
            <span className="shrink-0 text-[12px] font-medium text-accent">{whenLabel(next)}</span>
          </span>
          <span className="mt-1 flex items-center gap-2 text-[11.5px] text-subtle">
            <span>
              {next.slot.start}–{next.slot.end}
            </span>
            {next.course.location && (
              <>
                <MapPin size={11} className="shrink-0" aria-hidden />
                <span className="truncate">{next.course.location}</span>
              </>
            )}
          </span>
        </Link>
      )}
    </WidgetCard>
  )
}
