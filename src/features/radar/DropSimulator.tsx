import { RotateCcw } from 'lucide-react'
import type { Course } from '@/data/types'
import { courseColor } from '@/lib/course-color'
import { cn } from '@/lib/cn'

/**
 * "What if I dropped this one?"
 *
 * The question every student asks in week eight, and the one nothing in the
 * product could answer. Switching a course off here re-runs the entire radar
 * without it: the term strip reshapes, the collisions recalculate, and — the
 * part that makes it honest rather than a toy — the consequences of dropping
 * show up in the same feed. Take yourself under twelve credits and the
 * full-time warning appears immediately, next to the crunch it relieved.
 *
 * That loop is the whole argument for this page existing. A workload tool that
 * only shows you the pain tells you to drop something. One that also shows you
 * what dropping costs lets you actually decide.
 */
export function DropSimulator({
  courses,
  excluded,
  onToggle,
  onReset,
}: {
  courses: Course[]
  excluded: Set<string>
  onToggle: (id: string) => void
  onReset: () => void
}) {
  if (courses.length === 0) return null
  const simulating = excluded.size > 0

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-[16px] font-semibold text-fg">What if you dropped one?</h4>
        {simulating && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent transition-colors duration-150 hover:underline"
          >
            <RotateCcw size={11} aria-hidden />
            Back to your real term
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {courses.map((course) => {
          const off = excluded.has(course.id)
          return (
            <button
              key={course.id}
              type="button"
              onClick={() => onToggle(course.id)}
              aria-pressed={off}
              title={off ? `Put ${course.code} back` : `See the term without ${course.code}`}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[13.5px] font-medium transition-colors duration-150',
                off
                  ? 'border-dashed border-border text-subtle line-through'
                  : 'border-border bg-canvas text-fg hover:border-accent',
              )}
            >
              <span
                className={cn('size-2 shrink-0 rounded-full', off && 'opacity-30')}
                style={{ backgroundColor: courseColor(course.color).hex }}
                aria-hidden
              />
              {course.code || 'Untitled'}
            </button>
          )
        })}
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-muted">
        {simulating
          ? 'Everything above is now showing the term without it, including anything dropping it would cost you. Nothing has changed in your account.'
          : 'Switch one off to see the rest of the term without it. This changes nothing: it is a question, not an action.'}
      </p>
    </div>
  )
}
