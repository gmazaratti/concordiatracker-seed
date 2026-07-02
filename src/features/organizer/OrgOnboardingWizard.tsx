import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  CalendarPlus,
  Check,
  CheckCircle2,
  Megaphone,
  PartyPopper,
  UserCog,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import type { OrgAccount } from '@/data/teacher'
import { OrgLogo } from '@/features/community/OrgLogo'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

// In-memory (resets on reload): orgs that finished/skipped onboarding, and the
// step each org is on — so the wizard RESUMES after you leave to do a step.
const onboarded = new Set<string>()
const stepByOrg = new Map<string, number>()

/** Shows the guided onboarding wizard for a fresh (pending) org until finished or
 * skipped. Approved/established orgs never see it. */
export function OrgOnboardingGate({ org }: { org: OrgAccount }) {
  const [done, setDone] = useState(() => onboarded.has(org.id) || org.status !== 'pending')
  if (done) return null
  return (
    <OrgOnboardingWizard
      org={org}
      onClose={() => {
        onboarded.add(org.id)
        stepByOrg.delete(org.id)
        setDone(true)
      }}
    />
  )
}

interface StepDef {
  id: string
  railLabel: string
  railHint: string
  icon: LucideIcon
  title: string
  body: string
  /** Live completion, derived from the org's real state. */
  isDone?: (org: OrgAccount) => boolean
  /** Where "do it now" goes (an event is created first when `createsEvent`). */
  to?: string
  createsEvent?: boolean
  primaryLabel: string
}

const STEPS: StepDef[] = [
  {
    id: 'welcome',
    railLabel: 'Welcome',
    railHint: 'What this portal does',
    icon: Megaphone,
    title: 'Your events, in every student’s pocket',
    body: 'This dashboard puts your org in the Community feed of ConcordiaTracker. Here’s the loop: you post events → students follow, save, and get reminded → you see what worked.',
    primaryLabel: 'Show me the steps',
  },
  {
    id: 'profile',
    railLabel: 'Profile',
    railHint: 'Who you are',
    icon: UserCog,
    title: 'First, make it look like you',
    body: 'Your profile is your face in the feed — logo, banner, bio, and links. Students recognize (and trust) orgs that look real.',
    isDone: (o) => !!o.org.bio?.trim() || !!o.org.logo,
    to: '/organizer/profile',
    primaryLabel: 'Set up my profile',
  },
  {
    id: 'event',
    railLabel: 'First event',
    railHint: 'What students see',
    icon: CalendarPlus,
    title: 'Post your first event',
    body: 'An event card lands in Community where any student can open it, add it to their calendar, and set a reminder. Draft it now — it goes live the moment you’re approved.',
    isDone: (o) => o.events.length > 0,
    createsEvent: true,
    primaryLabel: 'Create an event',
  },
  {
    id: 'team',
    railLabel: 'Team',
    railHint: 'Run it together',
    icon: Users,
    title: 'Don’t run it alone',
    body: 'Invite co-organizers with a link — they get the same dashboard, so anyone on your exec can post and edit events.',
    isDone: (o) => o.members.length > 1,
    to: '/organizer/team',
    primaryLabel: 'Invite my team',
  },
  {
    id: 'done',
    railLabel: 'Finish',
    railHint: 'What happens next',
    icon: PartyPopper,
    title: 'You’re set — here’s what happens next',
    body: '',
    primaryLabel: 'Go to my dashboard',
  },
]

