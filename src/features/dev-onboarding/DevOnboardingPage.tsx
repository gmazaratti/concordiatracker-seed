import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { useNoIndex } from '@/app/hooks/useNoIndex'
import { cn } from '@/lib/cn'
import { StepHello, StepScan, StepTick } from './StepsA'
import { StepGrade, StepPlan } from './StepsB'
import { StepDone, StepGoals } from './StepsC'

const TOTAL = 7
const toggled = (set: Set<string>, id: string) => {
  const next = new Set(set)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

/**
 * /dev/onboarding: a prototype of a hands-on onboarding. NOT the live one.
 *
 * The live flow asks questions and then shows slides; measured 2026-11-10, the
 * typical student went on to use 4 of 14 features. This one teaches by doing:
 * one real action per screen (scan, tick, grade, plan), on a sample course, so
 * the features people never find are things they have already used once.
 *
 * Two rules from what confused people before ("Here's the gist"):
 *   - what to do is said in words AND pulses on the thing itself
 *   - the big button always moves forward, whether or not they tried it
 *
 * Nothing is saved; it is a sandbox on mock data. Theme locked to default dark.
 */
export function DevOnboardingPage() {
  useNoIndex()
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState<'right' | 'left'>('right')
  const [name, setName] = useState('')
  const [scanned, setScanned] = useState(false)
  const [ticked, setTicked] = useState<Set<string>>(new Set())
  const [quiz, setQuiz] = useState('17/20')
  const [target, setTarget] = useState(80)
  const [whatIf, setWhatIf] = useState(72)
  const [gradeTouched, setGradeTouched] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set(['comm']))
  const [fixed, setFixed] = useState(false)
  const [goals, setGoals] = useState<Set<string>>(new Set())

  const go = useCallback((to: number) => {
    setStep((cur) => {
      const next = Math.max(0, Math.min(TOTAL - 1, to))
      setDir(next >= cur ? 'right' : 'left')
      return next
    })
  }, [])

  // Enter moves on (unless they are typing in a field that wants it), and the
  // arrow keys step when focus is not in an input or on the slider.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      const typing = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'
      if (e.key === 'Enter' && el.tagName !== 'BUTTON') go(step + 1)
      if (!typing && e.key === 'ArrowRight') go(step + 1)
      if (!typing && e.key === 'ArrowLeft') go(step - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, step])

  const tried = [true, scanned, ticked.size > 0, gradeTouched, picked.size > 1, goals.size > 0, true][step]
  const last = step === TOTAL - 1
  const label = last ? 'Open my Today' : step === 0 ? "Let's go" : tried ? 'Continue' : 'Skip this one'

  return (
    <div data-theme="dark" className="fixed inset-0 flex h-[100dvh] flex-col overflow-hidden bg-canvas font-sans text-fg antialiased">
      <div className="ct-grid-bg pointer-events-none absolute inset-0 opacity-60" aria-hidden />

      <header className="relative z-10 flex flex-wrap items-center gap-x-4 gap-y-2.5 px-5 pt-[calc(env(safe-area-inset-top)+12px)] pb-2 sm:pb-3">
        <Logo />
        <div className="order-3 flex basis-full items-center gap-1.5 sm:order-none sm:flex-1 sm:basis-0" role="progressbar" aria-valuemin={1} aria-valuemax={TOTAL} aria-valuenow={step + 1} aria-label="Progress">
          {Array.from({ length: TOTAL }, (_, i) => (
            <span key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
              <span className={cn('block h-full rounded-full bg-accent transition-[width] duration-500 ease-out', i <= step ? 'w-full' : 'w-0')} />
            </span>
          ))}
        </div>
        <Link to="/app" className="ml-auto shrink-0 text-[13px] text-subtle transition-colors duration-150 hover:text-fg sm:ml-0">
          Skip all
        </Link>
      </header>

      <main className="relative z-10 flex-1 overflow-x-hidden overflow-y-auto">
        <div
          key={step}
          className={cn(
            'mx-auto grid min-h-full w-full max-w-5xl content-center gap-5 px-5 py-4 sm:gap-7 sm:px-8 sm:py-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center lg:gap-12',
            dir === 'right' ? 'ct-ob-right' : 'ct-ob-left',
          )}
        >
          {step === 0 && <StepHello name={name} setName={setName} />}
          {step === 1 && <StepScan scanned={scanned} onScanned={() => setScanned(true)} />}
          {step === 2 && <StepTick ticked={ticked} toggle={(id) => setTicked((s) => toggled(s, id))} />}
          {step === 3 && (
            <StepGrade
              quiz={quiz}
              setQuiz={(v) => (setQuiz(v), setGradeTouched(true))}
              target={target}
              setTarget={(v) => (setTarget(v), setGradeTouched(true))}
              whatIf={whatIf}
              setWhatIf={(v) => (setWhatIf(v), setGradeTouched(true))}
              touched={gradeTouched}
            />
          )}
          {step === 4 && <StepPlan picked={picked} toggle={(id) => setPicked((s) => toggled(s, id))} fixed={fixed} onFix={() => setFixed(true)} />}
          {step === 5 && <StepGoals goals={goals} toggle={(id) => setGoals((s) => toggled(s, id))} />}
          {step === 6 && (
            <StepDone
              name={name}
              did={[
                { label: 'Scanned a course outline', done: scanned },
                { label: 'Ticked off a deadline', done: ticked.size > 0 },
                { label: 'Checked what you need on a final', done: gradeTouched },
                { label: 'Built a week for next term', done: picked.size > 1 },
              ]}
            />
          )}
        </div>
      </main>

      <footer className="relative z-10 border-t border-border/60 bg-canvas/85 px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3">
          <button
            type="button"
            onClick={() => go(step - 1)}
            disabled={step === 0}
            aria-label="Back"
            className="grid size-12 shrink-0 place-items-center rounded-2xl border border-border text-muted transition-all duration-200 hover:text-fg disabled:pointer-events-none disabled:opacity-0"
          >
            <ArrowLeft size={18} aria-hidden />
          </button>
          <p className="hidden flex-1 text-[13px] text-subtle sm:block">
            {step + 1} of {TOTAL}
            {step > 0 && !last && !tried && ' · try it, or skip. Either works.'}
          </p>
          {last ? (
            <Link to="/app" className="ct-ob-cta group inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-accent px-7 text-[15px] font-bold text-accent-contrast sm:flex-none">
              {label}
              <ArrowRight size={17} className="transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => go(step + 1)}
              className={cn(
                'group inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl px-7 text-[15px] font-bold transition-all duration-300 sm:flex-none',
                tried ? 'ct-ob-cta bg-accent text-accent-contrast' : 'border border-border-strong text-fg hover:bg-surface-2',
              )}
            >
              {label}
              <ArrowRight size={17} className="transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}
