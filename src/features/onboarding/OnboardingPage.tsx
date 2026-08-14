import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { Button } from '@/components/ui/Button'
import { DoneSlide, WelcomeSlide } from './OnboardingSlides'
import { HeardAboutSlide } from './HeardAboutSlide'
import { HowItWorksSlide } from './HowItWorksSlide'
import { AddCourses } from './AddCourses'
import { CommunityStep } from './CommunityStep'
import { SetupStep, ThemeStep } from './OnboardingSetup'
import { HANDLE_RE, useHandleCheck } from './handle'
import type { ProgramSelection } from '@/components/ui/ProgramPicker'
import { useT } from '@/i18n/i18n'
import { cn } from '@/lib/cn'

// 4 setup steps + 6 intro steps.
// Setup: name, handle, major, theme. Intro: welcome, heard-about, add-courses,
// how-it-works, community, done. (The hands-on walkthrough is now the
// post-onboarding TOUR — the old silently-interactive steps confused people.)
const SETUP_COUNT = 4
const STEP_THEME = 3 // appearance + language
const FIRST_TOUR = SETUP_COUNT // first intro step = Welcome
// Revisiting /onboarding after finishing it shouldn't hide the two settings
// people actually come back to change, so a returning user starts on the
// theme/language step rather than past it.
const STEP_HEARD = 5
const STEP_COURSE = 6
const STEP_HOW = 7
const STEP_COMMUNITY = 8
const STEP_DONE = 9
const TOTAL = 10

