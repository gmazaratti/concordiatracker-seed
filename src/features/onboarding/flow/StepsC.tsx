import { CalendarCheck, Check, GraduationCap, PartyPopper, Target, Users } from 'lucide-react'
import { cn } from '@/lib/cn'
import { GOALS } from './ob-data'
import { Stage, StageLabel, StepCopy } from './ObParts'
import { beam } from './ob-beam'

const GOAL_ICON = { deadlines: CalendarCheck, gpa: Target, plan: GraduationCap, people: PartyPopper, parents: Users } as const

/* ── 6. What matters to you ───────────────────────────────────────────────── */

export function StepGoals({ goals, toggle }: { goals: Set<string>; toggle: (id: string) => void }) {
  const chosen = GOALS.filter((g) => goals.has(g.id))
  return (
    <>
      <StepCopy
        label="Make it yours"
        title="What do you want out of this?"
        sub="We use this to decide what to show you first, so you are not left to find things on your own."
        note="Pick at least one to continue."
      />
      <Stage>
        <StageLabel right={goals.size ? `${goals.size} picked` : undefined}>Select all that apply</StageLabel>
        <div className="grid gap-1.5 sm:grid-cols-2 sm:gap-2">
          {GOALS.map((g, i) => {
            const on = goals.has(g.id)
            const Icon = GOAL_ICON[g.id]
            return (
              <button
                key={g.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(g.id)}
                className={cn(
                  'ct-ob-rise flex items-center gap-3 rounded-2xl border px-3 py-2 text-left transition-all duration-200 sm:px-3.5 sm:py-3',
                  beam(goals.size === 0 && i === 0),
                  on ? 'border-accent bg-accent-soft' : 'border-border bg-canvas hover:border-border-strong',
                  i === GOALS.length - 1 && 'sm:col-span-2',
                )}
                style={{ '--d': `${160 + i * 60}ms` } as React.CSSProperties}
              >
                <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl transition-colors duration-200', on ? 'bg-accent text-accent-contrast' : 'bg-surface-2 text-muted')}>
                  {on ? <Check size={17} strokeWidth={3} className="ct-ob-check" aria-hidden /> : <Icon size={17} aria-hidden />}
                </span>
                <span className="text-[14px] font-semibold text-fg">{g.label}</span>
              </button>
            )
          })}
        </div>
        <div className="mt-3 min-h-[84px] rounded-2xl border border-dashed border-border-strong p-3 sm:mt-4 sm:p-3.5">
          <StageLabel>We will start you with</StageLabel>
          {chosen.length === 0 ? (
            <p className="text-[13px] text-subtle">Pick something above and your first steps show up here.</p>
          ) : (
            <ol className="space-y-1.5">
              {chosen.slice(0, 3).map((g, i) => (
                <li key={g.id} className="ct-ob-rise flex items-center gap-2 text-[13.5px] text-fg">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] font-bold text-accent">{i + 1}</span>
                  {g.first}
                </li>
              ))}
            </ol>
          )}
        </div>
      </Stage>
    </>
  )
}

/** A fixed fan of pieces: same burst every time, no randomness at render. */
const COLORS = ['var(--ct-accent)', '#e0a23c', '#5b8def', '#c96aa8', '#4fb39a', '#ffffff']
const CONFETTI = Array.from({ length: 22 }, (_, i) => {
  const angle = (i / 22) * Math.PI * 2
  const reach = 90 + ((i * 37) % 70)
  return { color: COLORS[i % COLORS.length], x: Math.round(Math.cos(angle) * reach), y: Math.round(Math.sin(angle) * reach - 40), r: (i * 67) % 360, d: (i % 5) * 35 }
})

/* ── 7. Done ──────────────────────────────────────────────────────────────── */

export function StepDone({ name, did }: { name: string; did: { label: string; done: boolean }[] }) {
  const first = name.trim().split(/\s+/)[0]
  const count = did.filter((d) => d.done).length
  return (
    <>
      <div>
        <span className="pointer-events-none relative block h-0" aria-hidden>
          {CONFETTI.map((c, i) => (
            <span key={i} className="ct-ob-confetti absolute top-8 left-8 block h-2.5 w-1.5 rounded-[2px]" style={{ backgroundColor: c.color, '--x': `${c.x}px`, '--y': `${c.y}px`, '--r': `${c.r}deg`, '--d': `${c.d}ms` } as React.CSSProperties} />
          ))}
        </span>
        <span className="ct-ob-pop relative mb-5 grid size-16 place-items-center rounded-full bg-accent text-accent-contrast">
          <Check size={32} strokeWidth={3} className="ct-ob-check" aria-hidden />
          <span className="ct-ob-ring pointer-events-none absolute inset-0 rounded-full border-2 border-accent" aria-hidden />
        </span>
        <StepCopy
          label="You did it"
          title={<>You are ready{first ? `, ${first}` : ''}.</>}
          sub={
            count >= 4
              ? 'You just used the things that matter most. The rest shows up when it is useful, one thing at a time.'
              : 'That is the tour. Anything you skipped will come up again when it is useful, one thing at a time.'
          }
        />
      </div>
      <Stage>
        <StageLabel right={`${count} of ${did.length}`}>What you tried</StageLabel>
        <ul className="space-y-2">
          {did.map((d, i) => (
            <li
              key={d.label}
              className="ct-ob-rise flex items-center gap-3 rounded-2xl border border-border bg-canvas px-3.5 py-3"
              style={{ '--d': `${200 + i * 110}ms` } as React.CSSProperties}
            >
              <span className={cn('grid size-6 shrink-0 place-items-center rounded-full', d.done ? 'bg-accent text-accent-contrast' : 'border-2 border-border-strong')}>
                {d.done && <Check size={13} strokeWidth={3.5} aria-hidden />}
              </span>
              <span className={cn('text-[14.5px] font-medium', d.done ? 'text-fg' : 'text-subtle')}>{d.label}</span>
              {!d.done && <span className="ml-auto text-[12px] text-subtle">We will remind you</span>}
            </li>
          ))}
        </ul>
      </Stage>
    </>
  )
}
