import { Link } from 'react-router-dom'
import { LayoutGrid } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { courseColor } from '@/lib/course-color'
import { WidgetCard, WidgetEmpty } from './WidgetCard'

/** Every course, one tap away — the identity colours make it scannable without
 * reading. Wraps, so it works as a narrow rail card or a wide band. */
export function CourseShortcutsWidget() {
  const { courses } = useAppData()

  return (
    <WidgetCard title="Courses" icon={LayoutGrid}>
      {courses.length === 0 ? (
        <WidgetEmpty>No courses yet.</WidgetEmpty>
      ) : (
        <div className="flex flex-wrap gap-1.5 px-3.5 py-3">
          {courses.map((c) => (
            <Link
              key={c.id}
              to={`/app/courses/${c.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1 text-[12px] font-medium text-fg transition-colors duration-150 hover:border-border-strong hover:bg-surface-2"
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: courseColor(c.color).hex }}
                aria-hidden
              />
              {c.code || 'New course'}
            </Link>
          ))}
        </div>
      )}
    </WidgetCard>
  )
}
