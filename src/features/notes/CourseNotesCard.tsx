import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { NotebookPen, Pin, Plus } from 'lucide-react'
import type { Course } from '@/data/types'
import { Card } from '@/components/ui/Card'
import { listCourseNotes } from './notes-api'
import type { NoteMeta } from './types'

const SHOW = 6

/**
 * A class's notes on its course page: pinned first, then newest. Each opens in
 * Notes; "All notes" opens the class's whole notebook there. Desktop only,
 * like the Notes tab itself — there is nothing to open on a phone yet.
 */
export function CourseNotesCard({ course }: { course: Course }) {
  const [notes, setNotes] = useState<NoteMeta[] | null>(null)

  useEffect(() => {
    let cancelled = false
    listCourseNotes(course.id)
      .then((n) => !cancelled && setNotes(n))
      .catch(() => !cancelled && setNotes([]))
    return () => {
      cancelled = true
    }
  }, [course.id])

  const sorted = (notes ?? []).slice().sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt))
  const notebook = `/app/notes/c/${encodeURIComponent(course.id)}`

  return (
    <Card className="hidden overflow-hidden md:block">
      <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
        <NotebookPen size={13} className="text-subtle" aria-hidden />
        <p className="flex-1 text-[11px] font-semibold tracking-wide text-subtle uppercase">Notes</p>
        <Link to={notebook} className="text-[12px] font-medium text-accent hover:underline">
          All notes
        </Link>
      </div>
      {notes === null ? (
        <div className="space-y-2 p-3">
          <div className="ct-shimmer h-4 w-3/4 rounded" />
          <div className="ct-shimmer h-4 w-1/2 rounded" />
        </div>
      ) : sorted.length === 0 ? (
        <Link to={notebook} className="flex items-center gap-2 px-3.5 py-3 text-[13px] text-muted hover:text-fg">
          <Plus size={14} aria-hidden />
          Start notes for {course.code || 'this class'}
        </Link>
      ) : (
        <ul className="divide-y divide-border/60">
          {sorted.slice(0, SHOW).map((n) => (
            <li key={n.id}>
              <Link
                to={`/app/notes/n/${n.id}`}
                className="flex items-center gap-2 px-3.5 py-2 text-[13px] transition-colors duration-150 hover:bg-surface-2"
              >
                {n.pinned && <Pin size={12} className="shrink-0 text-accent" aria-label="Pinned" />}
                <span className={`min-w-0 flex-1 truncate ${n.title ? 'text-fg' : 'text-subtle'}`}>{n.title || 'Untitled note'}</span>
                {n.week && <span className="shrink-0 text-[11.5px] text-subtle">Wk {n.week}</span>}
              </Link>
            </li>
          ))}
          {sorted.length > SHOW && (
            <li>
              <Link to={notebook} className="block px-3.5 py-2 text-[12.5px] text-muted hover:text-fg">
                {sorted.length - SHOW} more
              </Link>
            </li>
          )}
        </ul>
      )}
    </Card>
  )
}
