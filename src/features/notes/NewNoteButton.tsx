import { ChevronDown, FileText, LayoutTemplate, ListChecks, Plus, Trash2 } from 'lucide-react'
import { DropdownMenu, type MenuItem } from '@/components/ui/DropdownMenu'
import type { NoteTemplate } from './types'

/**
 * A split button: the main half makes a blank note (the common case, one
 * click), the arrow opens the templates. A custom template can be deleted from
 * the same menu; built-in ones cannot.
 */
export function NewNoteButton({
  templates,
  onNew,
  onNewTask,
  taskFirst,
  onDeleteTemplate,
}: {
  templates: NoteTemplate[]
  onNew: (template: NoteTemplate | null) => void
  /** A task: a note that also shows on Today and the calendar. */
  onNewTask: () => void
  /** In the Tasks folder the main half makes a task instead of a note. */
  taskFirst?: boolean
  onDeleteTemplate: (id: string) => void
}) {
  const custom = templates.filter((t) => !t.builtIn)
  const items: MenuItem[] = [
    { id: 'blank', label: 'Blank note', icon: FileText, onSelect: () => onNew(null) },
    { id: 'task', label: 'Task (shows on Today)', icon: ListChecks, onSelect: onNewTask },
    ...templates.map((t, i) => ({
      id: t.id,
      label: t.name,
      icon: LayoutTemplate,
      onSelect: () => onNew(t),
      separated: i === 0,
    })),
    ...custom.map((t, i) => ({
      id: `del:${t.id}`,
      label: `Delete “${t.name}”`,
      icon: Trash2,
      danger: true,
      separated: i === 0,
      onSelect: () => onDeleteTemplate(t.id),
    })),
  ]
  return (
    <div className="flex items-stretch overflow-hidden rounded-lg bg-accent text-accent-contrast">
      <button
        type="button"
        onClick={() => (taskFirst ? onNewTask() : onNew(null))}
        className="inline-flex h-8 items-center gap-1.5 pr-2 pl-2.5 text-[13px] font-semibold transition-colors duration-150 hover:bg-accent-hover"
      >
        <Plus size={15} aria-hidden />
        {taskFirst ? 'New task' : 'New note'}
      </button>
      <span className="w-px bg-accent-contrast/20" aria-hidden />
      <DropdownMenu
        ariaLabel="New from a template"
        icon={ChevronDown}
        items={items}
        triggerClassName="h-8 w-7 rounded-none text-accent-contrast hover:bg-accent-hover hover:text-accent-contrast"
      />
    </div>
  )
}
