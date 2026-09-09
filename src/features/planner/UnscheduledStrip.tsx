import { Monitor } from 'lucide-react'
import type { PickedSection } from '@/lib/schedules'
import { parseMeetingTimes } from '@/features/today/widgets/meeting-times'

/**
 * The classes that are on your schedule and nowhere on the grid.
 *
 * An asynchronous online section has no slot to draw, so a week grid silently
 * loses it — and a student counting four rectangles concludes they are taking
 * four classes. Concordia's own builder puts these in a strip under the week
 * for exactly this reason, and says it in a sentence rather than a symbol.
 *
 * Sections whose times we simply could not READ land here too, worded
 * differently: "we do not know when this meets" and "this does not meet" are
 * different facts, and merging them would tell someone their Tuesday lecture
 * is asynchronous.
 */
export function UnscheduledStrip({
  picked,
  colourOf,
}: {
  picked: PickedSection[]
  colourOf: Map<string, string>
}) {
  const loose = picked.filter((p) => parseMeetingTimes(p.section.meetingTimes ?? '').length === 0)
  if (loose.length === 0) return null

  return (
    <div className="mt-3 rounded-xl border border-border bg-surface px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">
        <Monitor size={12} aria-hidden />
        Not on the grid
      </p>
      <ul className="mt-1.5 space-y-1">
        {loose.map((p) => {
          const online = isOnline(p.section.instructionMode, p.section.location)
          return (
            <li
              key={p.section.classNumber}
              className="flex items-baseline gap-2 text-[12px] text-muted"
            >
              <span
                className="size-2 shrink-0 translate-y-px rounded-full"
                style={{ backgroundColor: colourOf.get(p.code) }}
                aria-hidden
              />
              <span className="min-w-0">
                <span className="font-medium text-fg">{p.code}</span>{' '}
                {online
                  ? 'is an online class with no scheduled meeting times.'
                  : p.section.meetingTimes
                    ? `meets at “${p.section.meetingTimes}”, which we could not read as a weekly time.`
                    : 'has no meeting time published. If it is online with no set time, say so under Delivery in Class details.'}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function isOnline(mode: string, location: string): boolean {
  const m = `${mode} ${location}`.toLowerCase()
  return (
    m.includes('online') ||
    m.includes('en ligne') ||
    m.includes('remote') ||
    // What the student set in Class details, carried onto the seeded section.
    m.includes('online-async')
  )
}
