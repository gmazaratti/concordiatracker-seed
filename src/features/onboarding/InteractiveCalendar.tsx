import { useState } from 'react'
import { cn } from '@/lib/cn'
import { Slide } from './OnboardingSlides'

type View = 'Month' | 'Week' | 'Agenda'

// day -> which layers have something that day ('my' = your deadlines, 'uni' = Concordia)
const MY: Record<number, true> = { 3: true, 9: true, 12: true, 18: true, 20: true }
const UNI: Record<number, true> = { 6: true, 9: true, 15: true, 20: true }

const AGENDA = [
  { day: 'Mon Jun 9', title: 'Assignment 1 due', layer: 'my' as const },
  { day: 'Mon Jun 9', title: 'Add/drop deadline', layer: 'uni' as const },
  { day: 'Thu Jun 12', title: 'Quiz 3', layer: 'my' as const },
  { day: 'Mon Jun 15', title: 'Reading week starts', layer: 'uni' as const },
]

/** Interactive Calendar step — toggling a layer or switching the view advances. */
export function CalendarStep({ onDone }: { onDone: () => void }) {
  const [my, setMy] = useState(true)
  const [uni, setUni] = useState(true)
  const [view, setView] = useState<View>('Month')
  const [touched, setTouched] = useState(false)
  const touch = () => {
    if (!touched) {
      setTouched(true)
      onDone()
    }
  }

  return (
    <Slide
      visual={
        <MiniCalendar
          my={my}
          uni={uni}
          view={view}
          onToggleMy={() => {
            setMy((v) => !v)
            touch()
          }}
          onToggleUni={() => {
            setUni((v) => !v)
            touch()
          }}
          onView={(v) => {
            setView(v)
            touch()
          }}
        />
      }
      headline="Your whole term, one calendar"
      sub={
        touched
          ? 'Layers and views are yours to mix — show everything, or just what’s due.'
          : 'Try it: toggle a layer on or off, or switch the view.'
      }
    />
  )
}

function MiniCalendar({
  my,
  uni,
  view,
  onToggleMy,
  onToggleUni,
  onView,
}: {
  my: boolean
  uni: boolean
  view: View
  onToggleMy: () => void
  onToggleUni: () => void
  onView: (v: View) => void
}) {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-4 text-left">
      <div className="flex items-center justify-between">
        <span className="font-display text-[14px] font-semibold text-fg">June 2026</span>
        <div className="flex gap-0.5 rounded-lg border border-border bg-canvas p-0.5">
          {(['Month', 'Week', 'Agenda'] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onView(v)}
              className={cn(
                'rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors',
                v === view ? 'bg-surface-2 text-fg' : 'text-subtle hover:text-fg',
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === 'Agenda' ? (
        <ul className="mt-3 min-h-[148px] divide-y divide-border">
          {AGENDA.filter((e) => (e.layer === 'my' ? my : uni)).map((e, i) => (
            <li key={i} className="flex items-center gap-2.5 py-2">
              <span className={cn('size-2 rounded-full', e.layer === 'my' ? 'bg-accent' : 'bg-info')} aria-hidden />
              <span className="flex-1 text-[12px] text-fg">{e.title}</span>
              <span className="text-[11px] text-subtle">{e.day}</span>
            </li>
          ))}
          {!my && !uni && <li className="py-6 text-center text-[12px] text-subtle">Both layers are off.</li>}
        </ul>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[9px] text-subtle">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {Array.from({ length: 21 }).map((_, i) => {
              const day = i + 1
              const today = day === 20
              return (
                <div
                  key={i}
                  className={cn('flex h-9 flex-col rounded-md border p-1', today ? 'border-accent' : 'border-border/60')}
                >
                  <span className={cn('text-[9px] leading-none', today ? 'font-bold text-accent' : 'text-muted')}>{day}</span>
                  <span className="mt-auto flex gap-0.5">
                    {my && MY[day] && <span className="size-1.5 rounded-full bg-accent" aria-hidden />}
                    {uni && UNI[day] && <span className="size-1.5 rounded-full bg-info" aria-hidden />}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}

      <div className="mt-3 flex items-center gap-2">
        <LayerToggle label="My deadlines" dot="bg-accent" on={my} onClick={onToggleMy} />
        <LayerToggle label="Concordia" dot="bg-info" on={uni} onClick={onToggleUni} />
      </div>
    </div>
  )
}

function LayerToggle({ label, dot, on, onClick }: { label: string; dot: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
        on ? 'border-border-strong bg-surface-2 text-fg' : 'border-border text-subtle hover:text-fg',
      )}
    >
      <span className={cn('size-2 rounded-full', on ? dot : 'bg-border-strong')} aria-hidden />
      {label}
    </button>
  )
}
