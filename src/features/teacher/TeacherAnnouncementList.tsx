import { useState } from 'react'
import { Megaphone, Pencil, Trash2 } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import type { Announcement } from '@/data/announcements'
import { normalizeCode } from '@/lib/supabase-adapters'
import { AnnouncementMeta } from '@/components/AnnouncementMeta'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

const field =
  'w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none'

/** The teacher's past announcements for a course — each editable (stamps "Edited")
 * or deletable. Edits/deletes flow to the student digest + course detail. */
export function TeacherAnnouncementList({
  courseCode,
  disabled,
}: {
  courseCode: string
  disabled: boolean
}) {
  const { teacherAnnouncements } = useTeacher()
  const code = normalizeCode(courseCode)
  const items = teacherAnnouncements
    .filter((a) => a.courseCode === code)
    .sort((a, b) => a.postedDaysAgo - b.postedDaysAgo)

  if (items.length === 0) return null

  return (
    <>
      <p className="mt-4 mb-2 text-[11px] font-semibold tracking-wide text-subtle uppercase">
        Past announcements
      </p>
      <ul className="flex flex-col gap-2">
        {items.map((an) => (
          <Row key={an.id} an={an} disabled={disabled} />
        ))}
      </ul>
    </>
  )
}

function Row({ an, disabled }: { an: Announcement; disabled: boolean }) {
  const { editAnnouncement, deleteAnnouncement } = useTeacher()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(an.title)
  const [body, setBody] = useState(an.body)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function startEdit() {
    setTitle(an.title)
    setBody(an.body)
    setEditing(true)
  }
  function save() {
    if (!title.trim() || !body.trim()) return
    editAnnouncement(an.id, { title: title.trim(), body: body.trim() })
    setEditing(false)
  }

  if (editing) {
    return (
      <li className="rounded-lg border border-accent/40 bg-surface px-3.5 py-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Announcement title"
          className={field}
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          aria-label="Announcement body"
          rows={2}
          className={cn(field, 'mt-2 resize-none')}
        />
        <div className="mt-2 flex items-center gap-2">
          <Button size="sm" disabled={!title.trim() || !body.trim()} onClick={save}>
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </li>
    )
  }

  return (
    <li className="rounded-lg border border-border bg-surface px-3.5 py-3">
      <div className="flex items-center gap-2">
        <Megaphone size={13} className="text-accent" aria-hidden />
        <span className="text-[13px] font-medium text-fg">{an.title}</span>
        <AnnouncementMeta a={an} className="ml-auto" />
      </div>
      <p className="mt-1 text-[12px] leading-snug text-subtle">{an.body}</p>

      <div className="mt-2 flex items-center gap-2">
        {confirmDelete ? (
          <>
            <span className="text-[12px] text-muted">Delete this announcement?</span>
            <Button size="sm" variant="outline" onClick={() => deleteAnnouncement(an.id)}>
              Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={startEdit}
              disabled={disabled}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-muted transition-colors duration-150 hover:text-accent disabled:opacity-50"
            >
              <Pencil size={12} aria-hidden />
              Edit
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={disabled}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-muted transition-colors duration-150 hover:text-danger disabled:opacity-50"
            >
              <Trash2 size={12} aria-hidden />
              Delete
            </button>
          </>
        )}
      </div>
    </li>
  )
}
