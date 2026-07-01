import { useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarPlus, PartyPopper, Sparkles, UserCog, Users, type LucideIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTeacher } from '@/app/providers/teacher'
import type { OrgAccount } from '@/data/teacher'
import { OrgLogo } from '@/features/community/OrgLogo'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

// In-memory (resets on reload, like the rest of the demo world): orgs that have
// finished or skipped onboarding, so the wizard shows once per fresh org.
const onboarded = new Set<string>()

/** Shows the guided onboarding wizard ONCE for a fresh (pending) org, then never
 * again this session. Approved/established orgs never see it. */
export function OrgOnboardingGate({ org }: { org: OrgAccount }) {
  const [done, setDone] = useState(() => onboarded.has(org.id) || org.status !== 'pending')
  if (done) return null
  return (
    <OrgOnboardingWizard
      org={org}
      onClose={() => {
        onboarded.add(org.id)
        setDone(true)
      }}
    />
  )
}

interface Step {
  icon: LucideIcon
  title: string
  body: string
  primaryLabel: string
  onPrimary: () => void
  secondary?: boolean
}

function OrgOnboardingWizard({ org, onClose }: { org: OrgAccount; onClose: () => void }) {
  const navigate = useNavigate()
  const { createEvent } = useTeacher()
  const [step, setStep] = useState(0)

  const go = (to: string) => {
    onClose()
    navigate(to)
  }
  const newEvent = () => {
    const id = createEvent()
    go(`/organizer/event/${id}`)
  }

  const steps: Step[] = [
    {
      icon: Sparkles,
      title: `Welcome, ${org.org.name}`,
      body: "This is your organizer dashboard — post events, grow your following, and manage your team. Let's get you set up in a few quick steps.",
      primaryLabel: 'Get started',
      onPrimary: () => setStep(1),
    },
    {
      icon: UserCog,
      title: 'Set up your profile',
      body: 'Add a bio, logo, banner, and links so students recognize your org across Community.',
      primaryLabel: 'Set up profile',
      onPrimary: () => go('/organizer/profile'),
      secondary: true,
    },
    {
      icon: CalendarPlus,
      title: 'Post your first event',
      body: 'Create an event — it appears in Community for students the moment your org is approved.',
      primaryLabel: 'Create an event',
      onPrimary: newEvent,
      secondary: true,
    },
    {
      icon: Users,
      title: 'Invite your team',
      body: 'Share the dashboard with co-organizers so you can run events together.',
      primaryLabel: 'Invite your team',
      onPrimary: () => go('/organizer/team'),
      secondary: true,
    },
    {
      icon: PartyPopper,
      title: "You're all set",
      body: 'Your org is pending approval — draft everything now, and it goes live in Community the moment an admin approves you.',
      primaryLabel: 'Go to dashboard',
      onPrimary: onClose,
    },
  ]

  const s = steps[step]
  const Icon = s.icon

  return createPortal(
    <div className="ct-animate-fade fixed inset-0 z-[80] flex flex-col bg-canvas">
      <div className="flex items-center gap-4 px-5 pt-[calc(1rem+env(safe-area-inset-top))] sm:px-8">
        <div className="flex flex-1 gap-1.5">
          {steps.map((_, i) => (
            <span
              key={i}
              className={cn('h-1 flex-1 rounded-full transition-colors duration-300', i <= step ? 'bg-accent' : 'bg-surface-2')}
              aria-hidden
            />
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[13px] font-medium text-subtle transition-colors hover:text-fg"
        >
          Skip
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center px-5 sm:px-8">
        <div key={step} className="ct-animate-pop w-full max-w-md text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
            <Icon size={26} aria-hidden />
          </span>
          <h1 className="mt-5 font-display text-[26px] leading-tight font-semibold text-fg">{s.title}</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">{s.body}</p>
          <div className="mt-7 flex flex-col items-center gap-3">
            <Button size="lg" onClick={s.onPrimary}>
              {s.primaryLabel}
            </Button>
            {s.secondary && (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="text-[13px] font-medium text-subtle transition-colors hover:text-fg"
              >
                Do this later
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:px-8">
        <div className="flex items-center gap-2">
          <OrgLogo org={org.org} className="size-7" rounded="rounded-lg" textClass="text-[11px]" />
          <span className="text-[12px] text-subtle">{org.org.handle}</span>
        </div>
        <span className="text-[12px] text-subtle tabular-nums">
          Step {step + 1} of {steps.length}
        </span>
      </div>
    </div>,
    document.body,
  )
}
