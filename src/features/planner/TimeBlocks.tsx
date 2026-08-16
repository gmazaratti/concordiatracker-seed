import { useState } from 'react'
import { Ban, Plus, X } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import { weekdayNames } from '@/lib/date'
import type { TimeBlock } from '@/lib/schedules'

/**
 * Times you are not available.
 *
 * The constraint most students actually plan around is not "which courses do I
 * want" but "I work Tuesdays" or "I am not doing 8am". Marking those first
 * turns the section list from a wall of options into a shortlist.
 *
 * Blocks never remove a section from the search - they grey it and say why.
 * The student set the constraint and can decide to break it.
 */

const HOURS = Array.from({ length: 15 }, (_, i) => {
  const h = i + 7
  return { value: `${String(h).padStart(2, '0')}:00`, label: `${String(h).padStart(2, '0')}:00` }
})

let seq = 0

export function TimeBlocks({
  blocks,
  onChange,
}: {
  blocks: TimeBlock[]
  onChange: (next: TimeBlock[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [day, setDay] = useState('1')
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('12:00')
  const [label, setLabel] = useState('')
  const names = weekdayNames()

  function add() {
    if (start >= end) return
    onChange([
      ...blocks,
      {
        id: `b${seq++}-${Date.now()}`,
        day: Number(day),
        start,
        end,
        label: label.trim() || 'Busy',
      },
    ])
    setLabel('')
    setOpen(false)
  }

  return (
    <div className="mt-4">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-wide text-subtle uppercase">
          Times to avoid
        </p>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1 text-[11.5px] font-medium text-muted transition-colors duration-150 hover:text-accent"
        >
          <Plus size={11} aria-hidden />
          Block
        </button>
      </div>

      {open && (
        <div className="mb-2 space-y-2 rounded-lg border border-border bg-surface p-2.5">
          <Select
            value={day}
            onChange={setDay}
            ariaLabel="Day to block"
            size="sm"
            options={[1, 2, 3, 4, 5].map((d) => ({ value: String(d), label: names[d] }))}
          />
          <div className="grid grid-cols-2 gap-2">
            <Select value={start} onChange={setStart} ariaLabel="Block starts" size="sm" options={HOURS} />
            <Select value={end} onChange={setEnd} ariaLabel="Block ends" size="sm" options={HOURS} />
          </div>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') add()
            }}
            placeholder="Work, commute, gym"
            aria-label="What is this time for"
            className="w-full rounded-lg border border-border bg-canvas px-2.5 py-1.5 text-[12px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
          />
          {start >= end && (
            <p className="text-[11px] text-danger">The end has to be after the start.</p>
          )}
          <button
            type="button"
            onClick={add}
            disabled={start >= end}
            className="w-full rounded-lg bg-accent py-1.5 text-[12px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover disabled:opacity-50"
          >
            Block this time
          </button>
        </div>
      )}

      {blocks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-2.5 py-3 text-[11.5px] leading-relaxed text-subtle">
          Block the hours you work or travel, and sections that clash get marked in the list.
        </p>
      ) : (
        <ul className="space-y-1">
          {blocks.map((b) => (
            <li
              key={b.id}
              className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5"
            >
              <Ban size={11} className="shrink-0 text-subtle" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-[11.5px] text-fg">
                {names[b.day].slice(0, 3)} {b.start}–{b.end}
                <span className="ml-1 text-subtle">{b.label}</span>
              </span>
              <button
                type="button"
                onClick={() => onChange(blocks.filter((x) => x.id !== b.id))}
                aria-label={`Remove ${b.label}`}
                className="grid size-5 shrink-0 place-items-center rounded text-subtle transition-colors duration-150 hover:text-danger"
              >
                <X size={11} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
