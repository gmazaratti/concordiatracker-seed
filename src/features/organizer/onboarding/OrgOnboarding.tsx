import { useState } from 'react'
import { fireWrite, supabase } from '@/lib/supabase'
import { createPortal } from 'react-dom'
import {
  ArrowLeft,
  AtSign,
  CalendarPlus,
  Check,
  Megaphone,
  PartyPopper,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import type { OrgAccount } from '@/data/teacher'
import type { EventOrg } from '@/data/community'
import { OrgLogo } from '@/features/community/OrgLogo'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { onboarded, roleAsked, stepByOrg } from '../onboarding-state'
import { useHandleCheck } from './handle-check'
import {
  EventStep,
  HandleStep,
  NextUp,
  Pillars,
  ProfileStep,
  RoleGate,
  TeamStep,
} from './steps'
import { TutorialHint } from '@/components/TutorialHint'

/**
 * Setting a club up: ONE flow, five steps, and a question before them.
 *
 * THERE USED TO BE TWO. Accepting an invite landed on `/organizer/setup`
 * (three cards), which finished by sending you to the dashboard — where this
 * wizard immediately opened and asked most of the same things again. Two
 * onboardings is worse than either one of them, because the second makes the
 * first look like it did not save.
 *
 * WHAT THE STEPS ARE, in the order somebody can answer them: who you are in
 * the club (before anything, because it decides who owns it), the name people
 * type, what you look like, the first thing you will post, and who else runs
 * it with you.
 *
 * NOTHING NAVIGATES AWAY. Drafting an event and inviting a teammate used to
 * leave the wizard for another screen, which ended onboarding two steps early
 * — the report was that "invite my team" dumped you on the dashboard. Both
 * happen in place now.
 *
 * SAVES PER STEP. Closing the tab on step three does not throw away step one,
 * and Skip is on every screen: a setup nobody can get out of is a wall.
 */
export function OrgOnboardingGate({
  org,
  replay = false,
  onReplayDone,
  onClosed,
}: {
  org: OrgAccount
  replay?: boolean
  onReplayDone?: () => void
  /** Setup was finished or skipped — the page behind may now render. */
  onClosed?: () => void
}) {
  /* WHICH club was dismissed, not a boolean — a `useState(() => …)`
     initialiser runs ONCE, with whatever club was current when this mounted.
     Deriving it every render from the club in hand is the same fix the image
     fallbacks needed: record the subject, not the verdict.

     AND THE SOURCE OF TRUTH IS THE DATABASE, not the club's approval status.
     This used to read `org.status !== 'pending'`, which is a different fact
     entirely: an invite that hands over an EXISTING club gives you one that is
     already approved, so the wizard could never open on that path. It is
     `organizations.setup_completed_at` now, which also means skipping survives
     a reload instead of living in a Set that empties. An ABSENT value (a demo
     or seeded account, which has no row) counts as done: a missing fact should
     never force a wizard on somebody. */
  const [dismissed, setDismissed] = useState<string | null>(null)
  const done = dismissed === org.id || onboarded.has(org.id) || (org.setupDone ?? true)
  if (done && !replay) return null
  return (
    <OrgOnboarding
      // Remounted per club, so a switch starts its own draft rather than
      // carrying the last club's half-typed name into it.
      key={org.id}
      org={org}
      replay={replay}
      onClose={() => {
        onboarded.add(org.id)
        stepByOrg.delete(org.id)
        setDismissed(org.id)
        /* Written down, so closing it means closed — on this device and the
           next one. `fireWrite`, NOT `void`: a PostgREST builder is lazy and
           only sends its request when something subscribes to it, so `void
           supabase.rpc(…)` is a call that never happens. */
        fireWrite(supabase.rpc('mark_org_setup_done', { p_org: org.id }))
        onReplayDone?.()
        onClosed?.()
      }}
    />
  )
}

interface StepDef {
  id: 'welcome' | 'handle' | 'profile' | 'event' | 'team' | 'done'
  railLabel: string
  railHint: string
  icon: LucideIcon
  title: string
  body: string
  primaryLabel: string
  /** Live completion, read off the org's real state. */
  isDone?: (org: OrgAccount) => boolean
}

const STEPS: StepDef[] = [
  {
    id: 'welcome',
    railLabel: 'Welcome',
    railHint: 'What this portal does',
    icon: Megaphone,
    title: 'Your events, in every student’s pocket',
    body: 'This dashboard puts your club in the Community feed of ConcordiaTracker. Here’s the loop: you post events → students follow, save, and get reminded → you see what worked.',
    primaryLabel: 'Show me the steps',
  },
  {
    id: 'handle',
    railLabel: 'Name & handle',
    railHint: 'What students type',
    icon: AtSign,
    title: 'Claim your handle',
    body: 'Your handle is your address here — it is what goes in every link you share. Pick it now, while nothing points at it yet.',
    primaryLabel: 'Save & continue',
  },
  {
    id: 'profile',
    railLabel: 'Profile',
    railHint: 'How you look',
    icon: UserCog,
    title: 'Now make it look like you',
    body: 'Everything below changes the preview as you go, and the preview is the real profile page — not a drawing of it.',
    isDone: (o) => !!o.org.bio?.trim() || !!o.org.logo,
    primaryLabel: 'Save & continue',
  },
  {
    id: 'event',
    railLabel: 'First event',
    railHint: 'What students see',
    icon: CalendarPlus,
    title: 'Post your first event',
    body: 'An event card lands in Community where any student can open it, add it to their calendar, and set a reminder. Draft it here: it goes live the moment you’re approved.',
    isDone: (o) => o.events.some((e) => e.title.trim().length > 0),
    primaryLabel: 'Continue',
  },
  {
    id: 'team',
    railLabel: 'Team',
    railHint: 'Run it together',
    icon: Users,
    title: 'Don’t run it alone',
    body: 'Invite co-organizers with a link: they get the same dashboard, so anyone on your exec can post and edit events.',
    // "Anybody besides me", not "more than one row". `currentOrg` pins a
    // synthetic You at the top of the list, so a count is answering a
    // different question from the one this step asks.
    isDone: (o) => o.members.some((m) => !m.isYou),
    primaryLabel: 'Continue',
  },
  {
    id: 'done',
    railLabel: 'Finish',
    railHint: 'What happens next',
    icon: PartyPopper,
    title: 'You’re set: here’s what happens next',
    body: '',
    primaryLabel: 'Go to my dashboard',
  },
]

function OrgOnboarding({
  org,
  replay,
  onClose,
}: {
  org: OrgAccount
  replay: boolean
  onClose: () => void
}) {
  const { updateOrgProfile } = useTeacher()
  const [step, setStep] = useState(() => Math.min(stepByOrg.get(org.id) ?? 0, STEPS.length - 1))
  // The role question is asked once per org per session — replaying setup to
  // look at it again should not re-ask who you are.
  const [askRole, setAskRole] = useState(() => !replay && !roleAsked.has(org.id))

  const [name, setName] = useState(org.org.name)
  const [handle, setHandle] = useState(org.org.handle.replace(/^@/, ''))
  const [bio, setBio] = useState(org.org.bio ?? '')
  const [logo, setLogo] = useState(org.org.logo ?? '')
  const [banner, setBanner] = useState(org.org.banner ?? '')
  const [color, setColor] = useState(org.org.color)

  const originalHandle = org.org.handle.replace(/^@/, '')
  const handleState = useHandleCheck(handle, org.id, handle === originalHandle)

  const draft: EventOrg = {
    ...org.org,
    name: name.trim() || org.org.name,
    handle: `@${handle}`,
    bio,
    logo: logo.trim() || undefined,
    banner: banner.trim() || undefined,
    color,
  }

  const go = (n: number) => {
    stepByOrg.set(org.id, n)
    setStep(n)
  }
  const advance = () => go(Math.min(step + 1, STEPS.length - 1))

  const s = STEPS[step]
  const last = step === STEPS.length - 1
  /* The two things setup refuses to move past, both on the handle step: one
     somebody else has, and one too short to be legal. Under three characters
     the check does not even run — nothing is asked of the server — so the
     button has to know the rule as well. */
  const handleTooShort = handle.trim().length < 3
  const blocked = s.id === 'handle' && (handleState.kind === 'taken' || handleTooShort)

  function primary() {
    if (last) {
      onClose()
      return
    }
    if (s.id === 'handle') {
      updateOrgProfile({ name: draft.name, handle: draft.handle })
    } else if (s.id === 'profile') {
      updateOrgProfile({
        bio: bio.trim(),
        logo: logo.trim() || undefined,
        banner: banner.trim() || undefined,
        color,
      })
    }
    advance()
  }

  return createPortal(
    // OPAQUE FROM THE FIRST FRAME. The fade used to be on this layer, so for
    // its first frames the page underneath showed straight through — the
    // dashboard "flashed" before setup. Only the contents fade now.
    <div className="fixed inset-0 z-[80] bg-canvas">
    <div className="ct-animate-fade relative isolate flex size-full">
      {/* Grid as a background layer, not on this container: its radial mask
          applies to every descendant and would hold the whole wizard at ≤50%
          opacity. */}
      <div className="ct-grid-bg pointer-events-none absolute inset-0 -z-10" aria-hidden />

      <aside className="hidden w-[300px] shrink-0 flex-col border-r border-border bg-surface/40 p-5 lg:flex">
        <div className="flex items-center gap-2.5">
          <OrgLogo org={draft} className="size-10" rounded="rounded-xl" textClass="text-[14px]" />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-fg">{draft.name}</p>
            <p className="truncate text-[11.5px] text-subtle">{draft.handle}</p>
          </div>
        </div>

        <ol className="mt-7 flex flex-col gap-1">
          {STEPS.map((def, i) => {
            const done = def.isDone?.(org) ?? false
            const current = !askRole && i === step
            return (
              <li key={def.id}>
                <button
                  type="button"
                  disabled={askRole}
                  onClick={() => go(i)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors duration-150',
                    current ? 'bg-accent-soft' : 'hover:bg-surface-2/60',
                    askRole && 'opacity-45',
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
                    <span
                      className={cn(
                        'block text-[13px] font-medium',
                        current ? 'text-fg' : 'text-muted',
                      )}
                    >
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

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {/* Mobile progress. The rail is a desktop affordance; on a phone the
            same information is a bar and a count, and Skip has to stay
            reachable without it. */}
        <div className="flex items-center gap-4 px-5 pt-[calc(1rem+env(safe-area-inset-top))] lg:hidden">
          <div className="flex flex-1 gap-1.5">
            {STEPS.map((def, i) => (
              <span
                key={def.id}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors duration-300',
                  !askRole && i <= step ? 'bg-accent' : 'bg-surface-2',
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
          {askRole ? (
            <div className="ct-animate-pop w-full max-w-md">
              <RoleGate
                org={org}
                onDone={() => {
                  roleAsked.add(org.id)
                  setAskRole(false)
                }}
                onSkip={onClose}
              />
            </div>
          ) : (
            <div key={s.id} className="ct-animate-pop w-full max-w-md">
              {s.id === 'welcome' && <Pillars />}

              <h1
                className={cn(
                  'font-display text-[25px] leading-tight font-semibold text-fg',
                  s.id === 'welcome' && 'mt-6',
                )}
              >
                {s.title}
              </h1>
              {s.body && <p className="mt-2.5 text-[14.5px] leading-relaxed text-muted">{s.body}</p>}

              {s.id === 'handle' && (
                <HandleStep
                  org={org}
                  name={name}
                  setName={setName}
                  handle={handle}
                  setHandle={setHandle}
                  state={handleState}
                />
              )}
              {s.id === 'profile' && (
                <ProfileStep
                  draft={draft}
                  bio={bio}
                  setBio={setBio}
                  logo={logo}
                  setLogo={setLogo}
                  banner={banner}
                  setBanner={setBanner}
                  color={color}
                  setColor={setColor}
                />
              )}
              {s.id === 'event' && (
                <>
                  <TutorialHint id="first-post" className="mb-3" />
                  <EventStep org={org} onCreated={() => undefined} />
                </>
              )}
              {s.id === 'team' && (
                <>
                  <TutorialHint id="roles" className="mb-3" />
                  <TeamStep org={org} />
                </>
              )}
              {last && <NextUp approved={org.status === 'approved'} />}

              <div className="mt-7 flex flex-wrap items-center gap-3">
                {step > 0 && (
                  <button
                    type="button"
                    onClick={() => go(Math.max(step - 1, 0))}
                    aria-label="Back"
                    className="grid size-11 place-items-center rounded-xl border border-border text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                  >
                    <ArrowLeft size={17} aria-hidden />
                  </button>
                )}
                <Button size="lg" disabled={blocked} onClick={primary}>
                  {s.primaryLabel}
                </Button>
                {!last && s.id !== 'welcome' && (
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
          )}
        </div>
      </div>
    </div>
    </div>,
    document.body,
  )
}
