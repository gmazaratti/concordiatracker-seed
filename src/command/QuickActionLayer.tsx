import { useQuickActions } from '@/app/providers/quick-actions'
import { AssessmentDetailModal } from './AssessmentDetailModal'
import { CourseDetailModal } from './CourseDetailModal'
import { UndoToast } from './UndoToast'

/** App-level mount point for the command palette's quick actions: the focused
 * detail popup (assessment or course) and the transient undo toast. Lives in the
 * student chrome so both outlive the palette that triggered them. */
export function QuickActionLayer() {
  const { target } = useQuickActions()
  return (
    <>
      {target?.kind === 'assessment' && (
        <AssessmentDetailModal key={target.id} id={target.id} />
      )}
      {target?.kind === 'course' && (
        <CourseDetailModal key={target.id} id={target.id} />
      )}
      <UndoToast />
    </>
  )
}
