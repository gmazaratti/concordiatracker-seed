import { useId } from 'react'
import type { Course } from '@/data/types'
import { courseColor } from '@/lib/course-color'
import { courseGradient, courseIcon } from '@/lib/course-style'
import { cn } from '@/lib/cn'

/**
 * The small mark that says which class a row belongs to: the class's own icon
 * in its colour when it has one (and icons are on), otherwise the colour dot.
 * One component, so the due list, its course groups and the completed rows
 * cannot disagree about how a class looks.
 *
 * A GRADIENT CLASS GETS ITS GRADIENT HERE TOO. The banner and the grid card
 * read `course.gradient`; this mark used to read only the plain colour, so a
 * class recoloured to a gradient kept its old dot on Today. The dot paints the
 * same two stops as the banner, and the icon strokes through an SVG gradient
 * defined beside it (lucide passes `color` straight to `stroke`, so a
 * `url(#…)` reference works). The id comes from `useId`, so two rows of the
 * same class never share, and fight over, one definition.
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
  const gradId = useId().replace(/:/g, '')
  if (!course) return null
  const hex = courseColor(course.color).hex
  const grad = courseGradient(course.gradient)
  const def = icons ? courseIcon(course.icon) : null

  if (def) {
    if (!grad) {
      return (
        <def.icon size={12} strokeWidth={2.25} className={cn('shrink-0', className)} style={{ color: hex }} aria-hidden />
      )
    }
    return (
      <span className={cn('relative inline-grid shrink-0', className)} aria-hidden>
        <svg width="0" height="0" className="absolute" focusable="false">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={grad.from} />
              <stop offset="100%" stopColor={grad.to} />
            </linearGradient>
          </defs>
        </svg>
        <def.icon size={12} strokeWidth={2.25} color={`url(#${gradId})`} />
      </span>
    )
  }
  return (
    <span
      className={cn('size-2 shrink-0 rounded-full', className)}
      style={
        grad
          ? { backgroundImage: `linear-gradient(125deg, ${grad.from}, ${grad.to})` }
          : { backgroundColor: hex }
      }
      aria-hidden
    />
  )
}
