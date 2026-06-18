import { useState } from 'react'
import { ChevronDown, Download, ShieldCheck, ThumbsUp } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import { blueprintWeight, blueprintsForCourse, netVotes } from '@/data/blueprints'
import { term } from '@/data/mock'
import type { TeacherCourse } from '@/data/teacher'
import { KIND_LABEL } from '@/lib/assessment'
import { formatDueDateTime } from '@/lib/date'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

/** Student-submitted blueprints for the teacher's section. Each expands to REVIEW
 * its assessments before verifying; verifying adopts those dates as the teacher's
 * PUBLISHED outline (it becomes the verified pin, authored by them) and removes
 * the original from the community pool. */
export function CommunityBlueprintsPanel({
  course,
  disabled,
}: {
  course: TeacherCourse
  disabled: boolean
}) {
  const { absorbedBlueprintIds, verifyCommunityBlueprint } = useTeacher()
  const [openId, setOpenId] = useState<string | null>(null)

  const community = blueprintsForCourse(course.courseId)
    .filter(
      (b) =>
        b.section === course.section &&
        b.term === term.name &&
        !b.teacherVerified &&
        !absorbedBlueprintIds.includes(b.id),
    )
    .sort((a, b) => netVotes(b) - netVotes(a))

  if (community.length === 0) return null

  return (
    <section className="mt-8">
      <div className="mb-3">
        <h2 className="text-[15px] font-semibold text-fg">Student blueprints for your section</h2>
        <p className="text-[12px] text-subtle">
          Review one and verify it to make it the official outline — it becomes yours and pins for
          students.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {community.map((bp) => {
          const open = openId === bp.id
          return (
            <li key={bp.id} className="overflow-hidden rounded-lg border border-border bg-surface">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : bp.id)}
                aria-expanded={open}
                className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors duration-150 hover:bg-surface-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-fg">{bp.author}</p>
                  <p className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] text-subtle">
                    <span>
                      {bp.dates.length} items · {blueprintWeight(bp)}%
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <ThumbsUp size={11} aria-hidden />
                      {netVotes(bp)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Download size={11} aria-hidden />
                      {bp.imports}
                    </span>
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-muted">
                  Review
                  <ChevronDown
                    size={15}
                    className={cn('transition-transform duration-150', open && 'rotate-180')}
                    aria-hidden
                  />
                </span>
              </button>

              {open && (
                <div className="border-t border-border px-3.5 py-3">
                  <ul className="flex flex-col gap-1">
                    {bp.dates.map((d, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-2 rounded-md bg-surface-2/50 px-2.5 py-1.5"
                      >
                        <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted">
                          {KIND_LABEL[d.kind]}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[12px] text-fg">{d.title}</span>
                        <span className="hidden shrink-0 text-[11px] text-subtle sm:block">
                          {formatDueDateTime(d.due)}
                        </span>
                        <span className="shrink-0 text-[11px] font-medium text-muted tabular-nums">
                          {d.weight}%
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      disabled={disabled}
                      title={disabled ? 'Approval needed to verify' : undefined}
                      onClick={() => {
                        verifyCommunityBlueprint(course.courseId, bp)
                        setOpenId(null)
                      }}
                    >
                      <ShieldCheck size={14} aria-hidden />
                      Verify &amp; make it your outline
                    </Button>
                    <span className="text-[11px] text-subtle">
                      Adopts these dates as your published outline; the original leaves the community
                      pool.
                    </span>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
