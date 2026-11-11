import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { useNoIndex } from '@/app/hooks/useNoIndex'
import { cn } from '@/lib/cn'
import { StepHandle, StepHello } from './StepsA'
import { StepOutline } from './StepOutline'
import { StepGrade, StepPlan } from './StepsB'
import { StepDone, StepGoals } from './StepsC'
import { StepMoodle, StepSocial, StepTick } from './StepsD'
import { TAKEN } from './ob-data'

const TOTAL = 10
/** A slide cannot be skipped by reflex: Continue unlocks after this, or sooner if they try the step. */
const HOLD_MS = 3000
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
 * one real action per screen, on a sample course, so the features people never
 * find are things they have already used once.
 *
 * How a step says "do this": a light circles the border of the ONE control
 * that matters (ObParts → beam) and stops once it is used. No written hints.
 * The big button fills for three seconds before it unlocks, unless the step
 * was tried first, so nobody taps through on reflex.
 *
 * Nothing is saved; it is a sandbox on mock data. Theme locked to default dark.
 */
export function DevOnboardingPage() {
  useNoIndex()
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState<'right' | 'left'>('right')
  const [held, setHeld] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [scanned, setScanned] = useState(false)
  const [added, setAdded] = useState<string[]>([])
  const [moodle, setMoodle] = useState<'yes' | 'later' | null>(null)
  const [ticked, setTicked] = useState<Set<string>>(new Set())
  const [quiz, setQuiz] = useState('17/20')
  const [target, setTarget] = useState(80)
  const [whatIf, setWhatIf] = useState(72)
  const [gradeTouched, setGradeTouched] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set(['comm']))
  const [fixed, setFixed] = useState(false)
  const [following, setFollowing] = useState<Set<string>>(new Set())
  const [goals, setGoals] = useState<Set<string>>(new Set())

  const handleOk = handle.length >= 3 && !TAKEN.has(handle)
  const tried = [
    name.trim().length > 0,
    handleOk,
    scanned || added.length > 0,
    moodle !== null,
    ticked.size > 0,
    gradeTouched,
    picked.size > 1,
    following.size > 0,
    goals.size > 0,
    false,
  ][step]

  // The hold: `held` is the step whose three seconds are up.
  useEffect(() => {
    const id = window.setTimeout(() => setHeld(step), HOLD_MS)
    return () => window.clearTimeout(id)
  }, [step])
  const unlocked = tried || held === step
  const last = step === TOTAL - 1

  const go = useCallback((to: number) => {
    setStep((cur) => {
      const next = Math.max(0, Math.min(TOTAL - 1, to))
      setDir(next >= cur ? 'right' : 'left')
      return next
    })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      const typing = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'
      const forward = (e.key === 'Enter' && el.tagName !== 'BUTTON') || (!typing && e.key === 'ArrowRight')
      if (forward && unlocked) go(step + 1)
      if (!typing && e.key === 'ArrowLeft') go(step - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, step, unlocked])

  const label = last ? 'Open my Today' : step === 0 ? "Let's go" : tried ? 'Continue' : 'Skip for now'

  return (
    <div data-theme="dark" className="fixed inset-0 flex h-[100dvh] flex-col overflow-hidden bg-canvas font-sans text-fg antialiased">
      <div className="ct-grid-bg pointer-events-none absolute inset-0 opacity-60" aria-hidden />

      <header className="relative z-10 flex flex-wrap items-center gap-x-4 gap-y-2.5 px-5 pt-[calc(env(safe-area-inset-top)+12px)] pb-2 sm:pb-3">
        <Logo />
        <div className="order-3 flex basis-full items-center gap-1 sm:order-none sm:flex-1 sm:basis-0 sm:gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={TOTAL} aria-valuenow={step + 1} aria-label="Progress">
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
          {step === 1 && <StepHandle name={name} handle={handle} setHandle={setHandle} />}
          {step === 2 && (
            <StepOutline
              scanned={scanned}
              onScanned={() => setScanned(true)}
              added={added}
              addCourse={(code) => setAdded((a) => (a.includes(code) ? a : [...a, code]))}
            />
          )}
          {step === 3 && <StepMoodle choice={moodle} setChoice={setMoodle} />}
          {step === 4 && <StepTick ticked={ticked} toggle={(id) => setTicked((s) => toggled(s, id))} />}
          {step === 5 && (
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
          {step === 6 && <StepPlan picked={picked} toggle={(id) => setPicked((s) => toggled(s, id))} fixed={fixed} onFix={() => setFixed(true)} />}
          {step === 7 && <StepSocial following={following} toggle={(id) => setFollowing((s) => toggled(s, id))} />}
          {step === 8 && <StepGoals goals={goals} toggle={(id) => setGoals((s) => toggled(s, id))} />}
          {step === 9 && (
            <StepDone
              name={name}
              did={[
                { label: `Claimed ${handleOk ? `@${handle}` : 'a handle'}`, done: handleOk },
                { label: 'Added a course', done: scanned || added.length > 0 },
                { label: 'Ticked off a deadline', done: ticked.size > 0 },
                { label: 'Checked what you need on a final', done: gradeTouched },
                { label: 'Built a week for next term', done: picked.size > 1 },
                { label: 'Followed a club', done: following.size > 0 },
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
          </p>
          {last ? (
            <Link
              to="/app"
              aria-disabled={!unlocked}
              onClick={(e) => !unlocked && e.preventDefault()}
              className={cn(
                'group relative inline-flex h-12 flex-1 items-center justify-center gap-2 overflow-hidden rounded-2xl px-7 text-[15px] font-bold sm:flex-none',
                unlocked ? 'ct-ob-cta bg-accent text-accent-contrast' : 'cursor-default bg-surface-2 text-subtle',
              )}
            >
              {!unlocked && <span key={step} className="ct-ob-fill absolute inset-0 bg-accent/25" aria-hidden />}
              <span className="relative">{label}</span>
              <ArrowRight size={17} className="relative transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => go(step + 1)}
              disabled={!unlocked}
              className={cn(
                'group relative inline-flex h-12 flex-1 items-center justify-center gap-2 overflow-hidden rounded-2xl px-7 text-[15px] font-bold transition-colors duration-300 sm:flex-none',
                !unlocked
                  ? 'cursor-default bg-surface-2 text-subtle'
                  : tried
                    ? 'ct-ob-cta bg-accent text-accent-contrast'
                    : 'border border-border-strong text-fg hover:bg-surface-2',
              )}
            >
              {!unlocked && <span key={step} className="ct-ob-fill absolute inset-0 bg-accent/25" aria-hidden />}
              <span className="relative">{label}</span>
              <ArrowRight size={17} className="relative transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}
