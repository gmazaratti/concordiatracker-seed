import { useEffect, useState } from 'react'
import { BadgeCheck, Ban, Check, CircleHelp, Repeat, Trash2, TriangleAlert } from 'lucide-react'
import { SidePanel } from '@/components/SidePanel'
import { Select } from '@/components/ui/Select'
import { sectionInstructors, type SectionInstructor } from '@/lib/academic-record'
import { coursesByCodes, searchCourses, unlockedBy, type CatalogCourse } from '@/lib/catalog'
import type { PlanCheck, PlanCourse, PlanVerdict } from '@/lib/course-plan'
import { cn } from '@/lib/cn'
import { CourseSections } from '../CourseSections'
import { PrereqChips } from '../PrereqChips'

const VERDICT: Record<PlanVerdict, { icon: typeof Check; tone: string; text: (term: string) => string }> = {
  ok: { icon: Check, tone: 'border-success/40 text-success', text: (t) => `Its prerequisites come before ${t} in your plan.` },
  missing: { icon: TriangleAlert, tone: 'border-warning/50 text-warning', text: () => 'A prerequisite is not before it in your plan.' },
  unsure: { icon: CircleHelp, tone: 'border-border text-muted', text: () => 'Part of the requirement is something we cannot check.' },
  blocked: { icon: Ban, tone: 'border-danger/50 text-danger', text: () => 'You would not get credit for this one.' },
  repeat: { icon: Repeat, tone: 'border-border text-muted', text: () => 'This course is listed more than once.' },
}

const Heading = ({ children }: { children: string }) => (
  <p className="text-[11px] font-semibold tracking-wide text-subtle uppercase">{children}</p>
)

/**
 * Everything we hold about one planned course: what it is, whether its
 * prerequisites come before it in the plan, who has taught it, when it runs
 * and how full it is, and what it opens up afterwards.
 *
 * Sections and seats are whatever Concordia has published. For a term it has
 * not published yet, those are an earlier term's, and the list says which.
 */
export function CourseDetail({
  course,
  term,
  check,
  before,
  credits,
  terms,
  onMove,
  onRemove,
  onClose,
}: {
  course: PlanCourse & { locked?: boolean }
  /** The term it is planned in; null for a class being taken now. */
  term: string | null
  check: PlanCheck | undefined
  /** Normalised codes of everything that comes before it in the plan. */
  before: Set<string>
  credits: number
  /** Terms it could be moved to; empty when it cannot be moved. */
  terms: string[]
  onMove: (term: string) => void
  onRemove: () => void
  onClose: () => void
}) {
  const [row, setRow] = useState<CatalogCourse | null>(null)
  const [profs, setProfs] = useState<SectionInstructor[]>([])
  const [opens, setOpens] = useState<CatalogCourse[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let alive = true
    void (async () => {
      const [byCode, people, next] = await Promise.all([
        coursesByCodes([course.code]),
        sectionInstructors(course.code),
        unlockedBy(course.code, 12),
      ])
      // The by-code lookup may not carry the description; the search does.
      const found = byCode[0]?.description ? byCode[0] : ((await searchCourses(course.code, 1).catch(() => []))[0] ?? byCode[0] ?? null)
      if (!alive) return
      setRow(found)
      setProfs(people)
      setOpens(next)
      setLoaded(true)
    })()
    return () => {
      alive = false
    }
  }, [course.code])

  const [subject, catalog] = course.code.split(/\s+/)
  const v = VERDICT[check?.verdict ?? 'ok']
  const Icon = v.icon

  return (
    <SidePanel label={`${course.code} details`} title={course.code} onClose={onClose}>
      {(close) => (
        <div className="space-y-6 px-4 pt-1 pb-8 md:px-5">
          <div>
            <p className="font-display text-[19px] leading-snug font-semibold text-fg">{row?.title || course.title || course.code}</p>
            <p className="mt-1 text-[12.5px] text-subtle">
              {course.credits} credits · {term ? `planned for ${term}` : 'you are taking this now'}
            </p>
          </div>

          {term && (
            <div className={cn('rounded-2xl border bg-surface px-3.5 py-3', v.tone)}>
              <p className="flex items-center gap-2 text-[13px] font-semibold">
                <Icon size={15} aria-hidden /> {v.text(term)}
              </p>
              {check?.message && <p className="mt-1 text-[12.5px] leading-relaxed text-fg">{check.message}</p>}
            </div>
          )}

          {/* Most of the calendar mirror has no description yet, so the section only shows when there is one. */}
          {row?.description && (
            <section>
              <Heading>About</Heading>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{row.description}</p>
            </section>
          )}

          {row?.prerequisites?.trim() ? (
            <PrereqChips prerequisites={row.prerequisites} code={course.code} completed={before} credits={credits} trusted={!!term} />
          ) : (
            loaded && (
              <section>
                <Heading>Prerequisites</Heading>
                <p className="mt-1 text-[13px] text-muted">None listed in the calendar.</p>
              </section>
            )
          )}

          <section>
            <Heading>Who has taught it</Heading>
            {profs.length === 0 ? (
              <p className="mt-1 text-[13px] text-muted">
                {loaded ? 'Nobody on record yet. Concordia does not publish instructors, so this comes from course outlines.' : 'Loading…'}
              </p>
            ) : (
              <ul className="mt-1.5 space-y-1">
                {profs.slice(0, 8).map((p) => (
                  <li key={`${p.section}-${p.professor}`} className="flex items-center gap-2 text-[13px] text-fg">
                    <span className="min-w-0 flex-1 truncate">{p.professor}</span>
                    {p.section && <span className="shrink-0 text-[12px] text-subtle">Section {p.section}</span>}
                    {p.verified && <BadgeCheck size={13} className="shrink-0 text-info" aria-label="Published by the instructor" />}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {subject && catalog && (
            <section>
              <CourseSections key={course.code} subject={subject} catalog={catalog} autoLoad />
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-subtle">
                Concordia publishes one term at a time, so for a later term this shows the most recent one it has.
              </p>
            </section>
          )}

          {opens.length > 0 && (
            <section>
              <Heading>What it opens</Heading>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{opens.map((c) => `${c.subject} ${c.catalog}`).join(', ')}</p>
            </section>
          )}

          {!course.locked && term && (
            <section className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
              {terms.length > 1 && (
                <div className="min-w-0 flex-1">
                  <Select
                    value={term}
                    onChange={(next) => {
                      if (next !== term) onMove(next)
                      close()
                    }}
                    options={terms.map((t) => ({ value: t, label: t === term ? `In ${t}` : `Move to ${t}` }))}
                    ariaLabel="Move to another term"
                  />
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  onRemove()
                  close()
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[13px] font-medium text-muted transition-colors duration-150 hover:border-danger hover:text-danger"
              >
                <Trash2 size={14} aria-hidden /> Remove
              </button>
            </section>
          )}
        </div>
      )}
    </SidePanel>
  )
}