export function OnboardingPage() {
  const t = useT()
  const { user, onboardingCompleted, completeOnboarding } = useAppData()
  // (program is collected via the searchable picker — structured, not free text)
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [decided, setDecided] = useState(false)
  const [name, setName] = useState(user.name === 'Student' ? '' : user.name)
  const [handle, setHandle] = useState('')
  const [profilePublic, setProfilePublic] = useState(false)
  const [program, setProgram] = useState<ProgramSelection | null>(null)
  const [addedCourse, setAddedCourse] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const handleStatus = useHandleCheck(handle)

  // Decide the starting step once the profile resolves: a returning, already-
  // onboarded user skips the identity setup (name/handle/major/theme) and lands
  // straight on the tour, so a reload never re-prompts for those. Adjusting state
  // during render (guarded to run once) is React's recommended alternative to an
  // effect here — it re-renders before paint, so there's no flash of setup.
  if (!decided && onboardingCompleted !== null) {
    if (onboardingCompleted) setStep(STEP_THEME)
    setDecided(true)
  }

  const minStep = onboardingCompleted ? STEP_THEME : 0
  const isSetup = step < SETUP_COUNT
  const isLast = step === STEP_DONE
  const canAdvance =
    step === 0
      ? name.trim().length > 0
      : step === 1
        ? HANDLE_RE.test(handle) && handleStatus !== 'taken'
        : step === 2
          ? program !== null
          : step === STEP_COURSE
            ? addedCourse
            : true

  const finish = async () => {
    setSubmitError('')
    setLeaving(true)
    const { error } = await completeOnboarding({
      name: name.trim(),
      handle,
      programId: program?.id,
      program: program?.name,
      profilePublic,
    })
    if (error === 'handle-taken') {
      setLeaving(false)
      setSubmitError('That handle was just taken — please pick another.')
      setStep(1)
      return
    }
    if (error) {
      setLeaving(false)
      setSubmitError('Something went wrong saving — please try again.')
      return
    }
    navigate('/app', { replace: true })
  }
  const skip = async () => {
    // Setup (name / handle / program) is mandatory — only the tour is skippable.
    if (isSetup) return
    setLeaving(true)
    const base = {
      name: name.trim() || undefined,
      programId: program?.id,
      program: program?.name,
      profilePublic,
    }
    let res = await completeOnboarding({ ...base, handle: HANDLE_RE.test(handle) ? handle : undefined })
    // Skipping with a taken handle → finish without it rather than block the exit.
    if (res.error === 'handle-taken') res = await completeOnboarding(base)
    if (res.error) {
      setLeaving(false)
      setSubmitError('Something went wrong — please try again.')
      return
    }
    navigate('/app', { replace: true })
  }
  const advance = () => {
    if (isLast) void finish()
    else if (canAdvance) setStep((s) => s + 1)
  }
  const back = () => setStep((s) => Math.max(minStep, s - 1))

  // Keyboard: ←/→/Enter advance, Esc skip. A ref keeps the handler fresh.
  const ref = useRef({ advance, back, skip })
  useEffect(() => {
    ref.current = { advance, back, skip }
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inField = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName ?? '')
      if (e.key === 'Escape') {
        e.preventDefault()
        void ref.current.skip()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        ref.current.advance()
      } else if (e.key === 'ArrowRight' && !inField) {
        e.preventDefault()
        ref.current.advance()
      } else if (e.key === 'ArrowLeft' && !inField) {
        e.preventDefault()
        ref.current.back()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  if (onboardingCompleted === null || !decided || leaving) {
    return (
      <div className="grid h-svh place-items-center bg-canvas">
        <Loader2 className="size-6 animate-spin text-accent" aria-label="Loading" />
      </div>
    )
  }

  const label = isLast
    ? t('onboarding.enterApp')
    : isSetup || step === STEP_COURSE
      ? t('common.continue')
      : t('common.next')

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {/* Blueprint grid as a dedicated BACKGROUND layer, not on the content
          container — the utility's radial mask would otherwise clip the whole
          element (all the content) to ≤50% opacity. `fixed` makes this div a
          stacking context, so the -z-10 grid paints above the canvas + below UI. */}
      <div className="ct-grid-bg pointer-events-none absolute inset-0 -z-10" aria-hidden />
      <header className="flex shrink-0 items-center justify-between px-5 py-4 sm:px-8 sm:py-5">
        {step > minStep ? (
          <button
            type="button"
            onClick={back}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors duration-150 hover:text-fg"
          >
            <ArrowLeft size={16} aria-hidden />
            {t('common.back')}
          </button>
        ) : (
          <span />
        )}
        {isSetup ? (
          <span />
        ) : (
          <button
            type="button"
            onClick={() => void skip()}
            className="text-[13px] font-medium text-subtle transition-colors duration-150 hover:text-fg"
          >
            {t('onboarding.skipTour')}
          </button>
        )}
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center px-5 py-5 sm:px-6 sm:py-8">
          <div key={step} className="ct-onboard-in w-full">
            {step < 3 ? (
              <SetupStep
                step={step}
                name={name}
                setName={setName}
                handle={handle}
                setHandle={setHandle}
                profilePublic={profilePublic}
                setProfilePublic={setProfilePublic}
                program={program}
                setProgram={setProgram}
                avatarUrl={user.avatarUrl}
                handleStatus={handleStatus}
              />
            ) : step === 3 ? (
              <ThemeStep />
            ) : step === FIRST_TOUR ? (
              <WelcomeSlide />
            ) : step === STEP_HEARD ? (
              <HeardAboutSlide />
            ) : step === STEP_COURSE ? (
              <AddCourses onAdded={() => setAddedCourse(true)} />
            ) : step === STEP_HOW ? (
              <HowItWorksSlide />
            ) : step === STEP_COMMUNITY ? (
              <CommunityStep />
            ) : (
              <DoneSlide />
            )}
          </div>
        </div>
      </main>

      <footer className="flex shrink-0 flex-col items-center gap-3 border-t border-border bg-canvas px-6 pt-4 pb-6 sm:gap-4 sm:pb-9">
        {submitError && <p className="text-[12px] font-medium text-danger">{submitError}</p>}
        <Button className="min-w-[200px]" disabled={!canAdvance} onClick={advance}>
          {label}
          {!isLast && <ArrowRight size={16} aria-hidden />}
        </Button>
        {step === STEP_COURSE && !addedCourse && (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            className="text-[12px] text-subtle transition-colors duration-150 hover:text-fg"
          >
            {t('onboarding.addLater')}
          </button>
        )}
        <Stepper total={TOTAL} current={step} label={t('onboarding.progress')} />
      </footer>
    </div>
  )
}

function Stepper({ total, current, label }: { total: number; current: number; label: string }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={current + 1}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-label={label}
      className="flex w-full max-w-[320px] items-center gap-1.5"
    >
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
          <div className={cn('h-full rounded-full bg-accent transition-all duration-500 ease-out', i <= current ? 'w-full' : 'w-0')} />
        </div>
      ))}
    </div>
  )
}
