import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { Button } from '@/components/ui/Button'
import { CalendarSlide, DoneSlide, EditingSlide, TodaySlide, WelcomeSlide } from './OnboardingSlides'
import { AddCourses } from './AddCourses'
import { CommunityStep } from './CommunityStep'
import { SetupStep, ThemeStep } from './OnboardingSetup'
import { HANDLE_RE, useHandleCheck } from './handle'
import { cn } from '@/lib/cn'

// 4 setup steps + 7 tour steps.
// Setup: name, handle, major, theme. Tour: welcome, add-courses, today,
// calendar, editing, community, done.
const SETUP_COUNT = 4
const STEP_COURSE = 5
const STEP_DONE = 10
const TOTAL = 11

export function OnboardingPage() {
  const { user, onboardingCompleted, completeOnboarding } = useAppData()
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [name, setName] = useState(user.name === 'Student' ? '' : user.name)
  const [handle, setHandle] = useState('')
  const [major, setMajor] = useState('')
  const [addedCourse, setAddedCourse] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const handleStatus = useHandleCheck(handle)

  const isSetup = step < SETUP_COUNT
  const isLast = step === STEP_DONE
  const canAdvance =
    step === 0
      ? name.trim().length > 0
      : step === 1
        ? HANDLE_RE.test(handle) && handleStatus !== 'taken'
        : step === 2
          ? major.trim().length > 0
          : step === STEP_COURSE
            ? addedCourse
            : true

  const finish = async () => {
    setSubmitError('')
    setLeaving(true)
    const { error } = await completeOnboarding({ name: name.trim(), handle, major: major.trim() })
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
    setLeaving(true)
    const base = { name: name.trim() || undefined, major: major.trim() || undefined }
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
  const back = () => setStep((s) => Math.max(0, s - 1))

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

  // No completed→/app redirect here: visiting /onboarding directly always replays
  // the flow (for re-testing). The /app gate still routes first-login users in.
  if (onboardingCompleted === null || leaving) {
    return (
      <div className="grid h-svh place-items-center bg-canvas">
        <Loader2 className="size-6 animate-spin text-accent" aria-label="Loading" />
      </div>
    )
  }

  const label = isLast ? 'Enter ConcordiaTracker' : isSetup || step === STEP_COURSE ? 'Continue' : 'Next'

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas">
      <header className="flex shrink-0 items-center justify-between px-5 py-4 sm:px-8 sm:py-5">
        {step > 0 ? (
          <button
            type="button"
            onClick={back}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors duration-150 hover:text-fg"
          >
            <ArrowLeft size={16} aria-hidden />
            Back
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => void skip()}
          className="text-[13px] font-medium text-subtle transition-colors duration-150 hover:text-fg"
        >
          Skip tour
        </button>
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
                major={major}
                setMajor={setMajor}
                avatarUrl={user.avatarUrl}
                handleStatus={handleStatus}
                onEnter={advance}
              />
            ) : step === 3 ? (
              <ThemeStep />
            ) : step === 4 ? (
              <WelcomeSlide />
            ) : step === STEP_COURSE ? (
              <AddCourses onAdded={() => setAddedCourse(true)} />
            ) : step === 6 ? (
              <TodaySlide />
            ) : step === 7 ? (
              <CalendarSlide />
            ) : step === 8 ? (
              <EditingSlide />
            ) : step === 9 ? (
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
            I'll add courses later
          </button>
        )}
        <Stepper total={TOTAL} current={step} />
      </footer>
    </div>
  )
}

function Stepper({ total, current }: { total: number; current: number }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={current + 1}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-label="Onboarding progress"
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
