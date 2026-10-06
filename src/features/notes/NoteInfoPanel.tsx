import { useMemo } from 'react'
import { BookmarkPlus, Check, CloudOff, History, Loader2, Pin, PinOff, Share2, Trash2, X } from 'lucide-react'
import type { Assessment, Course } from '@/data/types'
import { Select } from '@/components/ui/Select'
import { CourseChip } from '@/components/CourseChip'
import { PersonAvatar } from '@/features/community/PersonAvatar'
import { cn } from '@/lib/cn'
import { ago } from './note-format'
import type { NotePerson } from './sharing-api'
import type { SaveState } from './useAutosave'
import type { NoteFolder, NoteMeta, NoteRole } from './types'

const NONE = '__none__'

/** Everything about a note that is not its text, beside the page. */
export function NoteInfoPanel(props: {
  note: NoteMeta
  title: string
  onTitle: (v: string) => void
  save: SaveState
  role: NoteRole
  courses: Course[]
  folders: NoteFolder[]
  assessments: Assessment[]
  people: NotePerson[]
  presentIds: Set<string>
  onChange: (patch: Partial<NoteMeta>) => void
  onShare: () => void
  onHistory: () => void
  onSaveTemplate: () => void
  onTrash: () => void
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

  return (
    <div className="flex flex-col gap-5 p-4">
      <div>
        <textarea value={props.title} onChange={(e) => props.onTitle(e.target.value)} readOnly={role === 'viewer'} rows={2}
          maxLength={200} placeholder="Untitled note" aria-label="Title"
          className="w-full resize-none bg-transparent text-[17px] leading-snug font-semibold text-fg outline-none placeholder:text-subtle" />
        <p className="mt-1 flex items-center gap-1.5 text-[12px] text-subtle">
          <SaveIcon state={props.save} />
          {props.save === 'error' ? 'Not saved' : props.save === 'saved' ? 'All changes saved' : 'Saving…'}
        </p>
        <p className="mt-0.5 text-[12px] text-subtle">
          Last edited {ago(lastEditor?.lastEditedAt ?? note.updatedAt)}
          {lastEditor?.name ? ` by ${lastEditor.name}` : ''}
        </p>
      </div>

      <Group label="Details">
        <Row label="Class">
          {owner ? (
            <Select size="sm" tone="control" ariaLabel="Class" value={note.courseId ?? NONE} className="w-full"
              onChange={(v) => props.onChange({ courseId: v === NONE ? null : v, week: v === NONE ? null : note.week })}
              options={[{ value: NONE, label: 'No class' }, ...courses.map((c) => ({ value: c.id, label: c.code || c.title || 'Untitled' }))]} />
          ) : <span className="text-[13px] text-fg">{note.courseId ? (courseById.get(note.courseId)?.code ?? 'The owner’s class') : 'No class'}</span>}
        </Row>
        <Row label="Week">
          {owner ? (
            <Select size="sm" tone="control" ariaLabel="Week" value={note.week ? String(note.week) : NONE} className="w-full"
              onChange={(v) => props.onChange({ week: v === NONE ? null : Number(v) })}
              options={[{ value: NONE, label: 'No week' }, ...Array.from({ length: 15 }, (_, i) => ({ value: String(i + 1), label: `Week ${i + 1}` }))]} />
          ) : <span className="text-[13px] text-fg">{note.week ? `Week ${note.week}` : '—'}</span>}
        </Row>
        {owner && (
          <Row label="Folder">
            <Select size="sm" tone="control" ariaLabel="Folder" value={note.folderId ?? NONE} className="w-full"
              onChange={(v) => props.onChange({ folderId: v === NONE ? null : v })}
              options={[{ value: NONE, label: 'General' }, ...folders.map((f) => ({ value: f.id, label: folderName(f) }))]} />
          </Row>
        )}
        {owner && (
          <button type="button" onClick={() => props.onChange({ pinned: !note.pinned })} aria-pressed={note.pinned}
            className={cn('flex h-8 items-center gap-1.5 rounded-lg px-2 text-[12.5px] font-medium transition-colors duration-150', note.pinned ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2 hover:text-fg')}>
            {note.pinned ? <PinOff size={14} aria-hidden /> : <Pin size={14} aria-hidden />}
            {note.pinned ? 'Pinned to the top' : 'Pin to the top'}
          </button>
        )}
      </Group>

      <Group label="Assignments">
        {linked.length === 0 && !owner && <p className="text-[12.5px] text-subtle">None linked.</p>}
        <div className="flex flex-wrap gap-1.5">
          {linked.map((a) => {
            const c = courseById.get(a.courseId)
            return (
              <span key={a.id} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-surface-2 py-0.5 pr-1 pl-1.5 text-[12px] text-fg">
                {c && <CourseChip code={c.code} color={c.color} />}
                <span className="truncate">{a.title}</span>
                {owner && (
                  <button type="button" aria-label={`Unlink ${a.title}`} onClick={() => props.onChange({ assignmentIds: note.assignmentIds.filter((id) => id !== a.id) })}
                    className="grid size-5 place-items-center rounded-full text-subtle hover:bg-surface hover:text-fg">
                    <X size={12} aria-hidden />
                  </button>
                )}
              </span>
            )
          })}
        </div>
        {owner && candidates.length > 0 && (
          <Select size="sm" tone="control" searchable ariaLabel="Link an assignment" placeholder="+ Link assignment" value="" className="w-full"
            onChange={(id) => id && props.onChange({ assignmentIds: [...note.assignmentIds, id] })}
            options={candidates.map((a) => ({ value: a.id, label: `${courseById.get(a.courseId)?.code ?? ''} · ${a.title}`.replace(/^ · /, '') }))} />
        )}
      </Group>

      <Group label="People" action={owner ? <button type="button" onClick={props.onShare} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-accent hover:underline"><Share2 size={13} aria-hidden />Share</button> : null}>
        <ul className="flex flex-col gap-2">
          {people.map((p) => {
            const here = props.presentIds.has(p.userId)
            return (
              <li key={p.userId} className="flex items-center gap-2.5">
                <span className="relative">
                  <PersonAvatar person={{ handle: p.handle ?? '', name: p.name, avatar_url: p.avatarUrl }} className="size-8" />
                  <span className={cn('absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-canvas transition-colors duration-300', here ? 'bg-success' : 'bg-border-strong')} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[13px] text-fg">{p.name || `@${p.handle}`}</span>
                    <span className="shrink-0 rounded-full bg-surface-2 px-1.5 text-[10.5px] font-medium text-subtle capitalize">{p.role}</span>
                  </span>
                  <span className="block truncate text-[11.5px] text-subtle">
                    {here ? 'Active now' : p.lastViewedAt ? `Viewed ${ago(p.lastViewedAt)}` : 'Not opened yet'}
                    {p.lastEditedAt ? ` · edited ${ago(p.lastEditedAt)}` : ''}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      </Group>

      <div className="flex flex-col gap-0.5 border-t border-border pt-3">
        <PanelAction icon={History} label="Version history" onClick={props.onHistory} />
        {owner && <PanelAction icon={BookmarkPlus} label="Save as template" onClick={props.onSaveTemplate} />}
        {owner && <PanelAction icon={Trash2} label="Move to trash" onClick={props.onTrash} danger />}
      </div>
    </div>
  )
}

function SaveIcon({ state }: { state: SaveState }) {
  if (state === 'error') return <CloudOff size={13} className="text-danger" aria-hidden />
  if (state === 'saved') return <Check size={13} aria-hidden />
  return <Loader2 size={13} className="animate-spin" aria-hidden />
}

function Group({ label, action, children }: { label: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold tracking-wide text-subtle uppercase">{label}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[3.5rem_1fr] items-center gap-2">
      <span className="text-[12.5px] text-muted">{label}</span>
      {children}
    </div>
  )
}

function PanelAction({ icon: Icon, label, onClick, danger }: { icon: typeof History; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className={cn('flex h-8 items-center gap-2 rounded-lg px-2 text-[13px] transition-colors duration-150', danger ? 'text-danger hover:bg-danger/10' : 'text-muted hover:bg-surface-2 hover:text-fg')}>
      <Icon size={15} aria-hidden />
      {label}
    </button>
  )
}
