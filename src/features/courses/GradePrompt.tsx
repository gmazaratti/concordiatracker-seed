import { useRef } from 'react'
import { useAppData } from '@/app/providers/app-data'
import type { Assessment, Grade } from '@/data/types'
import { dismissGradePrompt, useGradePrompts, type PromptKey } from '@/lib/grade-prompt'
import { codesIn, stripMoodleTitle } from '@/lib/moodle-match'
import { haptic } from '@/lib/haptics'
import { GradePromptCard } from './GradePromptCard'

/**
 * Works through the line of "what did you get?" questions (lib/grade-prompt).
 *
 * An ASSESSMENT is asked about while it has no grade. A synced MOODLE item has
 * nowhere to keep a grade, so a grade entered for one becomes an assessment in
 * the course Moodle names (which then hides the synced copy, the way a paired
 * item always is). That needs the weight too: a grade with no weight cannot
 * count toward anything, and a zero weight would make the category average
 * divide by zero. With no matching course there is nothing to grade into, so
 * the card offers only the Undo.
 *
 * Every card can UNDO THE COMPLETION itself — the tick was the action, and the
 * card is the one thing on screen that knows it just happened.
 */
export function GradePrompt() {
  const { queue, saved } = useGradePrompts()
  const { assessments, personalTasks, courses, setGrade, setStatus, toggleTask, addAssessments, removeAssessment } =
    useAppData()
  // What a Moodle grade created, so its Undo can take it back out.
  const createdFor = useRef(new Map<PromptKey, string>())

  const waiting = queue.filter((key) => {
    const id = key.slice(2)
    if (key.startsWith('a:')) {
      const a = assessments.find((x) => x.id === id)
      return !!a && (!a.grade || key === saved)
    }
    const t = personalTasks.find((x) => x.id === id)
    return !!t && (t.done || key === saved)
  })
  const head = waiting[0]
  if (!head) return null
  const id = head.slice(2)
  const behind = waiting.length - 1

  if (head.startsWith('a:')) {
    const a = assessments.find((x) => x.id === id)
    if (!a) return null
    return (
      <GradePromptCard
        key={head}
        promptKey={head}
        title={a.title}
        behind={behind}
        gradeable
        onSave={(g) => {
          setGrade(a.id, g)
          // Graded now, so no longer "waiting": file it as done.
          if (a.status === 'awaiting-grade') setStatus(a.id, 'done')
        }}
        onAwaiting={
          a.status === 'awaiting-grade'
            ? undefined
            : () => {
                setStatus(a.id, 'awaiting-grade')
                haptic('tap')
              }
        }
        onUndoGrade={() => setGrade(a.id, null)}
        onUndoDone={() => {
          setStatus(a.id, 'not-started')
          dismissGradePrompt(head)
        }}
      />
    )
  }

  const task = personalTasks.find((x) => x.id === id)
  if (!task) return null
  const byCode = new Map(courses.flatMap((c) => codesIn(c.code).map((code) => [code, c] as const)))
  const course = codesIn(`${task.title} ${task.note ?? ''}`)
    .map((code) => byCode.get(code))
    .find(Boolean)
  const title = stripMoodleTitle(task.title) || task.title

  async function saveTaskGrade(grade: Grade, weight?: number) {
    if (!course || !task || weight === undefined) return
    const item: Assessment = {
      id: crypto.randomUUID(),
      courseId: course.id,
      title,
      kind: 'assignment',
      due: task.due,
      weight,
      // Typed in by the student from a Moodle event: nobody has confirmed it.
      provenance: { status: 'unverified' },
      status: 'done',
      grade,
      notes: '',
    }
    const [created] = await addAssessments([item])
    if (created) createdFor.current.set(head, created.id)
  }

  return (
    <GradePromptCard
      key={head}
      promptKey={head}
      title={title}
      behind={behind}
      gradeable={!!course}
      needsWeight
      courseCode={course?.code}
      onSave={saveTaskGrade}
      onUndoGrade={() => {
        const made = createdFor.current.get(head)
        if (made) removeAssessment(made)
        createdFor.current.delete(head)
      }}
      onUndoDone={() => {
        if (task.done) toggleTask(task.id)
        haptic('tap')
        dismissGradePrompt(head)
      }}
    />
  )
}
