import { useRef, useState } from 'react'
import { ACADEMIC_CALENDAR } from '@/data/academic-calendar'
import { courseColor } from '@/lib/course-color'
import { monthNames, weekdayNames } from '@/lib/date'
import { cn } from '@/lib/cn'
import { useDevCopy } from './copy'
import { useInView } from './useInView'

/** A fixed month so the registrar's real dates (reading week, Thanksgiving) show. */
const YEAR = 2026
const MONTH = 9 // October, zero-based

type Layer = 'mine' | 'concordia' | 'moodle'
type Mark = { day: number; layer: Layer; color: string; label: string }

/** Course deadlines for the month, in each class's identity colour. */
const MINE: Mark[] = [
  { day: 2, layer: 'mine', color: courseColor('blue').hex, label: 'COMP 248 · Assignment 2' },
  { day: 7, layer: 'mine', color: courseColor('teal').hex, label: 'COMM 217 · Quiz 2' },
  { day: 20, layer: 'mine', color: courseColor('purple').hex, label: 'MATH 205 · Midterm' },
  { day: 23, layer: 'mine', color: courseColor('rose').hex, label: 'ENGL 233 · Essay 1' },
  { day: 29, layer: 'mine', color: courseColor('amber').hex, label: 'POLI 202 · Response paper' },
]
/** What a connected Moodle adds: the items nobody puts in a syllabus. */
const MOODLE: Mark[] = [
  { day: 5, layer: 'moodle', color: 'var(--ct-warning)', label: 'Join a group' },
  { day: 14, layer: 'moodle', color: 'var(--ct-warning)', label: 'Weekly quiz 6' },
  { day: 27, layer: 'moodle', color: 'var(--ct-warning)', label: 'Peer review opens' },
]

function academicMarks(): Mark[] {
  const out: Mark[] = []
  for (const ev of ACADEMIC_CALENDAR) {
    const start = new Date(`${ev.start}T12:00:00`)
    const end = new Date(`${ev.end ?? ev.start}T12:00:00`)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getFullYear() === YEAR && d.getMonth() === MONTH) {
        out.push({ day: d.getDate(), layer: 'concordia', color: 'var(--ct-info)', label: ev.title })
      }
    }
  }
  return out
}

/** Constant for the fixed month, so computed once at load. */
const CONCORDIA = academicMarks()

/**
 * A month of the real calendar model: three layers that switch on and off, the
 * Concordia one read from the same `ACADEMIC_CALENDAR` the app uses. The Moodle
 * layer arrives a beat after the rest, the way a sync does.
 */
export function MiniCalendar() {
  const copy = useDevCopy()
  const ref = useRef<HTMLDivElement>(null)
  const seen = useInView(ref)
  const [on, setOn] = useState<Record<Layer, boolean>>({ mine: true, concordia: true, moodle: true })

  const lead = new Date(YEAR, MONTH, 1).getDay()
  const days = new Date(YEAR, MONTH + 1, 0).getDate()
  const cells = Array.from({ length: 42 }, (_, i) => i - lead + 1)
  const marks = [...MINE, ...CONCORDIA, ...(seen ? MOODLE : [])].filter((m) => on[m.layer])

  const layers: { id: Layer; label: string; swatch: string }[] = [
    { id: 'mine', label: copy.calLayerMine, swatch: 'var(--ct-accent)' },
    { id: 'concordia', label: copy.calLayerConcordia, swatch: 'var(--ct-info)' },
    { id: 'moodle', label: copy.calLayerMoodle, swatch: 'var(--ct-warning)' },
  ]

  return (
    <div ref={ref} className="absolute inset-0 flex flex-col gap-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-fg">
          {monthNames()[MONTH]} {YEAR}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {layers.map((l) => (
            <button
              key={l.id}
              type="button"
              aria-pressed={on[l.id]}
              onClick={() => setOn((s) => ({ ...s, [l.id]: !s[l.id] }))}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors duration-150',
                on[l.id] ? 'border-border-strong text-fg' : 'border-border text-subtle line-through',
              )}
            >
              <span className="size-2 rounded-full" style={{ background: l.swatch }} aria-hidden />
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-7 text-center text-[10.5px] text-subtle">
        {weekdayNames('narrow').map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6 gap-px overflow-hidden rounded-lg border border-border bg-border">
        {cells.map((day, i) => {
          const inMonth = day >= 1 && day <= days
          const here = inMonth ? marks.filter((m) => m.day === day) : []
          return (
            <div key={i} className={cn('flex min-w-0 flex-col gap-0.5 p-1', inMonth ? 'bg-surface' : 'bg-canvas')}>
              {inMonth && <span className="text-[10px] leading-none text-subtle tabular-nums">{day}</span>}
              {here.slice(0, 2).map((m) => (
                <span
                  key={m.label + m.day}
                  title={m.label}
                  className={cn(
                    'h-1.5 w-full rounded-full sm:h-auto sm:truncate sm:rounded sm:px-1 sm:py-px sm:text-[9px] sm:leading-tight',
                    m.layer === 'moodle' && 'ct-reveal-item',
                  )}
                  style={{ background: `color-mix(in srgb, ${m.color} 26%, transparent)`, color: 'var(--ct-fg)' }}
                >
                  <span className="hidden sm:inline">{m.label}</span>
                </span>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
