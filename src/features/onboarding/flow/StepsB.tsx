import { AlertTriangle, Bell, BellRing, Wand2 } from 'lucide-react'
import { percentToGrade } from '@/lib/gpa'
import { cn } from '@/lib/cn'
import { PLAN, TARGETS, gpaWith, neededOnFinal, overlaps, readGrade, standing } from './ob-data'
import { Stage, StageLabel, StepCopy } from './ObParts'
import { beam } from './ob-beam'
import { useOb } from './ob-i18n'

/* ── Grades: where you stand, what you need ───────────────────────────────── */

export function StepGrade({
  quiz,
  setQuiz,
  target,
  setTarget,
  whatIf,
  setWhatIf,
  touched,
}: {
  quiz: string
  setQuiz: (v: string) => void
  target: number
  setTarget: (v: number) => void
  whatIf: number
  setWhatIf: (v: number) => void
  touched: boolean
}) {
  const t = useOb()
  const pct = readGrade(quiz)
  const q = pct ?? 85
  const need = neededOnFinal(q, target)
  const gpa = gpaWith(whatIf)
  const reachable = need <= 100
  return (
    <>
      <StepCopy label={t('grade.label')} title={t('grade.title')} sub={t('grade.sub')} />
      <Stage>
        <StageLabel right="COMM 305">{t('grade.stage')}</StageLabel>
        <div className="flex items-center gap-3">
          <span className={cn('block rounded-xl', beam(!touched))}>
            <input
              value={quiz}
              onChange={(e) => setQuiz(e.target.value)}
              inputMode="decimal"
              aria-label={t('grade.stage')}
              placeholder="17/20"
              className={cn(
                'w-28 rounded-xl border bg-canvas px-3 py-2.5 text-center text-[18px] font-semibold text-fg outline-none transition-colors duration-200 focus:border-accent',
                pct === null && quiz.trim() ? 'border-danger' : 'border-border',
              )}
            />
          </span>
          <p className="text-[14px] text-muted">
            {pct === null ? (
              t('grade.try')
            ) : (
              <>
                = <span className="font-semibold text-fg">{Math.round(pct)}%</span>{' '}
                <span key={percentToGrade(pct).letter} className="ct-ob-pop inline-block font-semibold text-accent">
                  {percentToGrade(pct).letter}
                </span>
              </>
            )}
          </p>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-canvas p-4">
          <p className="text-[13px] text-muted">{t('grade.at', { p: Math.round(standing(q)) })}</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5" role="group">
            {TARGETS.map((x) => (
              <button
                key={x.letter}
                type="button"
                aria-pressed={target === x.min}
                onClick={() => setTarget(x.min)}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-all duration-200',
                  target === x.min ? 'scale-105 bg-accent text-accent-contrast' : 'border border-border text-muted hover:text-fg',
                )}
              >
                {x.letter}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[15px] text-fg">
            {t('grade.need')}{' '}
            <span key={Math.round(need)} className={cn('ct-ob-pop inline-block text-[22px] font-bold tabular-nums', reachable ? 'text-accent' : 'text-danger')}>
              {need <= 0 ? t('grade.nothing') : `${Math.round(need)}%`}
            </span>{' '}
            {need > 0 && t('grade.onFinal')}
            {!reachable && <span className="ml-1 text-[13px] text-danger">{t('grade.out')}</span>}
          </p>
        </div>

        <div className="mt-3 rounded-2xl border border-border bg-canvas p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[13px] text-muted">{t('grade.if', { p: whatIf })}</p>
            <p key={gpa.toFixed(2)} className="ct-ob-pop text-[24px] font-bold text-fg tabular-nums">
              {gpa.toFixed(2)}
            </p>
          </div>
          <input type="range" min={50} max={100} value={whatIf} onChange={(e) => setWhatIf(Number(e.target.value))} aria-label="COMM 305" className="ct-range mt-3 w-full" />
        </div>
      </Stage>
    </>
  )
}

/* ── Planner: a week for next term, and the seat watcher ──────────────────── */

const DAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven']
const FROM = 9
const TO = 15
const pos = (h: number) => `${((h - FROM) / (TO - FROM)) * 100}%`

export function StepPlan({
  picked,
  toggle,
  fixed,
  onFix,
  watching,
  onWatch,
  fr,
}: {
  picked: Set<string>
  toggle: (id: string) => void
  fixed: boolean
  onFix: () => void
  watching: boolean
  onWatch: () => void
  fr: boolean
}) {
  const t = useOb()
  const active = PLAN.filter((c) => picked.has(c.id)).map((c) => ({ ...c, meets: c.id === 'reli' && fixed && c.alt ? c.alt : c.meets }))
  const clash = new Set<string>()
  for (const a of active) for (const b of active) if (a.id < b.id && a.meets.some((m) => b.meets.some((n) => overlaps(m, n)))) clash.add(a.id).add(b.id)
  const credits = active.length * 3
  return (
    <>
      <StepCopy label={t('plan.label')} title={t('plan.title')} sub={t('plan.sub')} />
      <Stage>
        <div className="flex flex-wrap gap-1.5">
          {PLAN.map((c) => {
            const on = picked.has(c.id)
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(c.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-all duration-200',
                  beam(!on && picked.size <= 1 && c.id === 'fina'),
                  on ? 'border-transparent text-white' : 'border-border text-muted hover:text-fg',
                )}
                style={on ? { backgroundColor: c.color } : undefined}
              >
                {!on && <span className="size-2 rounded-full" style={{ backgroundColor: c.color }} aria-hidden />}
                {c.code}
              </button>
            )
          })}
        </div>

        <div className="mt-3 grid grid-cols-5 gap-1">
          {(fr ? DAYS_FR : DAYS_EN).map((d) => (
            <p key={d} className="text-center text-[11px] font-semibold text-subtle">
              {d}
            </p>
          ))}
        </div>
        <div className="relative mt-1 h-[170px] overflow-hidden rounded-xl border border-border bg-canvas sm:h-[200px]">
          {[1, 2, 3, 4].map((i) => (
            <span key={i} className="absolute inset-y-0 w-px bg-border/60" style={{ left: `${i * 20}%` }} aria-hidden />
          ))}
          {active.flatMap((c) =>
            c.meets.map((m, i) => (
              // The code sits dead centre: in a rounded block, text pinned to the
              // top-left corner reads as misplaced.
              <span
                key={`${c.id}-${i}`}
                className={cn(
                  'ct-ob-pop absolute grid place-items-center rounded-lg px-0.5 text-center text-[9.5px] leading-tight font-bold text-white transition-all duration-500 ease-out sm:text-[11px]',
                  clash.has(c.id) && 'ring-2 ring-danger',
                )}
                style={{ left: `calc(${m[0] * 20}% + 3px)`, width: 'calc(20% - 6px)', top: pos(m[1]), height: `calc(${pos(m[2])} - ${pos(m[1])} - 2px)`, backgroundColor: c.color }}
              >
                {c.code}
              </span>
            )),
          )}
        </div>

        <div className="mt-2.5 flex min-h-[34px] flex-wrap items-center justify-between gap-2">
          <p className="text-[13px] text-muted">
            <span className="font-semibold text-fg tabular-nums">{credits}</span> {t('plan.credits')}
            {credits >= 12 ? <span className="text-success"> · {t('plan.full')}</span> : credits > 0 ? ` · ${t('plan.part')}` : ''}
          </p>
          {clash.size > 0 ? (
            <button type="button" onClick={onFix} className="ct-ob-pop inline-flex items-center gap-1.5 rounded-full bg-danger/15 px-3 py-1.5 text-[12.5px] font-semibold text-danger">
              <AlertTriangle size={13} aria-hidden /> {t('plan.clash')}
              <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-danger px-2 py-0.5 text-white">
                <Wand2 size={11} aria-hidden /> {t('plan.fix')}
              </span>
            </button>
          ) : (
            active.length > 1 && <p className="ct-ob-pop text-[12.5px] font-semibold text-success">{t('plan.clear')}</p>
          )}
        </div>

        {/* Seat watch: the other half of the Planner nobody finds on their own. */}
        <div className="mt-2.5 flex items-center gap-3 rounded-2xl border border-border bg-canvas p-3">
          <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl transition-colors duration-200', watching ? 'bg-accent text-accent-contrast' : 'bg-danger/15 text-danger')}>
            {watching ? <BellRing size={17} className="ct-ob-check" aria-hidden /> : <Bell size={17} aria-hidden />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-semibold text-fg">{t('seat.title')}</span>
            <span className="block truncate text-[12px] text-subtle">{watching ? t('seat.note') : t('seat.sub')}</span>
          </span>
          <button
            type="button"
            onClick={onWatch}
            aria-pressed={watching}
            className={cn(
              'shrink-0 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-all duration-200',
              beam(!watching && picked.size > 1),
              watching ? 'border border-accent/40 text-accent' : 'bg-accent text-accent-contrast',
            )}
          >
            {watching ? t('seat.on') : t('seat.watch')}
          </button>
        </div>
      </Stage>
    </>
  )
}