function OrgOnboardingWizard({ org, onClose }: { org: OrgAccount; onClose: () => void }) {
  const navigate = useNavigate()
  const { createEvent } = useTeacher()
  const [step, setStep] = useState(() => Math.min(stepByOrg.get(org.id) ?? 0, STEPS.length - 1))

  const setAndRemember = (n: number) => {
    stepByOrg.set(org.id, n)
    setStep(n)
  }
  const advance = () => setAndRemember(Math.min(step + 1, STEPS.length - 1))
  const back = () => setAndRemember(Math.max(step - 1, 0))

  const s = STEPS[step]
  const last = step === STEPS.length - 1
  const sDone = s.isDone?.(org) ?? false

  function primary() {
    if (last) {
      onClose()
      return
    }
    if (sDone || (!s.to && !s.createsEvent)) {
      advance()
      return
    }
    // Leave to DO the step; remember the next step so the wizard resumes there.
    stepByOrg.set(org.id, step + 1)
    if (s.createsEvent) {
      const id = createEvent()
      navigate(`/organizer/event/${id}`)
    } else if (s.to) {
      navigate(s.to)
    }
  }

  return createPortal(
    <div className="ct-animate-fade fixed inset-0 z-[80] flex bg-canvas">
      {/* Steps rail (desktop) */}
      <aside className="hidden w-[300px] shrink-0 flex-col border-r border-border bg-surface/40 p-5 lg:flex">
        <div className="flex items-center gap-2.5">
          <OrgLogo org={org.org} className="size-10" rounded="rounded-xl" textClass="text-[14px]" />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-fg">{org.org.name}</p>
            <p className="truncate text-[11.5px] text-subtle">{org.org.handle}</p>
          </div>
        </div>

        <ol className="mt-7 flex flex-col gap-1">
          {STEPS.map((def, i) => {
            const done = def.isDone?.(org) ?? false
            const current = i === step
            return (
              <li key={def.id}>
                <button
                  type="button"
                  onClick={() => setAndRemember(i)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors duration-150',
                    current ? 'bg-accent-soft' : 'hover:bg-surface-2/60',
                  )}
                >
                  <span
                    className={cn(
                      'grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold',
                      done
                        ? 'bg-accent text-accent-contrast'
                        : current
                          ? 'border-2 border-accent text-accent'
                          : 'border-2 border-border-strong text-subtle',
                    )}
                  >
                    {done ? <Check size={13} strokeWidth={3} aria-hidden /> : i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className={cn('block text-[13px] font-medium', current ? 'text-fg' : 'text-muted')}>
                      {def.railLabel}
                    </span>
                    <span className="block truncate text-[11px] text-subtle">{def.railHint}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>

        <div className="flex-1" />
        <button
          type="button"
          onClick={onClose}
          className="self-start text-[13px] font-medium text-subtle transition-colors hover:text-fg"
        >
          Skip setup
        </button>
      </aside>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {/* Mobile progress header */}
        <div className="flex items-center gap-4 px-5 pt-[calc(1rem+env(safe-area-inset-top))] lg:hidden">
          <div className="flex flex-1 gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors duration-300',
                  i <= step ? 'bg-accent' : 'bg-surface-2',
                )}
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

        <div className="flex flex-1 items-center justify-center px-5 py-8 sm:px-10">
          <div key={s.id} className="ct-animate-pop w-full max-w-md">
            <StepVisual step={s.id} org={org} />

            <h1 className="mt-6 font-display text-[25px] leading-tight font-semibold text-fg">
              {s.title}
            </h1>
            {s.body && <p className="mt-2.5 text-[14.5px] leading-relaxed text-muted">{s.body}</p>}
            {last && <NextUp />}
            {sDone && !last && (
              <p className="mt-2.5 inline-flex items-center gap-1.5 text-[13px] font-medium text-accent">
                <CheckCircle2 size={15} aria-hidden /> Already done — nice.
              </p>
            )}

            <div className="mt-7 flex flex-wrap items-center gap-3">
              {step > 0 && (
                <button
                  type="button"
                  onClick={back}
                  aria-label="Back"
                  className="grid size-11 place-items-center rounded-xl border border-border text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                >
                  <ArrowLeft size={17} aria-hidden />
                </button>
              )}
              <Button size="lg" onClick={primary}>
                {sDone && !last ? 'Next' : s.primaryLabel}
              </Button>
              {!last && !sDone && s.id !== 'welcome' && (
                <button
                  type="button"
                  onClick={advance}
                  className="text-[13px] font-medium text-subtle transition-colors hover:text-fg"
                >
                  Do this later
                </button>
              )}
            </div>

            <p className="mt-6 text-[12px] text-subtle tabular-nums lg:hidden">
              Step {step + 1} of {STEPS.length}
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Concrete per-step visuals — small mocks of the real thing, so each step shows
 * (not just tells) what you're setting up. */
function StepVisual({ step, org }: { step: string; org: OrgAccount }) {
  const color = org.org.color
  switch (step) {
    case 'welcome':
      return (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <PillarRow icon={CalendarPlus} title="Post events" sub="They appear in every student's Community feed" />
          <PillarRow icon={UserPlus} title="Grow a following" sub="Followers get a heads-up when you post" border />
          <PillarRow icon={BarChart3} title="See what worked" sub="Views, saves, and follows — aggregate only" border />
        </div>
      )
    case 'profile':
      // Mini public-profile header
      return (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="h-16 w-full" style={{ backgroundColor: color }} />
          <div className="px-4 pb-4">
            <div className="-mt-7">
              <OrgLogo org={org.org} className="size-14 ring-4 ring-surface" rounded="rounded-full" textClass="text-[17px]" />
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <p className="text-[15px] font-semibold text-fg">{org.org.name}</p>
              <BadgeCheck size={15} className="text-info" aria-hidden />
            </div>
            <p className="text-[12px] text-subtle">{org.org.handle}</p>
            {org.org.bio?.trim() ? (
              <p className="mt-1.5 line-clamp-2 text-[12.5px] text-muted">{org.org.bio}</p>
            ) : (
              <div className="mt-2 space-y-1.5" aria-hidden>
                <div className="h-2 w-4/5 rounded-full bg-surface-2" />
                <div className="h-2 w-3/5 rounded-full bg-surface-2" />
              </div>
            )}
          </div>
        </div>
      )
    case 'event':
      // Mini event card, student side
      return (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="relative h-20 w-full" style={{ backgroundColor: color }}>
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-black/35" />
            <span className="absolute top-2.5 left-2.5 grid size-7 place-items-center rounded-md bg-white/20 text-white backdrop-blur-sm">
              <Megaphone size={15} aria-hidden />
            </span>
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-medium text-fg">Your first event</p>
              <p className="text-[11.5px] text-subtle">Date · Location · hosted by {org.org.handle}</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11.5px] font-medium text-muted">
              <CalendarPlus size={13} aria-hidden />
              Add
            </span>
          </div>
        </div>
      )
    case 'team':
      return (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <TeamRow name="You" tag="Owner" active />
          <TeamRow name="Your co-organizer" tag="Invited · pending" border />
        </div>
      )
    default:
      return (
        <span className="grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
          <PartyPopper size={26} aria-hidden />
        </span>
      )
  }
}

function PillarRow({
  icon: Icon,
  title,
  sub,
  border,
}: {
  icon: LucideIcon
  title: string
  sub: string
  border?: boolean
}) {
  return (
    <div className={cn('flex items-center gap-3 px-4 py-3', border && 'border-t border-border')}>
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
        <Icon size={17} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[13.5px] font-medium text-fg">{title}</p>
        <p className="truncate text-[11.5px] text-subtle">{sub}</p>
      </div>
    </div>
  )
}

function TeamRow({
  name,
  tag,
  active,
  border,
}: {
  name: string
  tag: string
  active?: boolean
  border?: boolean
}) {
  return (
    <div className={cn('flex items-center gap-3 px-4 py-3', border && 'border-t border-border')}>
      <span
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-full text-[12px] font-semibold',
          active ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-subtle',
        )}
      >
        {name[0]}
      </span>
      <p className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-fg">{name}</p>
      <span
        className={cn(
          'shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-medium',
          active ? 'bg-info/15 text-info' : 'bg-warning/15 text-warning',
        )}
      >
        {tag}
      </span>
    </div>
  )
}

/** The final step's "what happens next" — so a new org knows where things stand. */
function NextUp() {
  return (
    <ul className="mt-4 space-y-2.5">
      {[
        'An admin reviews your org — usually quickly.',
        'Once approved, your profile and events go live in Community.',
        'Track it all from the sidebar: Events, Insights, Profile, Team.',
      ].map((t, i) => (
        <li key={i} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-muted">
          <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft text-[10.5px] font-semibold text-accent">
            {i + 1}
          </span>
          {t}
        </li>
      ))}
    </ul>
  )
}
