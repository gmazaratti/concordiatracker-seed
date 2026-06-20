import { useState } from 'react'
import { ChevronDown, ExternalLink, Mail } from 'lucide-react'
import type { Course } from '@/data/types'
import { useAppData } from '@/app/providers/app-data'
import { Card } from '@/components/ui/Card'
import { courseColor, withAlpha } from '@/lib/course-color'
import { cn } from '@/lib/cn'
import { EditableField } from './EditableField'

/** Course-detail LEFT panel: the class's logistics, accent-themed and inline-
 * editable. On mobile it collapses to a tappable header (no cramped sidebar);
 * on desktop it's always open. Writes go straight to the store via `updateCourse`. */
export function CourseInfoPanel({
  course,
  totalAssessments,
  editableIdentity = false,
}: {
  course: Course
  totalAssessments: number
  /** Manual courses: also let the code + name be edited here (seeded courses get
   * those from the catalog, so they're read-only on the banner). */
  editableIdentity?: boolean
}) {
  const { updateCourse } = useAppData()
  const [open, setOpen] = useState(false)
  const { hex } = courseColor(course.color)

  const patch = (p: Partial<Course>) => updateCourse(course.id, p)
  const patchInstructor = (p: Partial<Course['instructor']>) =>
    patch({ instructor: { ...course.instructor, ...p } })
  const patchTa = (p: Partial<NonNullable<Course['ta']>>) =>
    patch({ ta: { name: '', email: '', ...course.ta, ...p } })

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 border-b border-border px-3.5 py-2.5 text-left lg:cursor-default"
        style={{ backgroundColor: withAlpha(hex, 0.12) }}
      >
        <span
          className="text-[11px] font-semibold tracking-wide uppercase"
          style={{ color: hex }}
        >
          Class details
        </span>
        <ChevronDown
          size={15}
          aria-hidden
          className={cn(
            'shrink-0 text-subtle transition-transform duration-150 lg:hidden',
            open && 'rotate-180',
          )}
        />
      </button>

      <div className={cn('lg:block', open ? 'block' : 'hidden')}>
        <dl className="divide-y divide-border/70">
          {editableIdentity && (
            <>
              <Row label="Code">
                <EditableField
                  value={course.code}
                  onCommit={(code) => patch({ code })}
                  ariaLabel="Course code"
                  placeholder="e.g. COMP 248"
                />
              </Row>
              <Row label="Name">
                <EditableField
                  value={course.title}
                  onCommit={(title) => patch({ title })}
                  ariaLabel="Course name"
                  placeholder="e.g. Object-Oriented Programming"
                />
              </Row>
            </>
          )}

          <Row label="Instructor">
            <EditableField
              value={course.instructor.name}
              onCommit={(name) => patchInstructor({ name })}
              ariaLabel="Instructor name"
              placeholder="Add instructor"
            />
            <ContactEmail
              value={course.instructor.email}
              onCommit={(email) => patchInstructor({ email })}
              ariaLabel="Instructor email"
            />
          </Row>

          <Row label="TA">
            {course.ta ? (
              <>
                <EditableField
                  value={course.ta.name}
                  onCommit={(name) => patchTa({ name })}
                  ariaLabel="TA name"
                  placeholder="Add TA"
                />
                <ContactEmail
                  value={course.ta.email}
                  onCommit={(email) => patchTa({ email })}
                  ariaLabel="TA email"
                />
              </>
            ) : (
              <button
                type="button"
                onClick={() => patchTa({ name: 'New TA' })}
                className="text-[13px] text-subtle transition-colors hover:text-accent"
              >
                + Add a TA
              </button>
            )}
          </Row>

          <Row label="Section">
            <EditableField
              value={course.section}
              onCommit={(section) => patch({ section })}
              ariaLabel="Section"
              placeholder="—"
            />
          </Row>

          <Row label="Meets">
            <EditableField
              value={course.meetingTimes}
              onCommit={(meetingTimes) => patch({ meetingTimes })}
              ariaLabel="Meeting times"
              placeholder="Add schedule"
            />
          </Row>

          <Row label="Office hours">
            <EditableField
              value={course.officeHours ?? ''}
              onCommit={(officeHours) => patch({ officeHours })}
              ariaLabel="Office hours"
              placeholder="Add office hours"
            />
          </Row>

          <Row label="Location">
            <EditableField
              value={course.location}
              onCommit={(location) => patch({ location })}
              ariaLabel="Location"
              placeholder="Add room"
            />
          </Row>

          <Row label="Credits">
            <EditableField
              value={String(course.credits)}
              onCommit={(raw) => {
                const n = Number(raw)
                if (Number.isFinite(n) && n > 0) patch({ credits: n })
              }}
              ariaLabel="Credits"
              placeholder="0"
            />
          </Row>

          <Row label="Grading scale">
            <EditableField
              value={course.gradingScale ?? ''}
              onCommit={(gradingScale) => patch({ gradingScale })}
              ariaLabel="Grading scale"
              placeholder="Add grading scale"
            />
          </Row>

          <Row label="Assessments">
            <span className="text-[13px] text-fg tabular-nums">
              {totalAssessments}
            </span>
          </Row>

          <Row label="Syllabus">
            <a
              href={course.syllabusUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[13px] text-accent transition-colors hover:text-accent-hover"
            >
              Open syllabus
              <ExternalLink size={12} aria-hidden />
            </a>
          </Row>
        </dl>
      </div>
    </Card>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_1fr] items-start gap-3 px-3.5 py-2.5">
      <dt className="pt-0.5 text-[12px] text-subtle">{label}</dt>
      <dd className="min-w-0 space-y-0.5">{children}</dd>
    </div>
  )
}

function ContactEmail({
  value,
  onCommit,
  ariaLabel,
}: {
  value: string
  onCommit: (value: string) => void
  ariaLabel: string
}) {
  return (
    <div className="flex items-center gap-1.5 text-subtle">
      <Mail size={11} aria-hidden className="shrink-0" />
      <EditableField
        value={value}
        onCommit={onCommit}
        ariaLabel={ariaLabel}
        placeholder="Add email"
        className="text-[11px] text-subtle"
      />
    </div>
  )
}
