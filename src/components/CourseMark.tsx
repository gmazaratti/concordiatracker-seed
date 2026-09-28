import type { Course } from '@/data/types'
import { courseColor } from '@/lib/course-color'
import { courseIcon } from '@/lib/course-style'
import { cn } from '@/lib/cn'

/**
 * The small mark that says which class a row belongs to: the class's own icon
 * in its colour when it has one (and icons are on), otherwise the colour dot.
 * One component, so the due list, its course groups and the completed rows
 * cannot disagree about how a class looks.
 */
export function CourseMark({
  course,
  icons = true,
  className,
}: {
  course: Course | undefined
  /** Today's "Class icons" preference. */
  icons?: boolean
  className?: string
}) {
  if (!course) return null
  const hex = courseColor(course.color).hex
  const def = icons ? courseIcon(course.icon) : null
  if (def) {
    return <def.icon size={12} strokeWidth={2.25} className={cn('shrink-0', className)} style={{ color: hex }} aria-hidden />
  }
  return <span className={cn('size-2 shrink-0 rounded-full', className)} style={{ backgroundColor: hex }} aria-hidden />
}
