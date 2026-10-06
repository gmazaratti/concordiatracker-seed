import { useState } from 'react'
import { Link } from 'react-router-dom'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { CalendarCheck, CalendarClock, CalendarPlus } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { DateTimePicker } from '@/components/ui/DateTimePicker'
import { formatDueDateTime } from '@/lib/date'
import { ChipPopover } from './ChipPopover'
import { takeDateChipOpen } from './chip-state'

/** The words of the line the date sits on, without the date: a good default title. */
function lineText(props: NodeViewProps): string {
  const pos = typeof props.getPos === 'function' ? props.getPos() : undefined
  if (typeof pos !== 'number') return ''
  const $pos = props.editor.state.doc.resolve(pos)
  return $pos.parent.textContent.replace(/\s+/g, ' ').trim().slice(0, 120)
}

/**
 * A date or time in a note, as a chip. Clicking it shows the date, lets an
 * editor change it, and offers "Add to calendar" with a title and a note —
 * the task then shows on Today and in the calendar like any other.
 */
export function DateChip(props: NodeViewProps) {
  const { node, updateAttributes, editor } = props
  const { addTask } = useAppData()
  const iso = (node.attrs.iso as string | null) ?? null
  const [open, setOpen] = useState(() => takeDateChipOpen() && editor.isEditable)
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [added, setAdded] = useState(false)
  const [chip, setChip] = useState<HTMLSpanElement | null>(null)

  const openPanel = () => {
    setTitle(lineText(props) || 'Reminder')
    setAdded(false)
    setOpen(true)
  }

  return (
    <NodeViewWrapper as="span" className="inline">
      <span ref={setChip} role="button" tabIndex={0} contentEditable={false}
        onClick={() => (open ? setOpen(false) : openPanel())} onKeyDown={(e) => e.key === 'Enter' && openPanel()}
        className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-info/12 px-1.5 py-px align-baseline text-[0.92em] font-medium text-info hover:bg-info/20">
        <CalendarClock size={13} className="shrink-0" aria-hidden />
        {iso ? formatDueDateTime(iso) : 'Pick a date'}
      </span>
      {open && (
        <ChipPopover anchor={chip} onClose={() => setOpen(false)} label="Date">
          <div className="flex flex-col gap-2.5">
            {editor.isEditable ? (
              <DateTimePicker value={iso} onChange={(v) => v && updateAttributes({ iso: v })} ariaLabel="Date and time" />
            ) : (
              <p className="text-[14px] font-semibold text-fg">{iso ? formatDueDateTime(iso) : 'No date'}</p>
            )}
            {added ? (
              <div className="flex items-center gap-2 rounded-lg bg-success/10 px-2.5 py-2 text-[12.5px] text-fg">
                <CalendarCheck size={15} className="text-success" aria-hidden />
                Added to your calendar.
                <Link to="/app/calendar" className="ml-auto font-medium text-accent hover:underline">View</Link>
              </div>
            ) : (
              <>
                <p className="pt-1 text-[11.5px] font-semibold tracking-wide text-subtle uppercase">Add to calendar</p>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" aria-label="Title"
                  className="h-9 rounded-lg border border-border bg-surface-2 px-2.5 text-[13px] text-fg outline-none focus:border-accent" />
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Notes (optional)" aria-label="Notes"
                  className="resize-none rounded-lg border border-border bg-surface-2 px-2.5 py-2 text-[13px] text-fg outline-none focus:border-accent" />
                <button type="button" disabled={!iso || !title.trim()}
                  onClick={() => { if (!iso) return; addTask({ title: title.trim().slice(0, 200), due: iso, note: note.trim() || undefined }); setAdded(true) }}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-accent text-[13px] font-semibold text-accent-contrast hover:bg-accent-hover disabled:opacity-40">
                  <CalendarPlus size={15} aria-hidden /> Add to calendar
                </button>
              </>
            )}
          </div>
        </ChipPopover>
      )}
    </NodeViewWrapper>
  )
}
