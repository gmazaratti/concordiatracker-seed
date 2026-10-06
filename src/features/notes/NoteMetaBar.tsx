import { useMemo } from 'react'
import { BookmarkPlus, History, Pin, PinOff, Trash2, X } from 'lucide-react'
import type { Assessment, Course } from '@/data/types'
import { Select } from '@/components/ui/Select'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import { CourseChip } from '@/components/CourseChip'
import { cn } from '@/lib/cn'
import type { NoteFolder, NoteMeta } from './types'

const NONE = '__none__'

/**
 * Where a note lives and what it is about: class, week, folder, pin, and the
 * assignments it is for. Every control writes straight away — these are
 * choices, not text, so there is nothing to debounce.
 */
export function NoteMetaBar({
  note,
  courses,
  folders,
  assessments,
  onChange,
  onHistory,
  onSaveTemplate,
  onTrash,
}: {
  note: NoteMeta
  courses: Course[]
  folders: NoteFolder[]
  assessments: Assessment[]
  onChange: (patch: Partial<NoteMeta>) => void
  onHistory: () => void
  onSaveTemplate: () => void
  onTrash: () => void
}) {
  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses])
  const linked = note.assignmentIds
    .map((id) => assessments.find((a) => a.id === id))
    .filter((a): a is Assessment => !!a)

  // The note's own class first, then everything else; never offer one twice.
  const candidates = useMemo(() => {
    const free = assessments.filter((a) => !note.assignmentIds.includes(a.id))
    const mine = free.filter((a) => a.courseId === note.courseId)
    const rest = free.filter((a) => a.courseId !== note.courseId)
    return [...mine, ...rest].slice(0, 200)
  }, [assessments, note.assignmentIds, note.courseId])

  return (
    <div className="flex flex-col gap-2 px-6 pt-1 pb-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          size="sm"
          tone="control"
          ariaLabel="Class"
          value={note.courseId ?? NONE}
          onChange={(v) => onChange({ courseId: v === NONE ? null : v, week: v === NONE ? null : note.week })}
          options={[
            { value: NONE, label: 'No class' },
            ...courses.map((c) => ({ value: c.id, label: c.code || c.title || 'Untitled course' })),
          ]}
          className="w-40"
        />
        {note.courseId && (
          <Select
            size="sm"
            tone="control"
            ariaLabel="Week"
            value={note.week ? String(note.week) : NONE}
            onChange={(v) => onChange({ week: v === NONE ? null : Number(v) })}
            options={[
              { value: NONE, label: 'No week' },
              ...Array.from({ length: 15 }, (_, i) => ({ value: String(i + 1), label: `Week ${i + 1}` })),
            ]}
            className="w-28"
          />
        )}
        <Select
          size="sm"
          tone="control"
          ariaLabel="Folder"
          value={note.folderId ?? NONE}
          onChange={(v) => onChange({ folderId: v === NONE ? null : v })}
          options={[{ value: NONE, label: 'No folder' }, ...folders.map((f) => ({ value: f.id, label: f.name }))]}
          className="w-36"
        />
        <button
          type="button"
          onClick={() => onChange({ pinned: !note.pinned })}
          aria-pressed={note.pinned}
          title={note.pinned ? 'Unpin' : 'Pin to the top of this class'}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[12.5px] font-medium transition-colors duration-150',
            note.pinned ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2 hover:text-fg',
          )}
        >
          {note.pinned ? <PinOff size={14} aria-hidden /> : <Pin size={14} aria-hidden />}
          {note.pinned ? 'Pinned' : 'Pin'}
        </button>
        <span className="ml-auto">
          <DropdownMenu
            ariaLabel="Note options"
            items={[
              { id: 'history', label: 'Version history', icon: History, onSelect: onHistory },
              { id: 'template', label: 'Save as template', icon: BookmarkPlus, onSelect: onSaveTemplate },
              { id: 'trash', label: 'Move to trash', icon: Trash2, onSelect: onTrash, danger: true, separated: true },
            ]}
          />
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {linked.map((a) => {
          const c = courseById.get(a.courseId)
          return (
            <span
              key={a.id}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-surface-2 py-0.5 pr-1 pl-1.5 text-[12px] text-fg"
            >
              {c && <CourseChip code={c.code} color={c.color} />}
              <span className="truncate">{a.title}</span>
              <button
                type="button"
                aria-label={`Unlink ${a.title}`}
                onClick={() => onChange({ assignmentIds: note.assignmentIds.filter((id) => id !== a.id) })}
                className="grid size-5 place-items-center rounded-full text-subtle hover:bg-surface hover:text-fg"
              >
                <X size={12} aria-hidden />
              </button>
            </span>
          )
        })}
        {candidates.length > 0 && (
          <Select
            size="sm"
            tone="control"
            searchable
            ariaLabel="Link an assignment"
            placeholder="+ Link assignment"
            value=""
            onChange={(id) => id && onChange({ assignmentIds: [...note.assignmentIds, id] })}
            options={candidates.map((a) => ({
              value: a.id,
              label: `${courseById.get(a.courseId)?.code ?? ''} · ${a.title}`.replace(/^ · /, ''),
            }))}
            className="w-48"
          />
        )}
      </div>
    </div>
  )
}
