import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import { weekdayNames } from '@/lib/date'
import type { SectionOption } from '@/lib/seats'
import { cn } from '@/lib/cn'

/**
 * Add a section Concordia's feed has not published.
 *
 * WHY THIS EXISTS. The Open Data schedule feed only carries terms that have
 * been published, and it lags real registration: a student can be registered
 * in COMM 305-EC and find the builder insisting the course has no sections at
 * all this term. Up to now that was a dead end — the one screen for planning
 * your term refused to let you put your own timetable in it.
 *
 * So the feed is the FAST path, not the only path. What you type here is
 * marked as yours throughout: no class number, no seat counts, no seat watch.
 * The one thing this must never do is manufacture data that looks official —
 * an invented class number is exactly the confidently-wrong answer this app
 * spends its time avoiding.
 */
const TIMES = Array.from({ length: 34 }, (_, i) => {
  const m = 7 * 60 + i * 30
  const v = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  return { value: v, label: v }
})

const COMPONENTS = [
  { value: 'LEC', label: 'Lecture' },
  { value: 'TUT', label: 'Tutorial' },
  { value: 'LAB', label: 'Lab' },
]

/** Days are 1..5 (Mon..Fri) to match `weekdayNames()` and the week grid. */
const DAYS = [1, 2, 3, 4, 5]

export function ManualSection({
  code,
  title,
  termCode,
  onAdd,
}: {
  code: string
  /** The catalogue title, when the mirror knows it. */
  title?: string
  termCode: string
  onAdd: (section: SectionOption) => void
}) {
  const names = weekdayNames()
  const [open, setOpen] = useState(false)
  const [section, setSection] = useState('')
  const [component, setComponent] = useState('LEC')
  const [timed, setTimed] = useState(true)
  const [days, setDays] = useState<number[]>([])
  const [start, setStart] = useState('10:15')
  const [end, setEnd] = useState('11:30')
  const [room, setRoom] = useState('')

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-muted transition-colors duration-150 hover:border-accent hover:text-fg"
      >
        <Plus size={13} aria-hidden />
        Add my section by hand
      </button>
    )
  }

  const ready = section.trim().length > 0 && (!timed || days.length > 0)

  function submit() {
    if (!ready) return
    const meetingTimes = timed
      ? // Exactly the shape `meetingTimeString` produces from the real feed, so
        // the week grid and the Next class widget parse it with no special case.
        `${days
          .slice()
          .sort((a, b) => a - b)
          .map((d) => names[d].slice(0, 3))
          .join(' · ')} ${start}–${end}`
      : null
    onAdd({
      // `manual-` marks it everywhere downstream: the details card hides the
      // class-number row for it, the way it already does for `current-`.
      //
      // DETERMINISTIC, not a timestamp: the builder de-duplicates on this key,
      // so adding the same section twice should be a no-op rather than two
      // identical blocks stacked on the same hour. (A clock read here also
      // trips react-hooks/purity.)
      classNumber: `manual-${code.replace(/\s+/g, '')}-${component}-${section.trim().toUpperCase()}`,
      termCode,
      section: section.trim().toUpperCase(),
      courseTitle: title ?? '',
      component,
      componentLabel: COMPONENTS.find((c) => c.value === component)?.label ?? component,
      meetingTimes,
      // Null, not zero. We do not know the seat counts and a "0 open" badge on
      // a class you are already registered in would be a lie.
      enrolled: null,
      capacity: null,
      waitlisted: null,
      waitlistCap: null,
      hasReserved: false,
      location: '',
      instructionMode: timed ? 'Added by you' : 'Online, no set time',
      building: '',
      room: room.trim(),
    })
    setOpen(false)
    setSection('')
    setDays([])
    setRoom('')
  }

  return (
    <div className="mt-2 rounded-lg border border-border bg-canvas p-2.5">
      <p className="text-[11.5px] leading-relaxed text-subtle">
        Type what your Student Centre says. It goes on your week like any other class, marked as
        yours. There are no seat counts and no seat watch, because we are not reading it from Concordia.
      </p>

      <div className="mt-2.5 grid gap-2 sm:grid-cols-[1fr_1fr]">
        <label className="block">
          <span className="mb-1 block text-[11px] text-subtle">Section</span>
          <input
            value={section}
            onChange={(e) => setSection(e.target.value)}
            placeholder="EC"
            maxLength={8}
            className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[12.5px] text-fg uppercase placeholder:text-subtle focus:border-accent focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-subtle">Component</span>
          <Select
            value={component}
            onChange={setComponent}
            ariaLabel="Component"
            size="sm"
            tone="control"
            options={COMPONENTS}
          />
        </label>
      </div>

      <div className="mt-2.5 flex gap-1 rounded-lg bg-surface-2 p-0.5">
        {[
          { v: true, label: 'Set meeting time' },
          { v: false, label: 'Online / no set time' },
        ].map((o) => (
          <button
            key={String(o.v)}
            type="button"
            aria-pressed={timed === o.v}
            onClick={() => setTimed(o.v)}
            className={cn(
              'flex-1 rounded-md px-2 py-1 text-[11.5px] font-medium transition-colors duration-150',
              timed === o.v ? 'bg-surface text-fg' : 'text-subtle hover:text-fg',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>

      {timed && (
        <>
          <div className="mt-2.5 flex flex-wrap gap-1">
            {DAYS.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={days.includes(d)}
                onClick={() =>
                  setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))
                }
                className={cn(
                  'rounded-lg border px-2.5 py-1 text-[11.5px] font-medium transition-colors duration-150',
                  days.includes(d)
                    ? 'border-accent bg-accent-soft text-fg'
                    : 'border-border text-subtle hover:text-fg',
                )}
              >
                {names[d].slice(0, 3)}
              </button>
            ))}
          </div>

          <div className="mt-2 flex items-center gap-2">
            <Select
              value={start}
              onChange={setStart}
              ariaLabel="From"
              size="sm"
              tone="control"
              options={TIMES}
            />
            <span className="text-[12px] text-subtle">to</span>
            <Select
              value={end}
              onChange={setEnd}
              ariaLabel="To"
              size="sm"
              tone="control"
              options={TIMES}
            />
          </div>

          <label className="mt-2 block">
            <span className="mb-1 block text-[11px] text-subtle">Room (optional)</span>
            <input
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="MB 3.210"
              maxLength={24}
              className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[12.5px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
            />
          </label>
        </>
      )}

      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-border px-2.5 py-1.5 text-[12px] text-muted transition-colors duration-150 hover:text-fg"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!ready}
          className="rounded-lg bg-accent px-3 py-1.5 text-[12px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover disabled:opacity-50"
        >
          Add to my week
        </button>
      </div>
    </div>
  )
}
