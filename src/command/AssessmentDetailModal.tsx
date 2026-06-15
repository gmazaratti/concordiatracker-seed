import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import type { AssessmentStatus } from '@/data/types'
import { useAppData } from '@/app/providers/app-data'
import { useQuickActions } from '@/app/providers/quick-actions'
import { CourseChip } from '@/components/CourseChip'
import { ProvenanceBadge } from '@/components/ProvenanceBadge'
import { EDITOR_STATUSES, STATUS_META } from '@/lib/status'
import { KIND_LABEL } from '@/lib/assessment'
import { gradeToInput, gradeToPercent, parseGradeInput } from '@/lib/grade'
import { percentToGrade } from '@/lib/gpa'
import { relativeDueLabel } from '@/lib/date'
import { courseColor } from '@/lib/course-color'
import { cn } from '@/lib/cn'
import { ModalShell } from './ModalShell'

/** The popup the command palette opens for a specific assessment ("Change grade
 * for…"). Shows the item's details and a focused status + smart-grade editor;
 * saving commits to the store and flashes a reversible Undo. */
export function AssessmentDetailModal({ id }: { id: string }) {
  const { assessments, courseById, setStatus, setGrade } = useAppData()
  const { closeTarget, flashUndo } = useQuickActions()
  const navigate = useNavigate()

  const assessment = assessments.find((a) => a.id === id)
  const course = assessment ? courseById(assessment.courseId) : undefined

  const [status, setDraftStatus] = useState<AssessmentStatus>(
    assessment?.status ?? 'not-started',
  )
  const [gradeText, setGradeText] = useState(() =>
    gradeToInput(assessment?.grade ?? null),
  )

  if (!assessment || !course) return null

  const parsed = parseGradeInput(gradeText)
  const pct = gradeToPercent(parsed)
  const resolved = pct === null ? null : percentToGrade(pct)
  const gradeDirty = gradeToInput(parsed) !== gradeToInput(assessment.grade)
  const statusDirty = status !== assessment.status
  const dirty = gradeDirty || statusDirty
  const { hex } = courseColor(course.color)

  function save() {
    if (!assessment) return
    const prevStatus = assessment.status
    const prevGrade = assessment.grade
    if (statusDirty) setStatus(assessment.id, status)
    if (gradeDirty) setGrade(assessment.id, parsed)
    closeTarget()
    if (dirty) {
      flashUndo(`Updated ${assessment.title}`, () => {
        setStatus(assessment.id, prevStatus)
        setGrade(assessment.id, prevGrade)
      })
    }
  }

  function openInCourse() {
    if (!assessment) return
    navigate(`/app/courses/${assessment.courseId}`)
    closeTarget()
  }

  return (
    <ModalShell label={`Change grade for ${assessment.title}`} onClose={closeTarget}>
      <div className="h-1.5" style={{ backgroundColor: hex }} aria-hidden />
      <div className="px-5 py-4">
        <div className="flex items-center gap-2">
          <CourseChip code={course.code} color={course.color} />
          <span className="truncate text-[12px] text-subtle">{course.title}</span>
        </div>
        <h2 className="mt-2 text-[17px] leading-snug font-medium text-fg">
          {assessment.title}
        </h2>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-subtle">
          <span>{KIND_LABEL[assessment.kind]}</span>
          <span aria-hidden>·</span>
          <span>{assessment.weight}% of grade</span>
          <span aria-hidden>·</span>
          <span>{relativeDueLabel(assessment.due)}</span>
          <ProvenanceBadge provenance={assessment.provenance} />
        </div>

        <div className="mt-4 grid grid-cols-[1fr_auto] items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium tracking-wide text-subtle uppercase">
              Status
            </span>
            <div className="relative">
              <span
                className={cn(
                  'pointer-events-none absolute top-1/2 left-2.5 size-1.5 -translate-y-1/2 rounded-full',
                  STATUS_META[status].dot,
                )}
                aria-hidden
              />
              <select
                value={status}
                aria-label="Status"
                onChange={(e) => setDraftStatus(e.target.value as AssessmentStatus)}
                className="w-full appearance-none rounded-lg border border-border-strong bg-surface-2 py-2 pr-3 pl-6 text-[13px] font-medium text-fg focus-visible:outline-none"
              >
                {EDITOR_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_META[s].label}
                  </option>
                ))}
              </select>
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-medium tracking-wide text-subtle uppercase">
              Grade
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={gradeText}
              placeholder="15/20 or 82"
              aria-label="Grade"
              onChange={(e) => setGradeText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && dirty) save()
              }}
              className="w-[124px] rounded-lg border border-border-strong bg-surface-2 px-3 py-2 text-center text-[14px] font-medium text-fg tabular-nums focus-visible:outline-none"
            />
          </label>
        </div>

        <p className="mt-2 text-[12px] text-subtle">
          {resolved ? (
            <>
              Resolves to{' '}
              <span className="font-semibold text-fg">{Math.round(pct!)}%</span> ·{' '}
              {resolved.letter} · {resolved.points.toFixed(1)} pts
            </>
          ) : (
            'No grade yet — leave blank to keep it ungraded.'
          )}
        </p>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={openInCourse}
            className="inline-flex items-center gap-1 text-[12px] text-subtle transition-colors hover:text-fg"
          >
            Open in course
            <ArrowUpRight size={13} aria-hidden />
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={closeTarget}
              className="rounded-lg px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:text-fg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!dirty}
              className="rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-accent-contrast shadow-sm transition-colors duration-150 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  )
}
