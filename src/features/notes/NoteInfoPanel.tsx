import { useMemo } from 'react'
import { BookOpen, CalendarRange, FolderClosed, Pin, Share2, X } from 'lucide-react'
import type { Assessment, Course } from '@/data/types'
import { Select } from '@/components/ui/Select'
import { Switch } from '@/features/settings/controls'
import { CourseChip } from '@/components/CourseChip'
import { PersonAvatar } from '@/features/community/PersonAvatar'
import { cn } from '@/lib/cn'
import { ago } from './note-format'
import type { NotePerson } from './sharing-api'
import type { NoteFolder, NoteMeta, NoteRole } from './types'

const NONE = '__none__'

/**
 * The Details tab: where the note lives, what it is for, and who is on it.
 * Title and save status live in the top bar and actions in its ⋯ menu, so
 * this panel only answers "what is this note about".
 */
export function NoteInfoPanel(props: {
  note: NoteMeta
  role: NoteRole
  courses: Course[]
  folders: NoteFolder[]
  assessments: Assessment[]
  people: NotePerson[]
  /** Who has the note open: 'active' looking at it, 'idle' in a background tab. */
  live: Map<string, 'active' | 'idle'>
  onChange: (patch: Partial<NoteMeta>) => void
  onShare: () => void
}) {
  const { note, role, courses, folders, assessments, people } = props
  const owner = role === 'owner'
  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses])
  const linked = note.assignmentIds.map((id) => assessments.find((a) => a.id === id)).filter((a): a is Assessment => !!a)
  const candidates = assessments
    .filter((a) => !note.assignmentIds.includes(a.id))
    .sort((a, b) => Number(b.courseId === note.courseId) - Number(a.courseId === note.courseId))
    .slice(0, 200)
  const lastEditor = [...people].filter((p) => p.lastEditedAt).sort((a, b) => b.lastEditedAt!.localeCompare(a.lastEditedAt!))[0]
  const folderName = (f: NoteFolder) => (f.courseId ? courseById.get(f.courseId)?.code || f.name : f.name)
  const className = note.courseId ? (courseById.get(note.courseId)?.code ?? 'The owner’s class') : 'No class'

  return (
    <div className="flex flex-col gap-6 p-4">
      <section className="flex flex-col gap-1">
        <Prop icon={BookOpen} label="Class">
          {owner ? (
            <Select size="sm" tone="control" ariaLabel="Class" value={note.courseId ?? NONE} className="w-full"
              onChange={(v) => props.onChange({ courseId: v === NONE ? null : v, week: v === NONE ? null : note.week })}
              options={[{ value: NONE, label: 'No class' }, ...courses.map((c) => ({ value: c.id, label: c.code || c.title || 'Untitled' }))]} />
          ) : <Value>{className}</Value>}
        </Prop>
        <Prop icon={CalendarRange} label="Week">
          {owner ? (
            <Select size="sm" tone="control" ariaLabel="Week" value={note.week ? String(note.week) : NONE} className="w-full"
              onChange={(v) => props.onChange({ week: v === NONE ? null : Number(v) })}
              options={[{ value: NONE, label: 'No week' }, ...Array.from({ length: 15 }, (_, i) => ({ value: String(i + 1), label: `Week ${i + 1}` }))]} />
          ) : <Value>{note.week ? `Week ${note.week}` : 'No week'}</Value>}
        </Prop>
        {owner && (
          <Prop icon={FolderClosed} label="Folder">
            <Select size="sm" tone="control" ariaLabel="Folder" value={note.folderId ?? NONE} className="w-full"
              onChange={(v) => props.onChange({ folderId: v === NONE ? null : v })}
              options={[{ value: NONE, label: 'General' }, ...folders.map((f) => ({ value: f.id, label: folderName(f) }))]} />
          </Prop>
        )}
        {owner && (
          <Prop icon={Pin} label="Pinned">
            <span className="flex justify-end"><Switch checked={note.pinned} onChange={(v) => props.onChange({ pinned: v })} label="Pin to the top of its folder" /></span>
          </Prop>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <Heading>Assignments</Heading>
        {linked.length === 0 && !owner && <p className="text-[12.5px] text-subtle">None linked.</p>}
        {linked.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {linked.map((a) => {
              const c = courseById.get(a.courseId)
              return (
                <span key={a.id} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-surface-2 py-0.5 pr-1 pl-1.5 text-[12px] text-fg">
                  {c && <CourseChip code={c.code} color={c.color} />}
                  <span className="truncate">{a.title}</span>
                  {owner && (
                    <button type="button" aria-label={`Unlink ${a.title}`} onClick={() => props.onChange({ assignmentIds: note.assignmentIds.filter((id) => id !== a.id) })}
                      className="grid size-5 place-items-center rounded-full text-subtle hover:bg-surface hover:text-fg"><X size={12} aria-hidden /></button>
                  )}
                </span>
              )
            })}
          </div>
        )}
        {owner && candidates.length > 0 && (
          <Select size="sm" tone="control" searchable ariaLabel="Link an assignment" placeholder="+ Link an assignment" value="" className="w-full"
            onChange={(id) => id && props.onChange({ assignmentIds: [...note.assignmentIds, id] })}
            options={candidates.map((a) => ({ value: a.id, label: `${courseById.get(a.courseId)?.code ?? ''} · ${a.title}`.replace(/^ · /, '') }))} />
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Heading>People</Heading>
          {owner && (
            <button type="button" onClick={props.onShare} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-accent hover:underline">
              <Share2 size={13} aria-hidden />Share
            </button>
          )}
        </div>
        <ul className="flex flex-col gap-2.5">
          {people.map((p) => {
            const status = props.live.get(p.userId)
            const ring = status === 'active' ? 'var(--ct-success)' : status === 'idle' ? 'var(--ct-subtle)' : null
            return (
              <li key={p.userId} className="flex items-center gap-2.5">
                <span className="relative rounded-full transition-shadow duration-300" style={ring ? { boxShadow: `0 0 0 2px var(--ct-surface), 0 0 0 4px ${ring}` } : undefined}>
                  <PersonAvatar person={{ handle: p.handle ?? '', name: p.name, avatar_url: p.avatarUrl }} className="size-8" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-fg">{p.name || `@${p.handle}`}</span>
                  <span className={cn('block truncate text-[11.5px]', status === 'active' ? 'text-success' : 'text-subtle')}>
                    {status === 'active' ? 'Here now' : status === 'idle' ? 'Open in another tab' : p.lastViewedAt ? `Viewed ${ago(p.lastViewedAt)}` : 'Not opened yet'}
                    {p.lastEditedAt ? ` · edited ${ago(p.lastEditedAt)}` : ''}
                  </span>
                </span>
                <span className="text-[11px] text-subtle capitalize">{p.role}</span>
              </li>
            )
          })}
        </ul>
      </section>

      <p className="border-t border-border pt-3 text-[11.5px] leading-relaxed text-subtle">
        Created {new Date(note.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
        <br />
        Last edited {ago(lastEditor?.lastEditedAt ?? note.updatedAt)}{lastEditor?.name ? ` by ${lastEditor.name}` : ''}
      </p>
    </div>
  )
}

function Prop({ icon: Icon, label, children }: { icon: typeof Pin; label: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-10 grid-cols-[6.5rem_1fr] items-center gap-2">
      <span className="flex items-center gap-2 text-[12.5px] text-muted"><Icon size={14} className="text-subtle" aria-hidden />{label}</span>
      {children}
    </div>
  )
}

const Value = ({ children }: { children: React.ReactNode }) => <span className="truncate px-1 text-[13px] text-fg">{children}</span>
const Heading = ({ children }: { children: React.ReactNode }) => <h3 className="text-[11px] font-semibold tracking-wide text-subtle uppercase">{children}</h3>
