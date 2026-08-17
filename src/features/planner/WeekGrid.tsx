import { useRef, useState } from 'react'
import { weekdayNames } from '@/lib/date'
import { cn } from '@/lib/cn'
import { gridBounds, toMinutes, type Block, type Conflict, type Placed } from './schedule'

/**
 * The week, always drawn, and draggable.
 *
 * Rendered even when empty, because an empty grid reads as "your timetable goes
 * here" while an empty page reads as broken. It is also the surface blocked time
 * is drawn on, so it has to exist before any course does.
 *
 * Dragging on it blocks time. That is the natural gesture for "I am busy then"
 * and it beats a form: you can see the hours you are carving out against the
 * classes already there, which is the whole reason you are blocking them.
 *
 * WITH A MOUSE ONLY. On a touch screen that same gesture is scrolling, and it
 * cannot be both — trying to serve both meant blocking out Tuesday afternoon
 * every time someone swiped down the page. Phones get the typed form in Filters
 * instead, which is a better fit for a thumb anyway.
 */
const PX_PER_MIN = 0.9
/** Blocks snap to half hours. Nobody is busy from 09:07. */
const SNAP = 30
/** Movement, in pixels, before a press counts as a drag rather than a click. */
const DRAG_THRESHOLD = 4

export function WeekGrid({
  placed,
  blocks,
  colourOf,
  conflicts,
  onBlock,
  onRemoveBlock,
}: {
  placed: Placed[]
  blocks: Block[]
  colourOf: Map<string, string>
  conflicts: Conflict[]
  /** Absent on a shared schedule, which is read-only. */
  onBlock?: (day: number, start: string, end: string) => void
  /** Right-click a block to take it off. Same read-only rule. */
  onRemoveBlock?: (id: string) => void
}) {
  const [drag, setDrag] = useState<{
    day: number
    from: number
    to: number
    /** False until the pointer has actually travelled. A press is not a block. */
    moved: boolean
  } | null>(null)
  const colRef = useRef<HTMLDivElement>(null)
  /** Where the press started, for the movement threshold. */
  const pressY = useRef(0)

  const blockBounds = blocks.map((b) => ({
    slot: { day: b.day, start: b.start, end: b.end, startMinutes: 0 },
  })) as unknown as Placed[]
  const { start, end } = gridBounds([...placed, ...blockBounds])
  const span = Math.max(end - start, 240)
  const hours = Array.from({ length: Math.ceil(span / 60) + 1 }, (_, i) => start + i * 60)
  const days = [1, 2, 3, 4, 5]
  const names = weekdayNames()
  const clashing = new Set(
    conflicts.flatMap((c) => [c.a, c.b]).map((p) => p.section.classNumber + p.slot.day + p.slot.start),
  )

  const hhmm = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

  /** Where in the day a pointer is, snapped. */
  function minutesAt(clientY: number): number {
    const box = colRef.current?.getBoundingClientRect()
    if (!box) return start
    const raw = start + (clientY - box.top) / PX_PER_MIN
    return Math.max(start, Math.min(end, Math.round(raw / SNAP) * SNAP))
  }

  function finishDrag() {
    if (!drag || !onBlock) return setDrag(null)
    const from = Math.min(drag.from, drag.to)
    const to = Math.max(drag.from, drag.to)
    // Both conditions matter. `moved` rules out a plain click, which used to
    // create a silent half-hour block because the drag was seeded at
    // from + SNAP; the length check rules out a drag that went nowhere.
    if (drag.moved && to - from >= SNAP) onBlock(drag.day, hhmm(from), hhmm(to))
    setDrag(null)
  }

  return (
    <div className="rounded-xl border border-border bg-surface print:border-0">
      <div className="overflow-x-auto">
        <div className="min-w-[296px]">
          <div className="grid grid-cols-[30px_repeat(5,minmax(0,1fr))] border-b border-border sm:grid-cols-[38px_repeat(5,minmax(0,1fr))]">
            <span />
            {days.map((d) => (
              <span key={d} className="px-0.5 py-2 text-center text-[11px] font-medium text-subtle sm:px-1 sm:text-[11.5px]">
                {names[d].slice(0, 3)}
              </span>
            ))}
          </div>

          <div
            className="relative grid grid-cols-[30px_repeat(5,minmax(0,1fr))] sm:grid-cols-[38px_repeat(5,minmax(0,1fr))]"
            // One extra row of height so the last hour label is not clipped in
            // half by its own centring, which is what was cutting 18:00 off.
            style={{ height: span * PX_PER_MIN + 18 }}
            onPointerUp={finishDrag}
            onPointerLeave={() => setDrag(null)}
          >
            <div className="relative">
              {hours.map((m) => (
                <span
                  key={m}
                  className="absolute right-1 -translate-y-1/2 text-[9.5px] text-subtle tabular-nums sm:right-1.5 sm:text-[10.5px]"
                  style={{ top: (m - start) * PX_PER_MIN + 9 }}
                >
                  {hhmm(m)}
                </span>
              ))}
            </div>

            {days.map((day) => (
              <div
                key={day}
                ref={day === 1 ? colRef : undefined}
                className={cn('relative border-l border-border/60', onBlock && 'md:cursor-crosshair')}
                style={{ paddingTop: 9 }}
                onPointerDown={(e) => {
                  // Touch and pen scroll the page. Only a mouse draws.
                  if (!onBlock || e.pointerType !== 'mouse') return
                  // Only an empty part of the grid starts a drag; pressing on a
                  // class should not silently become "block this class".
                  if ((e.target as HTMLElement).closest('[data-block-target="no"]')) return
                  e.currentTarget.setPointerCapture(e.pointerId)
                  pressY.current = e.clientY
                  const m = minutesAt(e.clientY)
                  setDrag({ day, from: m, to: m, moved: false })
                }}
                onPointerMove={(e) => {
                  if (drag?.day !== day) return
                  const moved =
                    drag.moved || Math.abs(e.clientY - pressY.current) >= DRAG_THRESHOLD
                  setDrag({ ...drag, to: minutesAt(e.clientY), moved })
                }}
              >
                {hours.map((m) => (
                  <span
                    key={m}
                    className="absolute inset-x-0 border-t border-border/40"
                    style={{ top: (m - start) * PX_PER_MIN + 9 }}
                    aria-hidden
                  />
                ))}

                {/* Blocked time sits UNDER the classes: it is a constraint, not
                    something you attend. */}
                {blocks
                  .filter((b) => b.day === day)
                  .map((b) => (
                    <div
                      key={b.id}
                      className="absolute inset-x-0 bg-[repeating-linear-gradient(45deg,var(--ct-border)_0px,var(--ct-border)_4px,transparent_4px,transparent_9px)] opacity-70"
                      style={{
                        top: (toMinutes(b.start) - start) * PX_PER_MIN + 9,
                        height: Math.max((toMinutes(b.end) - toMinutes(b.start)) * PX_PER_MIN, 14),
                      }}
                      title={onRemoveBlock ? `${b.label} — right-click to remove` : b.label}
                      onContextMenu={
                        onRemoveBlock
                          ? (e) => {
                              e.preventDefault()
                              onRemoveBlock(b.id)
                            }
                          : undefined
                      }
                    >
                      <span className="block truncate px-1 pt-0.5 text-[9.5px] text-subtle">
                        {b.label}
                      </span>
                    </div>
                  ))}

                {/* The drag in progress, with its times, so you can see what you
                    are about to create before you let go. */}
                {drag?.day === day && drag.moved && (
                  <div
                    className="pointer-events-none absolute inset-x-0 rounded border border-accent bg-accent-soft"
                    style={{
                      top: (Math.min(drag.from, drag.to) - start) * PX_PER_MIN + 9,
                      height: Math.max(Math.abs(drag.to - drag.from) * PX_PER_MIN, 4),
                    }}
                  >
                    <span className="block px-1 pt-0.5 text-[9.5px] font-medium text-accent">
                      {hhmm(Math.min(drag.from, drag.to))}–{hhmm(Math.max(drag.from, drag.to))}
                    </span>
                  </div>
                )}

                {placed
                  .filter((p) => p.slot.day === day)
                  .map((p, i) => {
                    const top = (toMinutes(p.slot.start) - start) * PX_PER_MIN + 9
                    const height = Math.max(
                      (toMinutes(p.slot.end) - toMinutes(p.slot.start)) * PX_PER_MIN,
                      20,
                    )
                    const hex = colourOf.get(p.code) ?? '#888'
                    const clash = clashing.has(p.section.classNumber + p.slot.day + p.slot.start)
                    return (
                      <div
                        key={`${p.section.classNumber}-${i}`}
                        data-block-target="no"
                        className={cn(
                          'absolute inset-x-0.5 overflow-hidden rounded px-1.5 py-1 text-[10.5px] leading-tight',
                          clash && 'ring-2 ring-danger',
                        )}
                        style={{
                          top,
                          height,
                          backgroundColor: `${hex}33`,
                          borderLeft: `3px solid ${hex}`,
                        }}
                        title={`${p.code} ${p.section.section} ${p.slot.start}–${p.slot.end}`}
                      >
                        <span className="block truncate font-medium text-fg">{p.code}</span>
                        <span className="block truncate text-subtle">
                          {p.slot.start}–{p.slot.end}
                        </span>
                        {height > 44 && p.section.building && (
                          <span className="block truncate text-subtle">
                            {p.section.building}
                            {p.section.room}
                          </span>
                        )}
                      </div>
                    )
                  })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {onBlock && (
        <p className="hidden border-t border-border px-3 py-1.5 text-[11px] text-subtle md:block print:hidden">
          Drag on an empty column to block time you are not available; right-click a block to
          remove it. You can also type one in Filters.
        </p>
      )}
    </div>
  )
}
