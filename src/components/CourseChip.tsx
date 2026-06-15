import { courseColor, withAlpha } from '@/lib/course-color'
import { cn } from '@/lib/cn'

/** The course-code chip in its class's identity color — the single colored-chip
 * primitive shared across Today, the command palette, and quick-action popups so
 * one color system reads everywhere. Fixed-hex per class (not theme tokens). */
export function CourseChip({
  code,
  color,
  className,
}: {
  code: string
  color: string
  className?: string
}) {
  const { hex } = courseColor(color)
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[11px] font-semibold tracking-wide',
        className,
      )}
      style={{ backgroundColor: withAlpha(hex, 0.16), color: hex }}
    >
      {code}
    </span>
  )
}
