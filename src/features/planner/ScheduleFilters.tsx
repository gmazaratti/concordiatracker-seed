import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, SlidersHorizontal, X } from 'lucide-react'
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
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
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
            style={{ position: 'fixed', top: pos.top, right: pos.right }}
            className="z-[60] w-[300px] rounded-xl border border-border bg-surface p-3 shadow-lg"
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
              {blocks.length === 0 ? (
                <p className="text-[11.5px] leading-relaxed text-subtle">
                  Drag on the calendar to block hours you work or travel. Sections that clash get
                  marked in the search.
                </p>
              ) : (
                <ul className="space-y-1">
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
                        className="grid size-5 shrink-0 place-items-center rounded text-subtle transition-colors duration-150 hover:text-danger"
                      >
                        <X size={11} aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
