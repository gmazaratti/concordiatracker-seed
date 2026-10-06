import { useEffect, useRef } from 'react'
import { useAppData } from '@/app/providers/app-data'
import { tonight } from './useNewNote'

/**
 * The calendar task attached to this note, if it is a task. Tasks are
 * personal, so only the note's owner has one; a classmate the note is shared
 * with sees an ordinary note.
 *
 * The task's title follows the note's title (a short pause after typing, so
 * renaming does not write once per keystroke).
 */
export function useNoteTask(noteId: string, title: string) {
  const { personalTasks, addTasks, updateTask, toggleTask, removeTask } = useAppData()
  const task = personalTasks.find((t) => t.noteId === noteId) ?? null
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!task) return
    const want = title.trim() || 'Untitled task'
    if (want === task.title) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => updateTask(task.id, { title: want.slice(0, 200) }), 800)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [title, task, updateTask])

  return {
    task,
    make: () => void addTasks([{ title: (title.trim() || 'Untitled task').slice(0, 200), due: tonight(), noteId }]),
    toggle: () => task && toggleTask(task.id),
    setDue: (iso: string) => task && updateTask(task.id, { due: iso }),
    unlink: () => task && removeTask(task.id),
  }
}
