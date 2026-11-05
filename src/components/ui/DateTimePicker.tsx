import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDueDateTime, noDateLabel, tbdLabel } from '@/lib/date'
import { cn } from '@/lib/cn'
import { haptic } from '@/lib/haptics'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const sameDay = (a: Date, b: Date) => ymd(a) === ymd(b)
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)

/** Build the 6×7 (42-cell) grid for the month containing `view`, padded with the
 * trailing days of the previous month and the leading days of the next. */
function monthGrid(view: Date): Date[] {
  const first = startOfMonth(view)
  const start = new Date(first)
  start.setDate(1 - first.getDay())
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

type Pos = { left: number; top?: number; bottom?: number }

function place(el: HTMLElement): Pos {
  const r = el.getBoundingClientRect()
  const estH = 372
  const left = Math.round(Math.max(8, Math.min(r.left, window.innerWidth - 304)))
  const spaceBelow = window.innerHeight - r.bottom
  const flipUp = spaceBelow < estH + 8 && r.top > spaceBelow
  return flipUp
    ? { left, bottom: Math.round(window.innerHeight - r.top + 4) }
    : { left, top: Math.round(r.bottom + 4) }
}

/**
 * A fully custom, token-themed date + time picker (replaces the OS-drawn
 * `datetime-local`). Calendar grid with month nav + a 12-hour time row. The
 * popover is portaled (fixed, flips up near the viewport bottom). Works in ISO:
 * `value` in, `value` out. Composes inside modals — keys `stopPropagation` so a
 * surrounding focus trap doesn't hijack them.
 */
export function DateTimePicker({
  value,
  onChange,
  ariaLabel,
  clearable = false,
  noDate = false,
  onNoDate,
}: {
  /** Null means the date is genuinely not known yet, not "unset by mistake". */
  value: string | null
  onChange: (iso: string | null) => void
  ariaLabel: string
  /**
   * Offer "No date yet".
   *
   * Opt-in, because most dates here are known and a clear button on a personal
   * reminder is a way to make a task that never reminds anyone. It belongs where
   * the SOURCE may genuinely not have a date: a syllabus, a course outline.
   */
  clearable?: boolean
  /**
   * "No date needed" — a third answer, different from "No date yet".
   *
   * Attendance and participation are graded without ever being due on a day.
   * "No date yet" says a date is coming and puts the item under "No date yet"
   * on Today with a caution; this says none ever will, and does neither.
   * Offered only when the caller passes `onNoDate`.
   */
  noDate?: boolean
  onNoDate?: (noDate: boolean) => void
}) {
  // Any date (or "No date yet") is a different answer from "no date needed",
  // so choosing one clears it — the two can never both be true.
  const onChangeDate = (iso: string | null) => {
    if (noDate) onNoDate?.(false)
    haptic('select')
    onChange(iso)
  }
  // With no date the calendar still has to open on some month and focus some
  // day. Today is the least surprising choice; nothing is marked selected.
  const selected = value ? new Date(value) : new Date()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<Pos | null>(null)
  const [view, setView] = useState(() => startOfMonth(selected))
  const [focusDay, setFocusDay] = useState(() => new Date(selected))
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  const hour12 = ((selected.getHours() + 11) % 12) + 1
  const ampm = selected.getHours() < 12 ? 'AM' : 'PM'

  const openMenu = () => {
    const el = triggerRef.current
    if (!el) return
    setPos(place(el))
    setView(startOfMonth(selected))
    setFocusDay(new Date(selected))
    setOpen(true)
  }

  function setDate(day: Date) {
    const next = new Date(selected)
    next.setFullYear(day.getFullYear(), day.getMonth(), day.getDate())
    onChangeDate(next.toISOString())
    setFocusDay(day)
  }
  function setTime(h12: number, minute: number, ap: string) {
    const h24 = ap === 'PM' ? (h12 % 12) + 12 : h12 % 12
    const next = new Date(selected)
    next.setHours(h24, minute, 0, 0)
    onChangeDate(next.toISOString())
  }

  // Move keyboard focus to the focused day cell.
  useEffect(() => {
    if (!open) return
    popRef.current?.querySelector<HTMLElement>(`[data-day="${ymd(focusDay)}"]`)?.focus()
  }, [open, focusDay])

  // Reposition + outside-click dismiss.
  useEffect(() => {
    if (!open) return
    const reposition = () => {
      if (triggerRef.current) setPos(place(triggerRef.current))
    }
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || popRef.current?.contains(t)) return
      setOpen(false)
    }
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    document.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open])

  function moveFocus(deltaDays: number) {
    const next = new Date(focusDay)
    next.setDate(next.getDate() + deltaDays)
    setFocusDay(next)
    if (next.getMonth() !== view.getMonth() || next.getFullYear() !== view.getFullYear())
      setView(startOfMonth(next))
  }

  function onPopKeyDown(e: React.KeyboardEvent) {
    e.stopPropagation() // keep keys away from any surrounding modal trap
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); triggerRef.current?.focus() }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); moveFocus(-1) }
    else if (e.key === 'ArrowRight') { e.preventDefault(); moveFocus(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveFocus(-7) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); moveFocus(7) }
  }

  const today = new Date()
  const days = monthGrid(view)

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        data-state={open ? 'open' : 'closed'}
        onClick={() => (open ? setOpen(false) : openMenu())}
        className="flex w-full items-center gap-2 rounded-lg border border-border-strong bg-surface-2 px-3 py-2 text-left text-[13px] text-fg transition-colors hover:bg-surface"
      >
        <CalendarDays size={15} className="shrink-0 text-subtle" aria-hidden />
        <span className="flex-1 truncate">
          {noDate ? noDateLabel() : value ? formatDueDateTime(value) : tbdLabel()}
        </span>
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={popRef}
            role="dialog"
            aria-label={ariaLabel}
            onKeyDown={onPopKeyDown}
            style={{ position: 'fixed', left: pos.left, top: pos.top, bottom: pos.bottom }}
            className="ct-animate-pop z-[200] w-[296px] rounded-xl border border-border bg-surface p-3 shadow-2xl"
          >
            {/* Month nav */}
            <div className="mb-1.5 flex items-center justify-between">
              <NavBtn label="Previous month" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}>
                <ChevronLeft size={16} aria-hidden />
              </NavBtn>
              <span className="text-[13px] font-semibold text-fg">
                {MONTHS[view.getMonth()]} {view.getFullYear()}
              </span>
              <NavBtn label="Next month" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}>
                <ChevronRight size={16} aria-hidden />
              </NavBtn>
            </div>

            {/* Weekday header */}
            <div className="grid grid-cols-7 text-center text-[11px] font-medium text-subtle">
              {WEEKDAYS.map((w, i) => (
                <span key={i} className="py-1">{w}</span>
              ))}
            </div>

            {/* Days */}
            <div className="grid grid-cols-7">
              {days.map((d) => {
                const isSel = sameDay(d, selected)
                const isToday = sameDay(d, today)
                const otherMonth = d.getMonth() !== view.getMonth()
                return (
                  <button
                    key={ymd(d)}
                    type="button"
                    data-day={ymd(d)}
                    tabIndex={sameDay(d, focusDay) ? 0 : -1}
                    aria-current={isSel ? 'date' : undefined}
                    onClick={() => setDate(d)}
                    className={cn(
                      'mx-auto grid size-9 place-items-center rounded-md text-[13px] outline-none transition-colors duration-100',
                      isSel
                        ? 'bg-accent font-semibold text-accent-contrast'
                        : cn(
                            'hover:bg-surface-2 focus:bg-surface-2',
                            otherMonth ? 'text-subtle/50' : 'text-fg',
                            isToday && 'font-semibold text-accent',
                          ),
                    )}
                  >
                    {d.getDate()}
                  </button>
                )
              })}
            </div>

            {/* Time */}
            <div className="mt-2 flex items-center gap-2 border-t border-border pt-2.5">
              <span className="text-[11px] font-medium tracking-wide text-subtle uppercase">Time</span>
              <button
                type="button"
                onClick={() => setTime(11, 59, 'PM')}
                className="shrink-0 whitespace-nowrap rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted transition-colors hover:border-accent hover:text-fg"
              >
                11:59 PM
              </button>
              <div className="ml-auto flex items-center gap-1.5">
                {/* TYPED, not picked from a list: a 5-minute list cannot say
                    11:59, and that is the most common deadline there is. */}
                <NumberBox
                  ariaLabel="Hour"
                  value={hour12}
                  min={1}
                  max={12}
                  onCommit={(h) => setTime(h, selected.getMinutes(), ampm)}
                />
                <span className="text-subtle">:</span>
                <NumberBox
                  ariaLabel="Minute"
                  value={selected.getMinutes()}
                  min={0}
                  max={59}
                  pad
                  onCommit={(m) => setTime(hour12, m, ampm)}
                />
                <div role="radiogroup" aria-label="AM or PM" className="flex gap-0.5 rounded-lg border border-border bg-canvas p-0.5">
                  {(['AM', 'PM'] as const).map((ap) => (
                    <button
                      key={ap}
                      type="button"
                      role="radio"
                      aria-checked={ampm === ap}
                      onClick={() => setTime(hour12, selected.getMinutes(), ap)}
                      className={cn(
                        'rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                        ampm === ap ? 'bg-surface-2 text-fg' : 'text-muted hover:text-fg',
                      )}
                    >
                      {ap}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-2.5 flex gap-2">
              {/* "Not known yet" is a real answer, and it has to be reachable
                  without picking a date first — otherwise the only way to say
                  it is to enter something wrong and hope to remember. */}
              {clearable && (
                <button
                  type="button"
                  onClick={() => {
                    onChangeDate(null)
                    setOpen(false)
                    triggerRef.current?.focus()
                  }}
                  className={cn(
                    'shrink-0 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors',
                    value || noDate
                      ? 'border-border text-muted hover:text-fg'
                      : 'border-accent bg-accent-soft text-fg',
                  )}
                >
                  No date yet
                </button>
              )}
              {onNoDate && (
                <button
                  type="button"
                  onClick={() => {
                    onChange(null)
                    onNoDate(true)
                    setOpen(false)
                    triggerRef.current?.focus()
                  }}
                  className={cn(
                    'shrink-0 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors',
                    noDate ? 'border-accent bg-accent-soft text-fg' : 'border-border text-muted hover:text-fg',
                  )}
                >
                  No date needed
                </button>
              )}
              <button
                type="button"
                onClick={() => { setOpen(false); triggerRef.current?.focus() }}
                className="flex-1 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-medium text-accent-contrast transition-colors hover:bg-accent-hover"
              >
                Done
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

function NavBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-7 place-items-center rounded-md text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
    >
      {children}
    </button>
  )
}

/**
 * A small typed number (hour or minute). Keeps its own text while you type so
 * "0" on the way to "05" is not snapped away, and commits on Enter or blur,
 * clamped to the range. Arrow keys step it.
 */
function NumberBox({
  value,
  min,
  max,
  pad: padded = false,
  ariaLabel,
  onCommit,
}: {
  value: number
  min: number
  max: number
  pad?: boolean
  ariaLabel: string
  onCommit: (n: number) => void
}) {
  const shown = padded ? String(value).padStart(2, '0') : String(value)
  const [text, setText] = useState<string | null>(null)
  const commit = () => {
    if (text === null) return
    const n = Number.parseInt(text, 10)
    setText(null)
    if (Number.isNaN(n)) return
    onCommit(Math.min(max, Math.max(min, n)))
  }
  return (
    <input
      value={text ?? shown}
      onChange={(e) => setText(e.target.value.replace(/\D/g, '').slice(0, 2))}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault()
          const step = e.key === 'ArrowUp' ? 1 : -1
          const next = value + step
          onCommit(next > max ? min : next < min ? max : next)
        }
      }}
      inputMode="numeric"
      aria-label={ariaLabel}
      className="h-8 w-10 rounded-lg border border-border bg-canvas text-center text-[16px] text-fg tabular-nums outline-none focus:border-accent sm:text-[13px]"
    />
  )
}
