import { useMemo } from 'react'
import { Pin } from 'lucide-react'
import type { Course } from '@/data/types'
import { CourseChip } from '@/components/CourseChip'
import { cn } from '@/lib/cn'
import type { NoteMeta, NotesFilter } from './types'
import { groupNotes, noteDate } from './note-format'

export function NoteList({
  notes,
  filter,
  courses,
  selectedId,
  onSelect,
}: {
  notes: NoteMeta[]
  filter: NotesFilter
  courses: Course[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const groups = useMemo(() => groupNotes(notes, filter), [notes, filter])
  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses])

  return (
    <ul className="flex flex-col pb-6">
      {groups.map((g) => (
        <li key={g.label || 'all'}>
          {g.label && (
            <p className="sticky top-0 z-[1] bg-canvas/95 px-4 pt-4 pb-1.5 text-[11px] font-semibold tracking-wide text-subtle uppercase backdrop-blur">
              {g.label}
            </p>
          )}
          <ul className="px-2">
            {g.notes.map((n) => {
              const c = n.courseId ? courseById.get(n.courseId) : undefined
              const active = n.id === selectedId
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(n.id)}
                    aria-current={active ? 'true' : undefined}
                    className={cn(
                      'flex w-full flex-col gap-1 rounded-lg px-2.5 py-2 text-left transition-colors duration-150',
                      active ? 'bg-accent-soft' : 'hover:bg-surface-2',
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      {n.pinned && <Pin size={12} className="shrink-0 text-accent" aria-label="Pinned" />}
                      <span className={cn('truncate text-[13.5px] font-medium', n.title ? 'text-fg' : 'text-subtle')}>
                        {n.title || 'Untitled note'}
                      </span>
                    </span>
                    <span className="flex items-center gap-2 text-[12px] text-subtle">
                      <span className="tabular-nums">{noteDate(n.updatedAt)}</span>
                      {c && filter.kind !== 'course' && <CourseChip code={c.code} color={c.color} />}
                      {filter.kind === 'course' && n.lectureDate && (
                        <span>
                          Class of{' '}
                          {new Date(`${n.lectureDate}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </li>
      ))}
    </ul>
  )
}
