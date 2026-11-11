import { AlertTriangle, Wand2 } from 'lucide-react'
import { percentToGrade } from '@/lib/gpa'
import { cn } from '@/lib/cn'
import { PLAN, TARGETS, gpaWith, neededOnFinal, overlaps, readGrade, standing } from './ob-data'
import { Stage, StageLabel, StepCopy } from './ObParts'

/* ── 4. Grades: where you stand, what you need ────────────────────────────── */

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
  const pct = readGrade(quiz)
  const q = pct ?? 85
  const now = standing(q)
  const need = neededOnFinal(q, target)
  const gpa = gpaWith(whatIf)
  const reachable = need <= 100
  return (
    <>
      <StepCopy
        label="Step 3 · Grades"
        title="Know where you stand. Know what you need."
        sub="Type a grade the way it is written on the paper. The math for the rest of the term does itself."
        hint="Change the grade or drag the slider"
        done={touched}
      />
      <Stage>
        <StageLabel right="COMM 305">Quiz 1 · worth 10%</StageLabel>
        <div className="flex items-center gap-3">
          <input
            value={quiz}
            onChange={(e) => setQuiz(e.target.value)}
            inputMode="decimal"
            aria-label="Your Quiz 1 grade"
            placeholder="17/20"
            className={cn(
              'w-28 rounded-xl border bg-canvas px-3 py-2.5 text-center text-[18px] font-semibold text-fg outline-none transition-colors duration-200 focus:border-accent',
              pct === null && quiz.trim() ? 'border-danger' : 'border-border',
            )}
          />
          <p className="text-[14px] text-muted">
            {pct === null ? (
              'Try 17/20 or 85'
            ) : (
              <>
                = <span className="font-semibold text-fg">{Math.round(pct)}%</span>, {/^[AF]/.test(percentToGrade(pct).letter) ? 'an' : 'a'}{' '}
                <span key={percentToGrade(pct).letter} className="ct-ob-pop inline-block font-semibold text-accent">
                  {percentToGrade(pct).letter}
                </span>
              </>
            )}
          </p>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-canvas p-4">
          <p className="text-[13px] text-muted">
            You are at <span className="font-semibold text-fg">{Math.round(now)}%</span> with the final still to come. To finish with
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label="Target grade">
            {TARGETS.map((t) => (
              <button
                key={t.letter}
                type="button"
                aria-pressed={target === t.min}
                onClick={() => setTarget(t.min)}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-all duration-200',
                  target === t.min ? 'scale-105 bg-accent text-accent-contrast' : 'border border-border text-muted hover:text-fg',
                )}
              >
                {t.letter}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[15px] text-fg">
            you need{' '}
            <span key={Math.round(need)} className={cn('ct-ob-pop inline-block text-[22px] font-bold tabular-nums', reachable ? 'text-accent' : 'text-danger')}>
              {need <= 0 ? 'nothing more' : `${Math.round(need)}%`}
            </span>{' '}
            {need > 0 && 'on the final.'}
            {!reachable && <span className="ml-1 text-[13px] text-danger">Out of reach, pick a lower target.</span>}
          </p>
        </div>

        <div className="mt-3 rounded-2xl border border-border bg-canvas p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[13px] text-muted">
              If COMM 305 ends at <span className="font-semibold text-fg tabular-nums">{whatIf}%</span>, your GPA is
            </p>
            <p key={gpa.toFixed(2)} className="ct-ob-pop text-[24px] font-bold text-fg tabular-nums">{gpa.toFixed(2)}</p>
          </div>
          <input
            type="range"
            min={50}
            max={100}
            value={whatIf}
            onChange={(e) => setWhatIf(Number(e.target.value))}
            aria-label="COMM 305 final grade"
            className="ct-range mt-3 w-full"
            style={{ '--fill': `${((whatIf - 50) / 50) * 100}%` } as React.CSSProperties}
          />
        </div>
      </Stage>
    </>
  )
}

/* ── 5. Plan next term ────────────────────────────────────────────────────── */

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const FROM = 9
const TO = 15
const pos = (h: number) => `${((h - FROM) / (TO - FROM)) * 100}%`

export function StepPlan({
  picked,
  toggle,
  fixed,
  onFix,
}: {
  picked: Set<string>
  toggle: (id: string) => void
  fixed: boolean
  onFix: () => void
}) {
  const active = PLAN.filter((c) => picked.has(c.id)).map((c) => ({ ...c, meets: c.id === 'reli' && fixed && c.alt ? c.alt : c.meets }))
  const clash = new Set<string>()
  for (const a of active) for (const b of active) if (a.id < b.id && a.meets.some((m) => b.meets.some((n) => overlaps(m, n)))) clash.add(a.id).add(b.id)
  const credits = active.length * 3
  return (
    <>
      <StepCopy
        label="Step 4 · Planner"
        title="Build next term before seats run out."
        sub="Pick courses and see them on one week. Conflicts are caught for you, and a full class can be watched until a seat opens."
        hint="Tap the courses to add them"
        done={picked.size > 1}
      />
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
                  on ? 'border-transparent text-white' : 'border-border text-muted hover:text-fg',
                  !on && picked.size <= 1 && 'ct-ob-pulse',
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
          {DAYS.map((d) => (
            <p key={d} className="text-center text-[11px] font-semibold text-subtle">{d}</p>
          ))}
        </div>
        <div className="relative mt-1 h-[200px] overflow-hidden rounded-xl border border-border bg-canvas sm:h-[230px]">
          {[1, 2, 3, 4].map((i) => (
            <span key={i} className="absolute inset-y-0 w-px bg-border/60" style={{ left: `${i * 20}%` }} aria-hidden />
          ))}
          {active.flatMap((c) =>
            c.meets.map((m, i) => (
              <span
                key={`${c.id}-${i}`}
                className={cn(
                  'ct-ob-pop absolute rounded-md px-1 py-0.5 text-[9.5px] leading-tight font-bold text-white transition-all duration-500 ease-out sm:text-[10.5px]',
                  clash.has(c.id) && 'ring-2 ring-danger',
                )}
                style={{ left: `calc(${m[0] * 20}% + 2px)`, width: 'calc(20% - 4px)', top: pos(m[1]), height: `calc(${pos(m[2])} - ${pos(m[1])})`, backgroundColor: c.color }}
              >
                {c.code}
              </span>
            )),
          )}
        </div>

        <div className="mt-3 flex min-h-[38px] flex-wrap items-center justify-between gap-2">
          <p className="text-[13px] text-muted">
            <span className="font-semibold text-fg tabular-nums">{credits}</span> credits
            {credits >= 12 ? <span className="text-success"> · full-time</span> : credits > 0 ? ' · part-time' : ''}
          </p>
          {clash.size > 0 ? (
            <button type="button" onClick={onFix} className="ct-ob-pop inline-flex items-center gap-1.5 rounded-full bg-danger/15 px-3 py-1.5 text-[12.5px] font-semibold text-danger">
              <AlertTriangle size={13} aria-hidden /> Two classes clash
              <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-danger px-2 py-0.5 text-white">
                <Wand2 size={11} aria-hidden /> Fix it
              </span>
            </button>
          ) : (
            active.length > 1 && <p className="ct-ob-pop text-[12.5px] font-semibold text-success">No conflicts</p>
          )}
        </div>
      </Stage>
    </>
  )
}
