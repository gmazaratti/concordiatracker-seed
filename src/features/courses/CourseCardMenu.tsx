import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Share2, Trash2 } from 'lucide-react'
import type { Course } from '@/data/types'
import { useAppData } from '@/app/providers/app-data'
import { DropdownMenu, type MenuItem } from '@/components/ui/DropdownMenu'
import { ModalShell } from '@/command/ModalShell'
import { BlueprintContributeModal } from './BlueprintContributeModal'

/** The "⋮" overflow menu on a course card — Share as blueprint (opt-in, only when
 * the course has assessments) + Delete (with a confirm). The course cards are
 * whole-card `<Link>`s, so the wrapper swallows the click (preventDefault +
 * stopPropagation) to keep the menu from navigating, and the modals are portaled
 * to <body> so they aren't clipped by the card. */
export function CourseCardMenu({
  course,
  assessmentCount,
  className,
  triggerClassName,
}: {
  course: Course
  assessmentCount: number
  className?: string
  triggerClassName?: string
}) {
  const { removeCourse, shareCourseAsBlueprint } = useAppData()
  const [confirm, setConfirm] = useState(false)
  const [share, setShare] = useState(false)

  const items: MenuItem[] = [
    ...(assessmentCount > 0
      ? [
          {
            id: 'share',
            label: 'Share as blueprint',
            icon: Share2,
            onSelect: () => setShare(true),
          } as MenuItem,
        ]
      : []),
    {
      id: 'delete',
      label: 'Delete course',
      icon: Trash2,
      danger: true,
      separated: assessmentCount > 0,
      onSelect: () => setConfirm(true),
    },
  ]

  return (
    <span className={className} onClick={(e) => { e.preventDefault(); e.stopPropagation() }}>
      <DropdownMenu
        items={items}
        ariaLabel={`Options for ${course.code || 'course'}`}
        triggerClassName={triggerClassName}
      />
      {share &&
        createPortal(
          <BlueprintContributeModal
            course={course}
            onSubmit={() => shareCourseAsBlueprint(course.id)}
            onClose={() => setShare(false)}
          />,
          document.body,
        )}
      {confirm &&
        createPortal(
          <ModalShell label="Delete course" onClose={() => setConfirm(false)}>
            <div className="p-5">
              <h2 className="font-display text-[18px] font-semibold text-fg">Delete this course?</h2>
              <p className="mt-1.5 text-[13px] text-muted">
                <span className="font-medium text-fg">
                  {course.code || 'Untitled course'}
                  {course.title ? ` · ${course.title}` : ''}
                </span>{' '}
                and its {assessmentCount} assessment{assessmentCount === 1 ? '' : 's'} will be
                permanently removed. This can't be undone.
              </p>
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirm(false)}
                  className="rounded-lg px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:text-fg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    removeCourse(course.id)
                    setConfirm(false)
                  }}
                  className="rounded-lg bg-danger px-4 py-2 text-[13px] font-medium text-white shadow-sm transition-colors duration-150 hover:bg-danger/90"
                >
                  Delete course
                </button>
              </div>
            </div>
          </ModalShell>,
          document.body,
        )}
    </span>
  )
}
