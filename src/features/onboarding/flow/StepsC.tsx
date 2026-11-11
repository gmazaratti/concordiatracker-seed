import { Bell, CalendarCheck, Check, GraduationCap, NotebookPen, PartyPopper, Target, Ticket, Users, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { GOALS, type GoalId } from './ob-data'
import { Stage, StageLabel, StepCopy } from './ObParts'
import { beam } from './ob-beam'
import { useOb, type ObKey } from './ob-i18n'

const GOAL_ICON: Record<GoalId, LucideIcon> = {
  deadlines: CalendarCheck,
  gpa: Target,
  plan: GraduationCap,
  seats: Bell,
  notes: NotebookPen,
  events: Ticket,
  people: PartyPopper,
  parents: Users,
}

/* ── What matters to you (required, multi-select) ─────────────────────────── */

export function StepGoals({ goals, toggle }: { goals: Set<string>; toggle: (id: string) => void }) {
  const t = useOb()
  const chosen = GOALS.filter((g) => goals.has(g))
  return (
    <>
      <StepCopy label={t('goals.label')} title={t('goals.title')} sub={t('goals.sub')} note={t('goals.note')} />
      <Stage>
        <StageLabel right={goals.size ? t('goals.picked', { n: goals.size }) : undefined}>{t('goals.all')}</StageLabel>
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
          {GOALS.map((g, i) => {
            const on = goals.has(g)
            const Icon = GOAL_ICON[g]
            return (
              <button
                key={g}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(g)}
                className={cn(
                  'ct-ob-rise flex items-center gap-2 rounded-2xl border px-2.5 py-2 text-left transition-all duration-200 sm:gap-3 sm:px-3.5 sm:py-2.5',
                  beam(goals.size === 0 && i === 0),
                  on ? 'border-accent bg-accent-soft' : 'border-border bg-canvas hover:border-border-strong',
                )}
                style={{ '--d': `${140 + i * 50}ms` } as React.CSSProperties}
              >
                <span className={cn('grid size-7 shrink-0 place-items-center rounded-lg transition-colors duration-200 sm:size-9 sm:rounded-xl', on ? 'bg-accent text-accent-contrast' : 'bg-surface-2 text-muted')}>
                  {on ? <Check size={16} strokeWidth={3} className="ct-ob-check" aria-hidden /> : <Icon size={16} aria-hidden />}
                </span>
                <span className="min-w-0 text-[12.5px] leading-snug font-semibold text-fg sm:text-[13.5px]">{t(`goal.${g}` as ObKey)}</span>
              </button>
            )
          })}
        </div>
        <div className="mt-3 min-h-[80px] rounded-2xl border border-dashed border-border-strong p-3 sm:mt-4 sm:p-3.5">
          <StageLabel>{t('goals.start')}</StageLabel>
          {chosen.length === 0 ? (
            <p className="text-[13px] text-subtle">{t('goals.startEmpty')}</p>
          ) : (
            <ol className="space-y-1.5">
              {chosen.slice(0, 3).map((g, i) => (
                <li key={g} className="ct-ob-rise flex items-center gap-2 text-[13.5px] text-fg">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] font-bold text-accent">{i + 1}</span>
                  {t(`first.${g}` as ObKey)}
                </li>
              ))}
            </ol>
          )}
        </div>
      </Stage>
    </>
  )
}

/* ── Done ─────────────────────────────────────────────────────────────────── */

/** A fixed fan of pieces: same burst every time, no randomness at render. */
const COLORS = ['var(--ct-accent)', '#e0a23c', '#5b8def', '#c96aa8', '#4fb39a', '#ffffff']
const CONFETTI = Array.from({ length: 22 }, (_, i) => {
  const angle = (i / 22) * Math.PI * 2
  const reach = 90 + ((i * 37) % 70)
  return { color: COLORS[i % COLORS.length], x: Math.round(Math.cos(angle) * reach), y: Math.round(Math.sin(angle) * reach - 40), r: (i * 67) % 360, d: (i % 5) * 35 }
})

export function StepDone({ name, did }: { name: string; did: { label: string; done: boolean }[] }) {
  const t = useOb()
  const first = name.trim().split(/\s+/)[0]
  const count = did.filter((d) => d.done).length
  return (
    <>
      <div>
        <span className="pointer-events-none relative block h-0" aria-hidden>
          {CONFETTI.map((c, i) => (
            <span
              key={i}
              className="ct-ob-confetti absolute top-8 left-8 block h-2.5 w-1.5 rounded-[2px]"
              style={{ backgroundColor: c.color, '--x': `${c.x}px`, '--y': `${c.y}px`, '--r': `${c.r}deg`, '--d': `${c.d}ms` } as React.CSSProperties}
            />
          ))}
        </span>
        <span className="ct-ob-pop relative mb-5 grid size-16 place-items-center rounded-full bg-accent text-accent-contrast">
          <Check size={32} strokeWidth={3} className="ct-ob-check" aria-hidden />
          <span className="ct-ob-ring pointer-events-none absolute inset-0 rounded-full border-2 border-accent" aria-hidden />
        </span>
        <StepCopy label={t('done.label')} title={`${t('done.title')}${first ? `, ${first}` : ''}.`} sub={count >= 4 ? t('done.subAll') : t('done.subSome')} />
      </div>
      <Stage>
        <StageLabel right={`${count} / ${did.length}`}>{t('done.tried')}</StageLabel>
        <ul className="space-y-1.5">
          {did.map((d, i) => (
            <li
              key={d.label}
              className="ct-ob-rise flex items-center gap-3 rounded-2xl border border-border bg-canvas px-3.5 py-2.5"
              style={{ '--d': `${200 + i * 100}ms` } as React.CSSProperties}
            >
              <span className={cn('grid size-6 shrink-0 place-items-center rounded-full', d.done ? 'bg-accent text-accent-contrast' : 'border-2 border-border-strong')}>
                {d.done && <Check size={13} strokeWidth={3.5} aria-hidden />}
              </span>
              <span className={cn('min-w-0 flex-1 text-[14px] font-medium', d.done ? 'text-fg' : 'text-subtle')}>{d.label}</span>
              {!d.done && <span className="shrink-0 text-[12px] text-subtle">{t('done.remind')}</span>}
            </li>
          ))}
        </ul>
      </Stage>
    </>
  )
}
