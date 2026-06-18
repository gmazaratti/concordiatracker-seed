import { ChevronRight, ShieldCheck } from 'lucide-react'
import type { Course } from '@/data/types'
import { blueprintsForCourse } from '@/data/blueprints'
import { useTeacher } from '@/app/providers/teacher'
import { courseColor } from '@/lib/course-color'
import { cn } from '@/lib/cn'

/** Shown until a course is chosen: the student's courses, filtered live by the
 * search, each with how many blueprints exist — so the browser stays scoped to a
 * course instead of an endless global feed. */
export function BlueprintCoursePicker({
  courses,
  query,
  onPick,
}: {
  courses: Course[]
  query: string
  onPick: (id: string) => void
}) {
  const { publishedBlueprints, absorbedBlueprintIds } = useTeacher()
  const q = query.trim().toLowerCase()
  const matches = q
    ? courses.filter(
        (c) => c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q),
      )
    : courses

  return (
    <div>
      <p className="mb-2 px-1 text-[11px] font-semibold tracking-wide text-subtle uppercase">
        {q ? 'Matching courses' : 'Your courses'}
      </p>

      {matches.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface px-4 py-8 text-center text-[13px] text-subtle">
          No course matches “{query}”. Try a code like “COMP 248”.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {matches.map((c) => {
            const bps = [
              ...blueprintsForCourse(c.id).filter((b) => !absorbedBlueprintIds.includes(b.id)),
              ...publishedBlueprints.filter((b) => b.courseId === c.id),
            ]
            const hasTeacher = bps.some((b) => b.teacherVerified)
            const { hex } = courseColor(c.color)
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onPick(c.id)}
                  className="group flex w-full items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left transition-colors duration-150 hover:border-border-strong hover:bg-surface-2"
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: hex }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-[14px] font-medium text-fg">{c.code}</span>
                      <span className="truncate text-[12px] text-subtle">{c.title}</span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {hasTeacher && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-accent">
                        <ShieldCheck size={12} aria-hidden />
                        Verified
                      </span>
                    )}
                    <span
                      className={cn(
                        'text-[12px]',
                        bps.length > 0 ? 'text-muted' : 'text-subtle',
                      )}
                    >
                      {bps.length > 0
                        ? `${bps.length} blueprint${bps.length === 1 ? '' : 's'}`
                        : 'None yet'}
                    </span>
                    <ChevronRight
                      size={16}
                      className="text-subtle transition-transform duration-150 group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
