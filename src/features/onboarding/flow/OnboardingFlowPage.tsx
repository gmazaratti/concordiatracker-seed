import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { useAppData } from '@/app/providers/app-data'
import { useAuth } from '@/app/providers/auth'
import { useUiState } from '@/app/providers/ui-state'
import { useI18n } from '@/i18n/i18n'
import type { ProgramSelection } from '@/components/ui/ProgramPicker'
import { cn } from '@/lib/cn'
import { AddCourses } from '../AddCourses'
import { HeardAboutSlide } from '../HeardAboutSlide'
import { SetupStep } from '../OnboardingSetup'
import { HANDLE_RE, useHandleCheck } from '../handle'
import { StepHandle, StepHello, type HandleState } from './StepsA'
import { StepGrade, StepPlan } from './StepsB'
import { StepDone, StepGoals } from './StepsC'
import { StepMoodle, StepSocial, StepTick } from './StepsD'
import { StepNotes } from './StepNotes'
import { ARRIVE_KEY } from './ob-data'
import { useOb, type ObKey } from './ob-i18n'

type StepId = 'name' | 'handle' | 'program' | 'course' | 'moodle' | 'tick' | 'grade' | 'plan' | 'notes' | 'social' | 'goals' | 'heard' | 'done'
/** Steps that cannot be passed without an answer. Everything else unlocks after HOLD_MS. */
const REQUIRED = new Set<StepId>(['name', 'handle', 'program', 'goals'])
const LOCKED_LABEL: Partial<Record<StepId, ObKey>> = { name: 'btn.name', handle: 'btn.handle', program: 'btn.program', goals: 'btn.goals' }
const HOLD_MS = 3000
const toggled = (set: Set<string>, id: string) => {
  const next = new Set(set)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

/**
 * Onboarding, hands-on (live since 2026-11-10; the previous question-and-slides
 * flow is kept at /dev/onboarding-old). English and French (ob-i18n.ts); the
 * language is chosen on the first screen.
 *
 * Measured before the switch: the typical student used 4 of 14 features. So
 * this teaches by doing. Real steps save real things (name, handle, programme,
 * courses, Moodle, club follows, goals); the Today, grades, planner and notes
 * steps are a sandbox on a sample course.
 *
 * How a step says "do this": a light circles the border of the one control
 * that matters and stops once it is used. Required steps stay locked until
 * answered; the others unlock after three seconds, or at once if tried.
 */
export function OnboardingFlowPage() {
  const { user, onboardingCompleted, completeOnboarding, courses } = useAppData()
  const { user: authUser, loading: authLoading } = useAuth()
  const { patchUiState } = useUiState()
  const { lang } = useI18n()
  const t = useOb()
  const navigate = useNavigate()

  const [decided, setDecided] = useState(false)
  const [returning, setReturning] = useState(false)
  const [i, setI] = useState(0)
  const [dir, setDir] = useState<'right' | 'left'>('right')
  const [held, setHeld] = useState<StepId | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [error, setError] = useState<ObKey | null>(null)
  const [skipWarn, setSkipWarn] = useState(false)

  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [program, setProgram] = useState<ProgramSelection | null>(null)
  const [atConcordia, setAtConcordia] = useState(true)
  const [school, setSchool] = useState('')
  const [profilePublic, setProfilePublic] = useState(false)
  const [addedCourse, setAddedCourse] = useState(false)
  const [moodle, setMoodle] = useState<'yes' | 'later' | null>(null)
  const [ticked, setTicked] = useState<Set<string>>(new Set())
  const [quiz, setQuiz] = useState('17/20')
  const [target, setTarget] = useState(80)
  const [whatIf, setWhatIf] = useState(72)
  const [gradeTouched, setGradeTouched] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set(['comm']))
  const [fixed, setFixed] = useState(false)
  const [watching, setWatching] = useState(false)
  const [notesTouched, setNotesTouched] = useState(false)
  const [followed, setFollowed] = useState(false)
  const [goals, setGoals] = useState<Set<string>>(new Set())

  // Prefill once the profile resolves (adjust-during-render, runs once).
  if (!decided && onboardingCompleted !== null) {
    setDecided(true)
    setReturning(onboardingCompleted)
    setName(user.name === 'Student' ? '' : user.name)
    setHandle(user.handle ?? '')
    setAtConcordia(user.atConcordia)
  }

  const check = useHandleCheck(handle)
  const handleState: HandleState = !handle
    ? 'empty'
    : !HANDLE_RE.test(handle)
      ? 'short'
      : handle === user.handle
        ? 'mine'
        : check === 'taken'
          ? 'taken'
          : check === 'free'
            ? 'ok'
            : 'checking'
  const handleOk = handleState === 'ok' || handleState === 'mine'

  // A returning student already has a programme; other schools have no Moodle.
  const steps = useMemo<StepId[]>(
    () =>
      (
        ['name', 'handle', !returning && 'program', 'course', atConcordia && 'moodle', 'tick', 'grade', 'plan', 'notes', 'social', 'goals', !returning && 'heard', 'done'] as (
          | StepId
          | false
        )[]
      ).filter((s): s is StepId => !!s),
    [returning, atConcordia],
  )
  const step = steps[Math.min(i, steps.length - 1)]
  const last = step === 'done'

  const answered: Record<StepId, boolean> = {
    name: name.trim().length > 0,
    handle: handleOk,
    program: atConcordia ? program !== null : school.trim().length > 0,
    course: addedCourse || courses.length > 0,
    moodle: moodle !== null,
    tick: ticked.size > 0,
    grade: gradeTouched,
    plan: picked.size > 1 || watching,
    notes: notesTouched,
    social: followed,
    goals: goals.size > 0,
    heard: false,
    done: false,
  }
  const tried = answered[step]

  useEffect(() => {
    const id = window.setTimeout(() => setHeld(step), HOLD_MS)
    return () => window.clearTimeout(id)
  }, [step])
  const unlocked = REQUIRED.has(step) ? tried : tried || held === step

  const go = useCallback(
    (to: number) => {
      setI((cur) => {
        const next = Math.max(0, Math.min(steps.length - 1, to))
        setDir(next >= cur ? 'right' : 'left')
        return next
      })
    },
    [steps.length],
  )

  const finish = useCallback(async () => {
    setError(null)
    setLeaving(true)
    const changedHandle = handleOk && handle !== user.handle ? handle : undefined
    const [{ error: err }] = await Promise.all([
      completeOnboarding({
        name: name.trim() || undefined,
        handle: changedHandle,
        programId: !returning && atConcordia ? program?.id : undefined,
        program: !returning ? program?.name : undefined,
        school: !returning && !atConcordia ? school.trim() : undefined,
        atConcordia: returning ? undefined : atConcordia,
        profilePublic: returning ? undefined : profilePublic,
      }),
      // Let the curtain finish before the page changes underneath it.
      new Promise((r) => window.setTimeout(r, 620)),
    ])
    if (err) {
      setLeaving(false)
      setError(err === 'handle-taken' ? 'err.handleTaken' : 'err.save')
      if (err === 'handle-taken') setI(steps.indexOf('handle'))
      return
    }
    // The guided tour of the REAL app is still offered after this (it walks the
    // actual screens; this flow was a sandbox), so tourPromptSeen is left alone.
    patchUiState({ goals: [...goals] })
    try {
      sessionStorage.setItem(ARRIVE_KEY, '1')
    } catch {
      /* private mode: Today simply appears without the entrance */
    }
    navigate('/app', { replace: true })
  }, [atConcordia, completeOnboarding, goals, handle, handleOk, name, navigate, patchUiState, profilePublic, program, returning, school, steps, user.handle])

  const advance = useCallback(() => {
    if (!unlocked) return
    if (step === 'course' && !answered.course && !skipWarn) {
      setSkipWarn(true)
      return
    }
    setSkipWarn(false)
    if (last) void finish()
    else go(i + 1)
  }, [unlocked, last, finish, go, i, step, answered.course, skipWarn])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      const typing = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable
      // The real steps have their own inputs and buttons: Enter belongs to them.
      const own = step === 'course' || step === 'moodle' || step === 'program' || step === 'heard' || step === 'notes'
      if (e.key === 'Enter' && el.tagName !== 'BUTTON' && !own) advance()
      if (!typing && e.key === 'ArrowRight') advance()
      if (!typing && e.key === 'ArrowLeft') go(i - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [advance, go, i, step])

  if (!authLoading && !authUser) return <Navigate to="/app" replace />
  if (onboardingCompleted === null || !decided) {
    return (
      <div className="grid h-svh place-items-center bg-canvas">
        <Loader2 className="size-6 animate-spin text-accent" aria-label="Loading" />
      </div>
    )
  }

  const lockedKey = LOCKED_LABEL[step]
  const label = last ? t('btn.open') : !tried && lockedKey ? t(lockedKey) : tried || step === 'heard' ? t('btn.continue') : t('btn.skip')
  // Setup is done once the required identity steps are behind them.
  const pastSetup = i > steps.indexOf(returning ? 'handle' : 'program')
  const wide = step === 'program' || step === 'course' || step === 'heard'

  return (
    <div className="fixed inset-0 z-50 flex h-[100dvh] flex-col overflow-hidden bg-canvas font-sans text-fg antialiased">
      <div className="ct-grid-bg pointer-events-none absolute inset-0 opacity-60" aria-hidden />

      <header className="relative z-10 flex flex-wrap items-center gap-x-4 gap-y-2.5 px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-2 sm:px-5 sm:pb-3">
        <Logo />
        <div className="order-3 flex basis-full items-center gap-1 sm:order-none sm:flex-1 sm:basis-0 sm:gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={i + 1}>
          {steps.map((s, n) => (
            <span key={s} className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
              <span className={cn('block h-full rounded-full bg-accent transition-[width] duration-500 ease-out', n <= i ? 'w-full' : 'w-0')} />
            </span>
          ))}
        </div>
        {returning ? (
          <button type="button" onClick={() => navigate('/app')} className="ml-auto shrink-0 text-[13px] text-subtle transition-colors duration-150 hover:text-fg sm:ml-0">
            {t('nav.exit')}
          </button>
        ) : (
          pastSetup &&
          step !== 'goals' &&
          !last && (
            <button type="button" onClick={() => go(steps.indexOf('goals'))} className="ml-auto shrink-0 text-[13px] text-subtle transition-colors duration-150 hover:text-fg sm:ml-0">
              {t('nav.skipTour')}
            </button>
          )
        )}
      </header>

      <main className="relative z-10 flex-1 overflow-x-hidden overflow-y-auto">
        {/* `minmax(0,1fr)` and `*:min-w-0`: an auto grid column grows to its
            longest unbreakable line, which pushed the card off a phone screen. */}
        <div
          key={step}
          className={cn(
            'mx-auto grid min-h-full w-full max-w-5xl grid-cols-[minmax(0,1fr)] content-center gap-5 px-3.5 py-4 *:min-w-0 sm:gap-7 sm:px-8 sm:py-6',
            !wide && 'lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center lg:gap-12',
            dir === 'right' ? 'ct-ob-right' : 'ct-ob-left',
          )}
        >
          {step === 'name' && <StepHello name={name} setName={setName} returning={returning} />}
          {step === 'handle' && <StepHandle name={name} handle={handle} setHandle={setHandle} state={handleState} />}
          {step === 'program' && (
            <SetupStep
              step={2}
              name={name}
              setName={setName}
              handle={handle}
              setHandle={setHandle}
              profilePublic={profilePublic}
              setProfilePublic={setProfilePublic}
              program={program}
              setProgram={setProgram}
              atConcordia={atConcordia}
              setAtConcordia={setAtConcordia}
              school={school}
              setSchool={setSchool}
              avatarUrl={user.avatarUrl}
              handleStatus={check}
            />
          )}
          {step === 'course' && (
            <div>
              <AddCourses onAdded={() => setAddedCourse(true)} concordia={atConcordia} />
              <p className="mt-4 text-center text-[13px] text-subtle">{t('course.later')}</p>
            </div>
          )}
          {step === 'moodle' && <StepMoodle choice={moodle} setChoice={setMoodle} onConnected={() => setMoodle('yes')} />}
          {step === 'tick' && <StepTick ticked={ticked} toggle={(id) => setTicked((s) => toggled(s, id))} />}
          {step === 'grade' && (
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
          {step === 'plan' && (
            <StepPlan
              picked={picked}
              toggle={(id) => setPicked((s) => toggled(s, id))}
              fixed={fixed}
              onFix={() => setFixed(true)}
              watching={watching}
              onWatch={() => setWatching((w) => !w)}
              fr={lang === 'fr'}
            />
          )}
          {step === 'notes' && <StepNotes touched={notesTouched} onTouch={() => setNotesTouched(true)} />}
          {step === 'social' && <StepSocial onFollowed={() => setFollowed(true)} />}
          {step === 'goals' && <StepGoals goals={goals} toggle={(id) => setGoals((s) => toggled(s, id))} />}
          {step === 'heard' && <HeardAboutSlide />}
          {step === 'done' && (
            <StepDone
              name={name}
              did={[
                { label: t('did.handle', { h: handle }), done: handleOk },
                { label: t('did.course'), done: answered.course },
                ...(atConcordia ? [{ label: t('did.moodle'), done: moodle === 'yes' }] : []),
                { label: t('did.tick'), done: answered.tick },
                { label: t('did.grade'), done: gradeTouched },
                { label: t('did.plan'), done: answered.plan },
                { label: t('did.notes'), done: notesTouched },
                { label: t('did.social'), done: followed },
              ]}
            />
          )}
        </div>
      </main>

      <footer className="relative z-10 border-t border-border/60 bg-canvas/85 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)] backdrop-blur sm:px-5">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3">
          <button
            type="button"
            onClick={() => go(i - 1)}
            disabled={i === 0}
            aria-label={t('nav.back')}
            className="grid size-12 shrink-0 place-items-center rounded-2xl border border-border text-muted transition-all duration-200 hover:text-fg disabled:pointer-events-none disabled:opacity-0"
          >
            <ArrowLeft size={18} aria-hidden />
          </button>
          <p className={cn('hidden flex-1 text-[13px] sm:block', error ? 'text-danger' : 'text-subtle')}>{error ? t(error) : t('nav.of', { n: i + 1, total: steps.length })}</p>
          <button
            type="button"
            onClick={advance}
            disabled={!unlocked || leaving}
            className={cn(
              'group relative inline-flex h-12 min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden rounded-2xl px-5 text-[15px] font-bold transition-colors duration-300 sm:flex-none sm:px-7',
              !unlocked
                ? 'cursor-default bg-surface-2 text-subtle'
                : tried || last || step === 'heard'
                  ? 'ct-ob-cta bg-accent text-accent-contrast'
                  : 'border border-border-strong text-fg hover:bg-surface-2',
            )}
          >
            {!unlocked && !REQUIRED.has(step) && <span key={step} className="ct-ob-fill absolute inset-0 bg-accent/25" aria-hidden />}
            <span className="relative truncate">{label}</span>
            <ArrowRight size={17} className="relative shrink-0 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
          </button>
        </div>
        {error && <p className="mt-2 text-center text-[12.5px] text-danger sm:hidden">{t(error)}</p>}
      </footer>

      {skipWarn && step === 'course' && (
        <div className="fixed inset-0 z-[55] grid place-items-end bg-black/60 p-4 sm:place-items-center" role="alertdialog" aria-modal="true" aria-labelledby="ob-skip-title">
          <div className="ct-ob-rise w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-2xl">
            <p id="ob-skip-title" className="text-[17px] font-semibold text-fg">
              {t('skip.title')}
            </p>
            <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{t('skip.body')}</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
              <button type="button" autoFocus onClick={() => setSkipWarn(false)} className="h-11 flex-1 rounded-xl bg-accent px-4 text-[14px] font-bold text-accent-contrast">
                {t('skip.add')}
              </button>
              <button type="button" onClick={advance} className="h-11 flex-1 rounded-xl border border-border px-4 text-[14px] font-medium text-muted transition-colors duration-150 hover:text-fg">
                {t('skip.anyway')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* The exit: the accent colour sweeps up from the button and Today rises out of it. */}
      {leaving && <div className="ct-ob-curtain fixed inset-0 z-[60] bg-accent" aria-hidden />}
    </div>
  )
}
