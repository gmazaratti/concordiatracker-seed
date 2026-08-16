import { weekdayNames } from '@/lib/date'
import { cn } from '@/lib/cn'
import { gridBounds, toMinutes, type Block, type Conflict, type Placed } from './schedule'

/**
 * The week, always drawn.
 *
 * Rendered even when nothing is on it, because an empty grid reads as "this is
 * where your timetable will appear" while an empty page reads as broken. It is
 * also the surface a blocked time is drawn on, so it has to exist before any
 * course does.
 *
 * `print:` classes make this the only thing on the page when printed — the
 * point of exporting is a sheet for a fridge, not a screenshot of an app.
 */
const PX_PER_MIN = 0.9

export function WeekGrid({
  placed,
  blocks,
  colourOf,
  conflicts,
}: {
  placed: Placed[]
  blocks: Block[]
  colourOf: Map<string, string>
  conflicts: Conflict[]
}) {
  // Blocked times widen the grid so a 7am block is visible even with no 7am
  // class; without this a block could sit entirely outside the drawn hours.
  const blockBounds = blocks.flatMap((b) => [
    { slot: { day: b.day, start: b.start, end: b.end, startMinutes: 0 } },
  ]) as unknown as Placed[]
  const { start, end } = gridBounds([...placed, ...blockBounds])
  const span = Math.max(end - start, 240)
  const hours = Array.from({ length: Math.ceil(span / 60) + 1 }, (_, i) => start + i * 60)
  const days = [1, 2, 3, 4, 5]
  const names = weekdayNames()
  const clashing = new Set(
    conflicts.flatMap((c) => [c.a, c.b]).map((p) => p.section.classNumber + p.slot.day + p.slot.start),
  )

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface print:border-0">
      <div className="min-w-[560px]">
        <div className="grid grid-cols-[46px_repeat(5,1fr)] border-b border-border">
          <span />
          {days.map((d) => (
            <span key={d} className="px-2 py-2 text-center text-[11.5px] font-medium text-subtle">
              {names[d].slice(0, 3)}
            </span>
          ))}
        </div>

        <div
          className="relative grid grid-cols-[46px_repeat(5,1fr)]"
          style={{ height: span * PX_PER_MIN }}
        >
          <div className="relative">
            {hours.map((m) => (
              <span
                key={m}
                className="absolute right-1.5 -translate-y-1/2 text-[10.5px] text-subtle tabular-nums"
                style={{ top: (m - start) * PX_PER_MIN }}
              >
                {String(Math.floor(m / 60)).padStart(2, '0')}:00
              </span>
            ))}
          </div>

          {days.map((day) => (
            <div key={day} className="relative border-l border-border/60">
              {hours.map((m) => (
                <span
                  key={m}
                  className="absolute inset-x-0 border-t border-border/40"
                  style={{ top: (m - start) * PX_PER_MIN }}
                  aria-hidden
                />
              ))}

              {/* Blocked time sits UNDER the classes: it is a constraint, not a
                  thing you attend, and a class placed over one should still be
                  readable while obviously sitting somewhere it should not. */}
              {blocks
                .filter((b) => b.day === day)
                .map((b) => (
                  <div
                    key={b.id}
                    className="absolute inset-x-0 bg-[repeating-linear-gradient(45deg,var(--ct-border)_0px,var(--ct-border)_4px,transparent_4px,transparent_9px)] opacity-70"
                    style={{
                      top: (toMinutes(b.start) - start) * PX_PER_MIN,
                      height: Math.max((toMinutes(b.end) - toMinutes(b.start)) * PX_PER_MIN, 14),
                    }}
                    title={b.label}
                  >
                    <span className="block truncate px-1 pt-0.5 text-[9.5px] text-subtle">
                      {b.label}
                    </span>
                  </div>
                ))}

              {placed
                .filter((p) => p.slot.day === day)
                .map((p, i) => {
                  const top = (toMinutes(p.slot.start) - start) * PX_PER_MIN
                  const height = Math.max(
                    (toMinutes(p.slot.end) - toMinutes(p.slot.start)) * PX_PER_MIN,
                    20,
                  )
                  const hex = colourOf.get(p.code) ?? '#888'
                  const clash = clashing.has(p.section.classNumber + p.slot.day + p.slot.start)
                  return (
                    <div
                      key={`${p.section.classNumber}-${i}`}
                      className={cn(
                        'absolute inset-x-0.5 overflow-hidden rounded px-1.5 py-1 text-[10.5px] leading-tight',
                        // An overlap is outlined, not recoloured: the course
                        // keeps its identity colour and is still obviously in
                        // trouble.
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
  )
}
