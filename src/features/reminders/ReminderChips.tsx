import { useEffect, useRef, useState } from 'react'
import { Bell, ChevronRight, Plus, X } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import {
  leadLabel,
  MAX_REMINDER_MINUTES,
  MAX_REMINDERS_PER_ITEM,
  REMINDER_PRESETS,
} from '@/lib/reminder-copy'
import { haptic } from '@/lib/haptics'
import { cn } from '@/lib/cn'

const UNITS = [
  { value: '1', label: 'minutes' },
  { value: '60', label: 'hours' },
  { value: '1440', label: 'days' },
] as const

/**
 * The reminders on ONE assignment: the defaults from Settings (shown, not
 * removable here, since they belong to every assignment) plus this one's own,
 * which can be added and removed freely. Own reminders are ADDED to the
 * defaults, never instead of them, and the chips say which is which.
 *
 * Presets cover the common cases in one tap; "Custom" takes any number of
 * minutes, hours or days up to a month.
 */
export function ReminderChips({
  value,
  onChange,
  defaults,
  enabled,
}: {
  value: number[]
  onChange: (next: number[]) => void
  defaults: number[]
  /** The master switch in Settings. Off: the chips still edit, and say so. */
  enabled: boolean
}) {
  const [adding, setAdding] = useState(false)
  const [amount, setAmount] = useState('')
  const [unit, setUnit] = useState<string>('60')
  const own = value.filter((m) => !defaults.includes(m))
  const taken = new Set([...defaults, ...own])
  const full = own.length >= MAX_REMINDERS_PER_ITEM
  const minutes = Math.round(Number(amount) * Number(unit))
  const customOk = Number(amount) > 0 && minutes >= 1 && minutes <= MAX_REMINDER_MINUTES && !taken.has(minutes)

  // ONE LINE that scrolls sideways, with a fade + chevron on whichever edge has
  // more, so it reads as scrollable. Measured, not assumed: the hints only show
  // when the row actually overflows.
  const rowRef = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ left: false, right: false })
  useEffect(() => {
    const el = rowRef.current
    if (!el) return
    const measure = () =>
      setEdges({ left: el.scrollLeft > 2, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 })
    measure()
    el.addEventListener('scroll', measure, { passive: true })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', measure)
      ro.disconnect()
    }
  }, [value, defaults.length, full])

  function add(m: number) {
    if (taken.has(m) || full) return
    haptic('select')
    onChange([...own, m].sort((a, b) => b - a))
    setAdding(false)
    setAmount('')
  }

  return (
    <div>
      <div className="relative rounded-xl border border-border bg-canvas/60">
      <div
        ref={rowRef}
        className="flex items-center gap-1.5 overflow-x-auto px-2.5 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {defaults.map((m) => (
          <span
            key={`d${m}`}
            title="From your default reminders in Settings"
            className="inline-flex min-h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-border px-2.5 text-[12px] text-muted"
          >
            <Bell size={11} aria-hidden />
            {leadLabel(m)}
          </span>
        ))}
        {own.map((m) => (
          <span
            key={`o${m}`}
            className="inline-flex min-h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-accent-soft pl-2.5 text-[12px] font-medium text-accent"
          >
            {leadLabel(m)}
            <button
              type="button"
              onClick={() => {
                haptic('tap')
                onChange(own.filter((x) => x !== m))
              }}
              aria-label={`Remove the ${leadLabel(m)} reminder`}
              className="relative grid size-8 place-items-center rounded-full hover:bg-accent/15"
            >
              <X size={12} aria-hidden />
            </button>
          </span>
        ))}
        {!full && (
          <button
            type="button"
            onClick={() => setAdding((a) => !a)}
            aria-expanded={adding}
            className={cn(
              'inline-flex min-h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-dashed border-border-strong px-2.5 text-[12px] font-medium text-muted hover:text-fg',
              adding && 'border-accent text-fg',
            )}
          >
            <Plus size={12} aria-hidden /> Add
          </button>
        )}
      </div>
      {edges.left && (
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-8 rounded-l-xl bg-gradient-to-r from-surface to-transparent" />
      )}
      {edges.right && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 flex w-12 items-center justify-end rounded-r-xl bg-gradient-to-l from-surface via-surface/80 to-transparent pr-1.5 text-subtle"
        >
          <ChevronRight size={15} />
        </div>
      )}
      </div>
      {defaults.length > 0 && (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-subtle">
          <Bell size={10} aria-hidden /> = your defaults from Settings
        </p>
      )}

      {adding && (
        <div className="mt-2 rounded-lg border border-border bg-canvas p-2.5">
          <div className="flex flex-wrap gap-1.5">
            {REMINDER_PRESETS.filter((m) => !taken.has(m)).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => add(m)}
                className="min-h-8 rounded-full border border-border px-2.5 text-[12px] text-fg hover:border-accent"
              >
                {leadLabel(m)}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customOk) {
                  e.preventDefault()
                  add(minutes)
                }
              }}
              inputMode="numeric"
              placeholder="45"
              aria-label="Custom reminder: how long before"
              className="w-16 rounded-lg border border-border bg-surface px-2 py-1.5 text-center text-[13px] text-fg outline-none focus:border-border-strong"
            />
            <Select
              ariaLabel="Unit"
              size="sm"
              value={unit}
              onChange={setUnit}
              options={UNITS.map((u) => ({ value: u.value, label: u.label }))}
              className="w-28"
            />
            <span className="text-[12px] text-subtle">before</span>
            <button
              type="button"
              disabled={!customOk}
              onClick={() => add(minutes)}
              className="ml-auto min-h-8 rounded-lg bg-accent px-3 text-[12px] font-medium text-accent-contrast disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {!enabled && (
        <p className="mt-1.5 text-[11.5px] text-warning">
          Assignment reminders are off in Settings, so none of these will be sent until you turn them back on.
        </p>
      )}
    </div>
  )
}
