import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CalendarRange, Loader2 } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { COURSE_COLORS } from '@/lib/course-color'
import { scheduleByToken, type SharedSchedule } from '@/lib/schedules'
import { placeSections } from './schedule'
import { WeekGrid } from './WeekGrid'

/**
 * Someone else's schedule, opened from a link.
 *
 * Public and signed-out by design: the point is sending it to a friend, and
 * making them create an account to look at a timetable would kill the share.
 * It shows the week and nothing about whose it is - the RPC behind it does not
 * return an owner, so there is nothing here to leak.
 */
export function SharedSchedulePage() {
  const { token = '' } = useParams()
  const [schedule, setSchedule] = useState<SharedSchedule | null | 'missing'>(null)

  useEffect(() => {
    let alive = true
    void scheduleByToken(token).then((s) => {
      if (alive) setSchedule(s ?? 'missing')
    })
    return () => {
      alive = false
    }
  }, [token])

  return (
    <div className="min-h-svh bg-canvas">
      <header className="flex items-center justify-between border-b border-border px-5 py-3 print:hidden">
        <Link to="/">
          <Logo />
        </Link>
        <Link
          to="/app/planner"
          className="rounded-lg bg-accent px-3 py-1.5 text-[13px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
        >
          Build your own
        </Link>
      </header>

      <main className="mx-auto w-full max-w-5xl px-5 py-6">
        {schedule === null ? (
          <div className="grid place-items-center py-20">
            <Loader2 className="size-5 animate-spin text-accent" aria-hidden />
          </div>
        ) : schedule === 'missing' ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
            <CalendarRange size={22} className="mx-auto text-subtle" aria-hidden />
            <h1 className="mt-2 font-display text-[19px] font-medium text-fg">
              This schedule is not available
            </h1>
            <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-subtle">
              The link may have been turned off by whoever made it, or it was never valid.
            </p>
          </div>
        ) : (
          <Shared schedule={schedule} />
        )}
      </main>
    </div>
  )
}

function Shared({ schedule }: { schedule: SharedSchedule }) {
  const placed = placeSections(schedule.sections ?? [])
  const colourOf = new Map<string, string>()
  let i = 0
  for (const p of schedule.sections ?? []) {
    if (!colourOf.has(p.code)) colourOf.set(p.code, COURSE_COLORS[i++ % COURSE_COLORS.length].hex)
  }

  return (
    <>
      <h1 className="font-display text-[24px] leading-tight font-medium text-fg">{schedule.name}</h1>
      <p className="mt-0.5 mb-4 text-[13px] text-subtle print:hidden">
        Shared schedule · {(schedule.sections ?? []).length} sections
      </p>

      <WeekGrid placed={placed} blocks={schedule.blocks ?? []} colourOf={colourOf} conflicts={[]} />

      <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
        {(schedule.sections ?? []).map((p) => (
          <li
            key={p.section.classNumber}
            className="flex items-start gap-2 rounded-lg border border-border bg-surface px-2.5 py-2"
          >
            <span
              className="mt-1 size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: colourOf.get(p.code) }}
              aria-hidden
            />
            <span className="min-w-0">
              <span className="block text-[12.5px] font-medium text-fg">
                {p.code} {p.section.section}
                {p.section.component ? ` · ${p.section.component}` : ''}
              </span>
              <span className="block text-[11.5px] text-subtle">
                {p.section.meetingTimes ?? 'Time TBA'}
                {p.section.location ? ` · ${p.section.location}` : ''}
              </span>
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-[11.5px] text-subtle print:hidden">
        A plan someone shared, not a registration. Seat availability is not shown here because it
        changes; check the Student Centre before relying on it.
      </p>
    </>
  )
}
