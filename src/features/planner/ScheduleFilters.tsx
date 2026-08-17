import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Plus, SlidersHorizontal, X } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import { termLabel } from '@/lib/seats'
import type { TimeBlock } from '@/lib/schedules'
import { weekdayNames } from '@/lib/date'
import { cn } from '@/lib/cn'

/**
 * Everything that narrows what you see, behind one control.
 *
 * Term, eligibility and blocked time were three controls in three shapes - a
 * dropdown, a checkbox and a panel with its own button - sitting in three
 * places. They do one job between them: decide which sections are worth
 * looking at. One button, one popover, one shape.
 *
 * The count on the button matters more than it looks: a filter you have
 * forgotten about is a filter that makes the product look broken when a course
 * you know exists does not appear.
 */

/** Half-hour steps across a day that anybody actually schedules around. */
const TIMES = Array.from({ length: 34 }, (_, i) => {
  const m = 7 * 60 + i * 30
  return {
    value: `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`,
    label: `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`,
  }
})

const EVERY_DAY = 'all'

export function ScheduleFilters({
  termCode,
  onTermChange,
  terms,
  eligibleOnly,
  onEligibleChange,
  eligibleAvailable,
  blocks,
  onBlocksChange,
}: {
  termCode: string
  onTermChange: (t: string) => void
  terms: string[]
  eligibleOnly: boolean
  onEligibleChange: (v: boolean) => void
  eligibleAvailable: boolean
  blocks: TimeBlock[]
  onBlocksChange: (next: TimeBlock[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const names = weekdayNames()

  const active = (termCode ? 1 : 0) + (eligibleOnly ? 1 : 0) + (blocks.length > 0 ? 1 : 0)

  useEffect(() => {
    if (!open) return
    const place = () => {
      const r = wrapRef.current?.getBoundingClientRect()
      if (r) setPos({ top: r.bottom + 6, right: window.innerWidth - r.right })
    }
    place()
    const onDown = (e: MouseEvent) => {
      // The popover is portaled to <body>, so it is NOT inside wrapRef. Testing
      // only the trigger meant every click INSIDE the panel counted as an
      // outside click and closed it — which is why removing a blocked day did
      // nothing: the panel was gone before the button's click ever landed.
      const t = e.target as Node
      if (wrapRef.current?.contains(t) || popRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title="Narrow which sections you see: term, eligibility, and times you are not free"
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12.5px] font-medium transition-colors duration-150',
          active > 0
            ? 'border-accent bg-accent-soft text-accent'
            : 'border-border text-muted hover:border-accent hover:text-fg',
        )}
      >
        <SlidersHorizontal size={13} aria-hidden />
        Filters
        {active > 0 && (
          <span className="rounded-full bg-accent px-1.5 text-[10.5px] font-semibold text-accent-contrast">
            {active}
          </span>
        )}
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={popRef}
            style={{ position: 'fixed', top: pos.top, right: pos.right }}
            className="z-[60] max-h-[70vh] w-[310px] overflow-y-auto rounded-xl border border-border bg-surface p-3 shadow-lg"
          >
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold tracking-wide text-subtle uppercase">
                Term
              </span>
              <Select
                value={termCode}
                onChange={onTermChange}
                ariaLabel="Term"
                placeholder="Any term"
                size="sm"
                options={[
                  { value: '', label: 'Any term' },
                  ...terms.map((c) => ({ value: c, label: termLabel(c) })),
                ]}
              />
            </label>

            <button
              type="button"
              role="switch"
              aria-checked={eligibleOnly}
              disabled={!eligibleAvailable}
              onClick={() => onEligibleChange(!eligibleOnly)}
              title={
                eligibleAvailable
                  ? 'Hide courses whose prerequisites you have not met'
                  : 'Mark your record complete in My record to use this'
              }
              className="mt-3 flex w-full items-center gap-2 text-left text-[12.5px] text-muted transition-colors duration-150 hover:text-fg disabled:opacity-50"
            >
              <span
                className={cn(
                  'grid size-4 shrink-0 place-items-center rounded-full border transition-colors duration-150',
                  eligibleOnly ? 'border-accent bg-accent' : 'border-border-strong',
                )}
              >
                {eligibleOnly && <Check size={10} className="text-accent-contrast" aria-hidden />}
              </span>
              Only what I can take
            </button>

            <div className="mt-3 border-t border-border pt-3">
              <span className="mb-1.5 block text-[11px] font-semibold tracking-wide text-subtle uppercase">
                Times to avoid
              </span>

              {blocks.length > 0 && (
                <ul className="mb-2 space-y-1">
                  {blocks.map((b) => (
                    <li
                      key={b.id}
                      className="flex items-center gap-2 rounded-lg border border-border bg-canvas px-2 py-1.5"
                    >
                      <span className="min-w-0 flex-1 truncate text-[11.5px] text-fg">
                        {names[b.day].slice(0, 3)} {b.start}–{b.end}
                        <span className="ml-1 text-subtle">{b.label}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => onBlocksChange(blocks.filter((x) => x.id !== b.id))}
                        aria-label={`Remove ${b.label}`}
                        className="grid size-5 shrink-0 place-items-center rounded text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-danger"
                      >
                        <X size={11} aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <AddBlock existing={blocks} onAdd={(next) => onBlocksChange([...blocks, ...next])} />

              <p className="mt-2 hidden text-[11px] leading-relaxed text-subtle md:block">
                Or drag straight down a column on the calendar.
              </p>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

/**
 * Type a block instead of drawing one.
 *
 * Needed on phones, where dragging is scrolling, and better than dragging
 * anywhere when the answer is "every weekday before ten" — that is one sentence
 * and five drags.
 */
function AddBlock({
  existing,
  onAdd,
}: {
  existing: TimeBlock[]
  onAdd: (blocks: TimeBlock[]) => void
}) {
  const names = weekdayNames()
  const [day, setDay] = useState<string>(EVERY_DAY)
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('12:00')
  const [label, setLabel] = useState('')
  const invalid = end <= start

  function add() {
    if (invalid) return
    const days = day === EVERY_DAY ? [1, 2, 3, 4, 5] : [Number(day)]
    const text = label.trim() || 'Busy'
    onAdd(
      days.map((d, i) => ({
        id: `b${String(existing.length + i)}-${d}-${start}-${end}`,
        day: d,
        start,
        end,
        label: text,
      })),
    )
    setLabel('')
  }

  return (
    <div className="rounded-lg border border-border bg-canvas p-2">
      <div className="grid grid-cols-2 gap-1.5">
        <span className="col-span-2">
          <Select
            value={day}
            onChange={setDay}
            ariaLabel="Day to block"
            size="sm"
            tone="control"
            options={[
              { value: EVERY_DAY, label: 'Every weekday' },
              ...[1, 2, 3, 4, 5].map((d) => ({ value: String(d), label: names[d] })),
            ]}
          />
        </span>
        <Select
          value={start}
          onChange={setStart}
          ariaLabel="From"
          size="sm"
          tone="control"
          options={TIMES}
        />
        <Select
          value={end}
          onChange={setEnd}
          ariaLabel="To"
          size="sm"
          tone="control"
          options={TIMES}
        />
      </div>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Work, commute, gym…"
        aria-label="What is this time for"
        className="mt-1.5 w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-[12px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
      />
      {invalid && <p className="mt-1 text-[11px] text-danger">The end has to be after the start.</p>}
      <button
        type="button"
        onClick={add}
        disabled={invalid}
        className="mt-1.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-2.5 py-1.5 text-[12px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover disabled:opacity-50"
      >
        <Plus size={12} aria-hidden />
        Block this time
      </button>
    </div>
  )
}
