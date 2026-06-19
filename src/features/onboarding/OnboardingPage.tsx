import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { Button } from '@/components/ui/Button'
import { DoneSlide, TodaySlide, WelcomeSlide } from './OnboardingSlides'
import { AddFirstCourse } from './AddFirstCourse'
import { CommunityStep } from './CommunityStep'
import { cn } from '@/lib/cn'
import { supabase } from '@/lib/supabase'

// 3 setup steps + 5 tour steps (welcome, add-course, today, community, done).
const SETUP_COUNT = 3
const STEP_COURSE = 4
const STEP_DONE = 7
const TOTAL = 8
const HANDLE_RE = /^[a-z0-9_]{3,20}$/

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
            {isSetup ? (
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
              <WelcomeSlide />
            ) : step === STEP_COURSE ? (
              <AddFirstCourse onAdded={() => setAddedCourse(true)} />
            ) : step === 5 ? (
              <TodaySlide />
            ) : step === 6 ? (
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
            I'll add a course later
          </button>
        )}
        <Stepper total={TOTAL} current={step} />
      </footer>
    </div>
  )
}

/** Debounced live check of whether a handle is free (via the handle_available
 * RPC). Degrades to 'idle' if the RPC isn't present yet, so onboarding still
 * works — the submit-time unique-violation catch is the backstop. */
function useHandleCheck(handle: string): 'idle' | 'free' | 'taken' {
  const [checked, setChecked] = useState<{ handle: string; available: boolean } | null>(null)
  useEffect(() => {
    if (!HANDLE_RE.test(handle)) return
    let active = true
    const t = setTimeout(() => {
      void supabase.rpc('handle_available', { p_handle: handle }).then(({ data, error }) => {
        if (active && !error) setChecked({ handle, available: data === true })
      })
    }, 450)
    return () => {
      active = false
      clearTimeout(t)
    }
  }, [handle])
  if (checked == null || checked.handle !== handle) return 'idle'
  return checked.available ? 'free' : 'taken'
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

const field =
  'mt-5 w-full rounded-xl border border-border bg-surface px-4 py-3 text-center text-[18px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none'

function SetupStep({
  step,
  name,
  setName,
  handle,
  setHandle,
  major,
  setMajor,
  avatarUrl,
  handleStatus,
  onEnter,
}: {
  step: number
  name: string
  setName: (v: string) => void
  handle: string
  setHandle: (v: string) => void
  major: string
  setMajor: (v: string) => void
  avatarUrl?: string
  handleStatus: 'idle' | 'free' | 'taken'
  onEnter: () => void
}) {
  if (step === 0) {
    return (
      <Centered heading="Welcome — what should we call you?" sub="This is your display name. You can change it any time in Settings.">
        {avatarUrl && (
          <img src={avatarUrl} alt="" referrerPolicy="no-referrer" className="mx-auto size-14 rounded-full bg-surface-2 object-cover" />
        )}
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={60} className={field} />
      </Centered>
    )
  }
  if (step === 1) {
    const valid = HANDLE_RE.test(handle)
    return (
      <Centered heading="Claim your handle" sub="How you'll show up on feedback posts. 3–20 lowercase letters, numbers, or underscores.">
        <div className="mt-5 flex items-center rounded-xl border border-border bg-surface px-4 py-3 focus-within:border-accent">
          <span className="text-[18px] text-subtle">@</span>
          <input
            autoFocus
            value={handle}
            onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))}
            placeholder="handle"
            className="ml-0.5 w-full bg-transparent text-[18px] text-fg placeholder:text-subtle focus:outline-none"
          />
        </div>
        {handle.length > 0 && !valid && <p className="mt-2 text-[12px] text-warning">A little longer — at least 3 characters.</p>}
        {valid && handleStatus === 'taken' && <p className="mt-2 text-[12px] text-danger">@{handle} is taken — try another.</p>}
        {valid && handleStatus === 'free' && <p className="mt-2 text-[12px] text-success">@{handle} is available.</p>}
      </Centered>
    )
  }
  return (
    <Centered heading="What are you studying?" sub="Your major personalizes the app (and Community relevance).">
      <input
        autoFocus
        value={major}
        onChange={(e) => setMajor(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onEnter()}
        placeholder="e.g. Computer Science"
        maxLength={80}
        className={field}
      />
    </Centered>
  )
}

function Centered({ heading, sub, children }: { heading: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col text-center">
      <h2 className="font-display text-[21px] leading-tight font-semibold text-fg sm:text-[28px]">{heading}</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-muted sm:text-[14px]">{sub}</p>
      <div className="mt-2 space-y-4">{children}</div>
    </div>
  )
}
