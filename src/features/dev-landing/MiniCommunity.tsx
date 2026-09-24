import { useRef, useState } from 'react'
import { BadgeCheck, CalendarPlus, Check, MapPin, Video } from 'lucide-react'
import { CAMPUS_EVENTS } from '@/data/community'
import { formatMonthDay, formatTime } from '@/lib/date'
import { cn } from '@/lib/cn'
import { useDevCopy } from './copy'
import { useInView } from './useInView'

const PICK = ['ev-hackathon', 'ev-techfair', 'ev-gamedev']
const EVENTS = PICK.map((id) => CAMPUS_EVENTS.find((e) => e.id === id)).filter(
  (e): e is (typeof CAMPUS_EVENTS)[number] => !!e,
)

/**
 * Three real seeded club events, host first (who it is from before what it
 * is), each with the one action the Community tab is built around. "Add" is
 * local to this demo: nothing is written anywhere.
 */
export function MiniCommunity() {
  const copy = useDevCopy()
  const ref = useRef<HTMLDivElement>(null)
  const seen = useInView(ref)
  const [added, setAdded] = useState<Set<string>>(new Set())

  return (
    <div ref={ref} className="absolute inset-0 flex flex-col gap-2.5 overflow-hidden p-4 sm:p-5">
      {EVENTS.map((ev, n) => {
        const start = new Date(ev.start)
        const isAdded = added.has(ev.id)
        return (
          <article
            key={ev.id}
            className={cn(
              'flex items-center gap-3 rounded-xl border border-border bg-surface p-3',
              seen ? 'ct-reveal-item' : 'opacity-0',
            )}
            style={{ animationDelay: `${n * 140}ms` }}
          >
            <span
              className="grid size-10 shrink-0 place-items-center rounded-xl text-[12px] font-bold text-white"
              style={{ background: ev.org.color }}
              aria-hidden
            >
              {ev.org.glyph}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 truncate text-[11.5px] text-subtle">
                <span className="truncate">{ev.org.name}</span>
                {ev.org.verified && <BadgeCheck size={12} className="shrink-0 text-info" aria-label="Verified" />}
              </p>
              <p className="truncate text-[13px] font-semibold text-fg">{ev.title}</p>
              <p className="mt-0.5 flex items-center gap-1 truncate text-[11.5px] text-muted">
                {ev.mode === 'online' ? <Video size={11} aria-hidden /> : <MapPin size={11} aria-hidden />}
                {formatMonthDay(start)} · {formatTime(start)}
              </p>
            </div>
            <button
              type="button"
              aria-pressed={isAdded}
              aria-label={isAdded ? copy.commAdded : copy.commAdd}
              onClick={() =>
                setAdded((s) => {
                  const next = new Set(s)
                  if (next.has(ev.id)) next.delete(ev.id)
                  else next.add(ev.id)
                  return next
                })
              }
              className={cn(
                'grid size-9 shrink-0 place-items-center rounded-lg border transition-colors duration-150',
                isAdded ? 'border-accent bg-accent-soft text-accent' : 'border-border text-muted hover:text-fg',
              )}
            >
              {isAdded ? <Check size={15} /> : <CalendarPlus size={15} />}
            </button>
          </article>
        )
      })}
    </div>
  )
}
