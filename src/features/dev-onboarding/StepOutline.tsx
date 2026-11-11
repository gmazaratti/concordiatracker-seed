import { useEffect, useRef, useState } from 'react'
import { Check, FileText, PenLine, Plus, ScanLine, Search } from 'lucide-react'
import { cn } from '@/lib/cn'
import { CATALOGUE, OUTLINE } from './ob-data'
import { Stage, StageLabel, StepCopy } from './ObParts'
import { beam } from './ob-beam'

type Mode = 'scan' | 'search' | 'manual'
const MODES: { id: Mode; label: string; icon: typeof ScanLine }[] = [
  { id: 'scan', label: 'Scan an outline', icon: ScanLine },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'manual', label: 'Type it in', icon: PenLine },
]

/**
 * Add your first course, three ways: scan the outline (the fast one), find it
 * in Concordia's course list, or type it in. Whichever they pick, the copy says
 * out loud that it can wait: a step that looks compulsory gets abandoned.
 */
export function StepOutline({
  scanned,
  onScanned,
  added,
  addCourse,
}: {
  scanned: boolean
  onScanned: () => void
  added: string[]
  addCourse: (code: string) => void
}) {
  const [mode, setMode] = useState<Mode>('scan')
  const [scanning, setScanning] = useState(false)
  const [q, setQ] = useState('')
  const [code, setCode] = useState('')
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const untouched = !scanned && added.length === 0

  const scan = () => {
    if (scanning || scanned) return
    setScanning(true)
    timer.current = window.setTimeout(() => {
      setScanning(false)
      onScanned()
    }, 1500)
  }
  const hits = CATALOGUE.filter((c) => `${c.code} ${c.title}`.toLowerCase().includes(q.trim().toLowerCase()))

  return (
    <>
      <StepCopy
        label="Your first course"
        title="Drop in an outline. Get every deadline."
        sub="Your prof's PDF, a Word file, even a photo. We read the dates and what each one is worth. No outline yet? Search for the course or type it in."
        note="Not ready? You can always add courses later, from the Courses tab."
      />
      <Stage>
        <div className="mb-3 flex gap-1 rounded-xl bg-canvas p-1" role="tablist" aria-label="How to add a course">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => setMode(m.id)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[12.5px] font-semibold transition-colors duration-200',
                mode === m.id ? 'bg-surface-2 text-fg' : 'text-subtle hover:text-fg',
              )}
            >
              <m.icon size={14} aria-hidden />
              {m.label}
            </button>
          ))}
        </div>

        {mode === 'scan' && (
          <div className="grid gap-4 sm:grid-cols-[150px_1fr] sm:items-start">
            <button
              type="button"
              onClick={scan}
              aria-label="Scan the sample outline"
              className={cn(
                'mx-auto flex h-[128px] w-[104px] shrink-0 flex-col gap-2 overflow-hidden rounded-xl border border-border-strong bg-canvas p-3 text-left transition-transform duration-300 sm:mx-0 sm:h-[176px] sm:w-[136px]',
                beam(!scanned && !scanning),
                !scanned && !scanning && 'ct-ob-float cursor-pointer hover:scale-[1.03]',
                scanned && 'opacity-60',
              )}
            >
              <span className="flex items-center gap-1.5 text-[10.5px] font-semibold text-muted">
                <FileText size={12} aria-hidden /> COMM 305.pdf
              </span>
              {[92, 70, 84, 55, 78, 64, 88].map((w, i) => (
                <span key={i} className="h-1.5 shrink-0 rounded-full bg-border-strong/70" style={{ width: `${w}%` }} />
              ))}
              {scanning && <span className="ct-scan-sweep pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-accent/0 via-accent/35 to-accent/0" aria-hidden />}
            </button>
            <div className="min-w-0">
              <StageLabel right={scanned ? 'Weights total 100%' : undefined}>
                {scanning ? 'Reading…' : scanned ? 'COMM 305 · found 4' : 'Tap the outline'}
              </StageLabel>
              {scanned ? (
                <ul className="space-y-2">
                  {OUTLINE.map((o, i) => (
                    <li key={o.id} className="ct-ob-rise flex items-center gap-3 rounded-xl border border-border bg-canvas px-3 py-2.5" style={{ '--d': `${i * 110}ms` } as React.CSSProperties}>
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
                    {scanning ? 'Finding dates and weights' : 'Your deadlines land here'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {mode === 'search' && (
          <div>
            <span className={cn('block rounded-xl', beam(untouched && !q))}>
              <span className="flex items-center gap-2 rounded-xl border border-border bg-canvas px-3 py-2.5 focus-within:border-accent">
                <Search size={15} className="text-subtle" aria-hidden />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Course code or name" aria-label="Search courses" className="min-w-0 flex-1 bg-transparent text-[15px] text-fg outline-none placeholder:text-subtle" />
              </span>
            </span>
            <ul className="mt-2 max-h-[200px] space-y-1.5 overflow-y-auto">
              {hits.map((c) => {
                const on = added.includes(c.code)
                return (
                  <li key={c.code}>
                    <button type="button" onClick={() => addCourse(c.code)} disabled={on} className={cn('flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors duration-200', on ? 'border-accent/40 bg-accent-soft/50' : 'border-border bg-canvas hover:border-border-strong')}>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-semibold text-fg">{c.code}</span>
                        <span className="block truncate text-[12px] text-subtle">{c.title} · {c.credits} credits</span>
                      </span>
                      <span className={cn('grid size-7 shrink-0 place-items-center rounded-full', on ? 'bg-accent text-accent-contrast' : 'border border-border-strong text-muted')}>
                        {on ? <Check size={14} strokeWidth={3} className="ct-ob-check" aria-hidden /> : <Plus size={14} aria-hidden />}
                      </span>
                    </button>
                  </li>
                )
              })}
              {hits.length === 0 && <li className="px-1 py-3 text-[13px] text-subtle">Nothing matches. Try the code, like COMM 305.</li>}
            </ul>
          </div>
        )}

        {mode === 'manual' && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (code.trim()) addCourse(code.trim().toUpperCase())
              setCode('')
            }}
          >
            <span className={cn('block rounded-xl', beam(untouched && !code))}>
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Course code, like ENGL 244" aria-label="Course code" className="w-full rounded-xl border border-border bg-canvas px-3 py-2.5 text-[15px] text-fg outline-none placeholder:text-subtle focus:border-accent" />
            </span>
            <button type="submit" disabled={!code.trim()} className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-[13px] font-semibold text-accent-contrast transition-opacity duration-200 disabled:opacity-40">
              <Plus size={14} aria-hidden /> Add course
            </button>
            <p className="mt-2 text-[12.5px] text-subtle">You add its deadlines yourself, or scan the outline when you get it.</p>
          </form>
        )}

        {added.length > 0 && mode !== 'scan' && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {added.map((c) => (
              <span key={c} className="ct-ob-pop inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-[12px] font-semibold text-accent">
                <Check size={12} strokeWidth={3} aria-hidden /> {c} added
              </span>
            ))}
          </div>
        )}
      </Stage>
    </>
  )
}
