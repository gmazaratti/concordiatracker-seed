import { useRef } from 'react'
import { useAppData } from '@/app/providers/app-data'
import type { Assessment, Grade } from '@/data/types'
import { dismissGradePrompt, useGradePrompts, type PromptKey } from '@/lib/grade-prompt'
import { codesIn, stripMoodleTitle, titlesMatch } from '@/lib/moodle-match'
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

  // THE COURSE MAY ALREADY HAVE THIS ONE, with its weight from the outline.
  // Then the grade belongs on that assessment and there is nothing to ask
  // about what it is worth: asking would be asking you to retype a number the
  // app already holds.
  const existing = course
    ? assessments.find((a) => a.courseId === course.id && titlesMatch(a.title, title))
    : undefined
  if (existing) {
    return (
      <GradePromptCard
        key={head}
        promptKey={head}
        title={existing.title}
        behind={behind}
        gradeable
        onSave={(g) => {
          setGrade(existing.id, g)
          if (existing.status !== 'done') setStatus(existing.id, 'done')
        }}
        onUndoGrade={() => setGrade(existing.id, existing.grade ?? null)}
        onUndoDone={() => {
          if (task.done) toggleTask(task.id)
          haptic('tap')
          dismissGradePrompt(head)
        }}
      />
    )
  }
  // Not in the course yet, so a grade creates it and it needs a weight. When
  // the course's other items of the same kind all agree ("Quiz 2", "Quiz 3"
  // both 10%), that IS the answer and it is shown, not asked.
  const known = course ? siblingWeight(title, assessments.filter((a) => a.courseId === course.id)) : null

  async function saveTaskGrade(grade: Grade, weight?: number) {
    if (!course || !task || weight === undefined) return
    const item: Assessment = {
      id: crypto.randomUUID(),
      courseId: course.id,
      title,
      kind: known?.kind ?? 'assignment',
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
      knownWeight={known?.weight}
      knownWeightFrom={known?.label}
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

/**
 * The weight a new item probably has, from the course's other items that share
 * its first word ("Quiz 1" → the other quizzes). Only when they ALL agree: two
 * quizzes at 10% and one at 15% means we do not know, so the card asks.
 */
function siblingWeight(
  title: string,
  inCourse: Assessment[],
): { weight: number; kind: Assessment['kind']; label: string } | null {
  const word = title.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '')
  if (!word || word.length < 3) return null
  const same = inCourse.filter(
    (a) => a.weight > 0 && a.title.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '') === word,
  )
  if (same.length === 0) return null
  const w = same[0].weight
  if (!same.every((a) => a.weight === w)) return null
  const many = word === 'quiz' ? 'quizzes' : word.endsWith('s') ? word : `${word}s`
  const plural = same.length === 1 ? same[0].title : `your other ${many}`
  return { weight: w, kind: same[0].kind, label: plural }
}
