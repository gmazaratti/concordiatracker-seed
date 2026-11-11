import { useEffect, useRef, useState } from 'react'
import { Check, FileText, ScanLine } from 'lucide-react'
import { cn } from '@/lib/cn'
import { OUTLINE } from './ob-data'
import { Stage, StageLabel, StepCopy } from './ObParts'

/* ── 1. Hello ─────────────────────────────────────────────────────────────── */

export function StepHello({ name, setName }: { name: string; setName: (v: string) => void }) {
  const first = name.trim().split(/\s+/)[0]
  return (
    <>
      <StepCopy
        label="Welcome"
        title={<>Your whole semester, <span className="text-accent">one screen.</span></>}
        sub="Two minutes, and you will have tried the four things students use most. Nothing here is saved yet."
      />
      <Stage>
        <label className="block">
          <span className="text-[13px] font-medium text-muted">First, what should we call you?</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your first name"
            autoComplete="given-name"
            className="mt-2 w-full rounded-2xl border border-border bg-canvas px-4 py-3.5 text-[18px] font-medium text-fg outline-none transition-colors duration-200 placeholder:text-subtle focus:border-accent"
          />
        </label>
        <div className="mt-4 rounded-2xl border border-border bg-canvas p-4">
          <p className="text-[12px] text-subtle">Tuesday, November 10</p>
          <p className="mt-1 font-display text-[24px] leading-tight font-semibold text-fg">
            Good morning{first ? ',' : ''}{' '}
            <span key={first} className={cn('text-accent', first && 'ct-ob-pop inline-block')}>
              {first || '…'}
            </span>
          </p>
          <p className="mt-2 text-[13px] text-muted">This is how the app greets you every day.</p>
        </div>
      </Stage>
    </>
  )
}

/* ── 2. Scan an outline ───────────────────────────────────────────────────── */

export function StepScan({ scanned, onScanned }: { scanned: boolean; onScanned: () => void }) {
  const [scanning, setScanning] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const scan = () => {
    if (scanning || scanned) return
    setScanning(true)
    timer.current = window.setTimeout(() => {
      setScanning(false)
      onScanned()
    }, 1500)
  }

  return (
    <>
      <StepCopy
        label="Step 1 · Course outlines"
        title="Drop in an outline. Get every deadline."
        sub="Your prof's PDF, a Word file, even a photo. We read the dates and what each one is worth, so you never type them."
        hint="Tap the outline to scan it"
        done={scanned}
      />
      <Stage>
        <div className="grid gap-4 sm:grid-cols-[150px_1fr] sm:items-start">
          <button
            type="button"
            onClick={scan}
            aria-label="Scan the sample outline"
            className={cn(
              'relative mx-auto flex h-[128px] w-[104px] shrink-0 flex-col gap-2 sm:h-[176px] sm:w-[136px] overflow-hidden rounded-xl border border-border-strong bg-canvas p-3 text-left transition-transform duration-300 sm:mx-0',
              !scanned && !scanning && 'ct-ob-pulse ct-ob-float cursor-pointer hover:scale-[1.03]',
              scanned && 'opacity-60',
            )}
          >
            <span className="flex items-center gap-1.5 text-[10.5px] font-semibold text-muted">
              <FileText size={12} aria-hidden /> COMM 305.pdf
            </span>
            {[92, 70, 84, 55, 78, 64, 88].map((w, i) => (
              <span key={i} className="h-1.5 rounded-full bg-border-strong/70" style={{ width: `${w}%` }} />
            ))}
            {scanning && <span className="ct-scan-sweep pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-accent/0 via-accent/35 to-accent/0" aria-hidden />}
          </button>

          <div className="min-w-0">
            <StageLabel right={scanned ? 'Weights total 100%' : undefined}>
              {scanning ? 'Reading…' : scanned ? 'COMM 305 · found 4' : 'Your deadlines land here'}
            </StageLabel>
            {scanned ? (
              <ul className="space-y-2">
                {OUTLINE.map((o, i) => (
                  <li
                    key={o.id}
                    className="ct-ob-rise flex items-center gap-3 rounded-xl border border-border bg-canvas px-3 py-2.5"
                    style={{ '--d': `${i * 110}ms` } as React.CSSProperties}
                  >
                    <span className="w-[84px] shrink-0 text-[10.5px] font-semibold tracking-wide text-accent uppercase">{o.kind}</span>
                    <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-fg">{o.title}</span>
                    <span className="shrink-0 text-[12px] text-muted">{o.due}</span>
                    <span className="w-9 shrink-0 text-right text-[12px] font-semibold text-fg tabular-nums">{o.weight}%</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="grid h-[150px] place-items-center rounded-xl border border-dashed border-border-strong text-center sm:h-[176px]">
                <span className="flex flex-col items-center gap-2 text-[13px] text-subtle">
                  <ScanLine size={22} className={cn(scanning && 'animate-pulse text-accent')} aria-hidden />
                  {scanning ? 'Finding dates and weights' : 'Nothing yet'}
                </span>
              </div>
            )}
          </div>
        </div>
      </Stage>
    </>
  )
}

/* ── 3. Tick things off ───────────────────────────────────────────────────── */

export function StepTick({ ticked, toggle }: { ticked: Set<string>; toggle: (id: string) => void }) {
  const items = OUTLINE.slice(0, 3)
  const done = items.filter((i) => ticked.has(i.id)).length
  return (
    <>
      <StepCopy
        label="Step 2 · Today"
        title="Open the app. See what is due. Tick it off."
        sub="Today shows only what needs you right now, soonest first. That is the whole daily routine."
        hint="Tick one off"
        done={done > 0}
      />
      <Stage>
        <StageLabel right={`${done} of ${items.length} done`}>Due this week</StageLabel>
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out" style={{ width: `${(done / items.length) * 100}%` }} />
        </div>
        <ul className="space-y-2">
          {items.map((o, i) => {
            const on = ticked.has(o.id)
            return (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => toggle(o.id)}
                  aria-pressed={on}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all duration-300',
                    on ? 'border-accent/40 bg-accent-soft/50' : 'border-border bg-canvas hover:border-border-strong',
                  )}
                >
                  <span
                    className={cn(
                      'relative grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors duration-200',
                      on ? 'border-accent bg-accent text-accent-contrast' : 'border-border-strong',
                      !on && done === 0 && i === 0 && 'ct-ob-pulse',
                    )}
                  >
                    {on && <Check size={13} strokeWidth={3.5} className="ct-ob-check" aria-hidden />}
                    {on && <span className="ct-ob-ring pointer-events-none absolute inset-0 rounded-full border-2 border-accent" aria-hidden />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-[15px] font-medium transition-colors duration-300', on ? 'text-subtle line-through' : 'text-fg')}>
                      {o.title}
                    </span>
                    <span className="block text-[12px] text-subtle">COMM 305 · {o.kind} · {o.weight}%</span>
                  </span>
                  <span className={cn('shrink-0 text-[13px] font-semibold', on ? 'text-success' : 'text-fg')}>{on ? 'Done' : `Due ${o.due}`}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </Stage>
    </>
  )
}
