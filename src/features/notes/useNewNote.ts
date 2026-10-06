import { useNavigate } from 'react-router-dom'
import { useAppData } from '@/app/providers/app-data'
import { term } from '@/data/mock'
import { autoLinkFor, weekOfTerm } from './auto-link'
import type { NotesData } from './useNotesData'
import type { NoteFolder, NoteTemplate } from './types'

/** Tonight at 11:59 PM: when a task with no date is due. */
export function tonight(): string {
  const d = new Date()
  d.setHours(23, 59, 0, 0)
  return d.toISOString()
}

/**
 * Starting a note or a task from wherever you are.
 *
 * A note started inside a class lands in that class and week; one started
 * from the top during a scheduled class is filed in that class (auto-link).
 * A TASK is a note with a calendar task attached: it shows on Today and the
 * calendar, and opens as a document.
 */
export function useNewNote(data: NotesData, here: NoteFolder | null, general: boolean) {
  const navigate = useNavigate()
  const { courses, addTasks } = useAppData()

  const newNote = async (template: NoteTemplate | null) => {
    const now = new Date()
    let init: Parameters<typeof data.createNote>[0] = { content: template?.content }
    if (here) {
      init = { ...init, folderId: here.id }
      if (here.courseId) init = { ...init, courseId: here.courseId, week: weekOfTerm(now, term.start, term.end) }
    } else if (!general) {
      const link = autoLinkFor(courses, now, term)
      const cls = link && data.folders.find((f) => f.courseId === link.courseId)
      if (link) init = { ...init, courseId: link.courseId, week: link.week, lectureDate: link.lectureDate, title: link.title, folderId: cls?.id ?? null }
    }
    const meta = await data.createNote(init).catch(() => null)
    if (meta) navigate(`/app/notes/n/${meta.id}`, { state: { autoLinked: !here && !general && !!init.courseId } })
  }

  const newTask = async () => {
    const meta = await data.createNote({ title: 'New task', folderId: here?.id ?? null }).catch(() => null)
    if (!meta) return
    await addTasks([{ title: 'New task', due: tonight(), noteId: meta.id }])
    navigate(`/app/notes/n/${meta.id}`, { state: { focusTitle: true } })
  }

  return { newNote, newTask }
}
