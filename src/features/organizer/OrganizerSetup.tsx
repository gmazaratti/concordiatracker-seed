import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Loader2, PartyPopper } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import { Button } from '@/components/ui/Button'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { ImageUploadField } from '@/components/ui/ImageUploadField'
import { BioField } from '@/components/ui/BioField'
import { OrgLogo } from '@/features/community/OrgLogo'
import { VerifiedBadge } from '@/features/community/VerifiedBadge'
import { orgSlug } from '@/data/community'
import { cn } from '@/lib/cn'

const STEPS = ['Your club', 'How it looks', 'Ready'] as const

/**
 * The first three minutes of running a club here.
 *
 * WHY IT IS NOT THE PROFILE EDITOR. That screen is a settings page: eleven
 * fields, all optional, arranged for somebody who knows what they are looking
 * for. Somebody who has just accepted an invite knows none of that, and the
 * dashboard they used to land on was a grid of empty panels about a club with
 * no description and no colour — which reads as an empty product rather than
 * as a form they have not filled in.
 *
 * THREE QUESTIONS, IN THE ORDER SOMEBODY CAN ANSWER THEM: who you are, what
 * you look like, and then what you can do now. Everything here is editable
 * afterwards in the same profile editor, so nothing is a decision they are
 * stuck with — which is why none of it is required and why Skip is visible on
 * every step. A setup nobody can get out of is a wall.
 *
 * IT SAVES AS YOU GO, per step, rather than at the end. Closing the tab on
 * step two should not throw away step one, and an organiser who wanders off
 * mid-setup comes back to a club that already has its name and its colour.
 */
export function OrganizerSetup() {
  const { currentOrg, myOrgs, orgsLoading, switchOrg, signInSelfOrg, updateOrgProfile } =
    useTeacher()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [step, setStep] = useState(0)
  const wanted = params.get('org')

  /*
   * ENTER THE PORTAL, rather than bouncing to the door.
   *
   * Arriving here means an invite was just accepted, so asking "continue as
   * …?" is asking a question that has already been answered — and the old
   * redirect fired on the FIRST render anyway, before the org list had
   * loaded, so it always bounced.
   *
   * `?org=` is the club that was just accepted. An admin has EVERY org in
   * `myOrgs`, so without it the portal opened on whichever one sorted first —
   * which is how accepting an invite landed on Office of the President.
   */
  useEffect(() => {
    if (orgsLoading || myOrgs.length === 0) return
    if (wanted && myOrgs.some((o) => o.id === wanted)) {
      if (currentOrg?.id !== wanted) switchOrg(wanted)
      return
    }
    if (!currentOrg) signInSelfOrg()
  }, [orgsLoading, myOrgs, wanted, currentOrg, switchOrg, signInSelfOrg])

  if (orgsLoading) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Loader2 className="size-6 animate-spin text-accent" aria-label="Loading" />
      </div>
    )
  }
  // Genuinely none — not "not yet". The sign-in screen is the right answer.
  if (!currentOrg) {
    if (myOrgs.length === 0) return <Navigate to="/organizer" replace />
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Loader2 className="size-6 animate-spin text-accent" aria-label="Opening" />
      </div>
    )
  }
  const org = currentOrg.org

  const done = () => navigate('/organizer', { replace: true })

  return (
    <div className="mx-auto w-full max-w-xl px-5 py-8">
      <ol className="mb-6 flex items-center gap-2" aria-label="Setup progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                'grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold transition-colors duration-200',
                i < step
                  ? 'bg-accent text-accent-contrast'
                  : i === step
                    ? 'bg-accent-soft text-accent ring-1 ring-accent'
                    : 'bg-surface-2 text-subtle',
              )}
            >
              {i < step ? <Check size={13} aria-hidden /> : i + 1}
            </span>
            <span
              className={cn(
                'truncate text-[12px]',
                i === step ? 'font-medium text-fg' : 'text-subtle',
              )}
            >
              {s}
            </span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-border" aria-hidden />}
          </li>
        ))}
      </ol>

      {step === 0 && <WhoStep org={org} save={updateOrgProfile} onNext={() => setStep(1)} onSkip={done} />}
      {step === 1 && (
        <LookStep
          org={org}
          save={updateOrgProfile}
          onBack={() => setStep(0)}
          onNext={() => setStep(2)}
          onSkip={done}
        />
      )}
      {step === 2 && <ReadyStep org={org} pending={currentOrg.status !== 'approved'} onDone={done} />}
    </div>
  )
}

type Org = NonNullable<ReturnType<typeof useTeacher>['currentOrg']>['org']
type Save = (patch: Partial<Org>) => void

function Card({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <h1 className="font-display text-[20px] leading-tight font-semibold text-fg">{title}</h1>
      <p className="mt-1 text-[13px] text-subtle">{hint}</p>
      <div className="mt-4 flex flex-col gap-3.5">{children}</div>
    </div>
  )
}

function Nav({
  onBack,
  onNext,
  onSkip,
  nextLabel = 'Continue',
}: {
  onBack?: () => void
  onNext: () => void
  onSkip: () => void
  nextLabel?: string
}) {
  return (
    <div className="mt-5 flex items-center gap-2">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-[13px] font-medium text-muted transition-colors duration-150 hover:text-fg"
        >
          <ArrowLeft size={15} aria-hidden />
          Back
        </button>
      )}
      <button
        type="button"
        onClick={onSkip}
        className="ml-auto rounded-lg px-2 py-2 text-[13px] font-medium text-subtle transition-colors duration-150 hover:text-fg"
      >
        Skip for now
      </button>
      <Button onClick={onNext}>
        {nextLabel}
        <ArrowRight size={15} aria-hidden />
      </Button>
    </div>
  )
}

function WhoStep({ org, save, onNext, onSkip }: { org: Org; save: Save; onNext: () => void; onSkip: () => void }) {
  const [name, setName] = useState(org.name)
  const [bio, setBio] = useState(org.bio ?? '')

  return (
    <>
      <Card
        title="Let's set up your club"
        hint="This is what students see when they find you. All of it is editable later."
      >
        <label className="block">
          <span className="text-[12px] font-medium text-subtle">Club name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13.5px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
          />
        </label>
        <div>
          <span className="text-[12px] font-medium text-subtle">Handle</span>
          {/* SHOWN, NOT EDITABLE HERE. It came from the invite and it is what
              the link people were sent points at; changing it during setup
              would quietly break a URL somebody has already shared. The
              profile editor can change it later, deliberately. */}
          <p className="mt-1 rounded-lg border border-border bg-surface-2/50 px-3 py-2 text-[13.5px] text-subtle">
            {org.handle}
          </p>
        </div>
        <BioField
          label="What is your club about?"
          value={bio}
          onChange={setBio}
          rows={3}
          maxLength={600}
          placeholder="One or two lines. Select words to link them."
        />
      </Card>
      <Nav
        onSkip={onSkip}
        onNext={() => {
          save({ name: name.trim() || org.name, bio: bio.trim() })
          onNext()
        }}
      />
    </>
  )
}

function LookStep({
  org,
  save,
  onBack,
  onNext,
  onSkip,
}: {
  org: Org
  save: Save
  onBack: () => void
  onNext: () => void
  onSkip: () => void
}) {
  const [color, setColor] = useState(org.color)
  const [logo, setLogo] = useState(org.logo ?? '')
  const [banner, setBanner] = useState(org.banner ?? '')
  const preview = { ...org, color, logo: logo || undefined, banner: banner || undefined }

  return (
    <>
      <Card title="How it looks" hint="Your colour is used wherever your club appears without a logo.">
        {/* THE PREVIEW IS THE POINT of this step — the fields underneath mean
            nothing without it, and a colour picked against a swatch is a
            different decision from one picked against your own name. */}
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="h-16" style={{ backgroundColor: color }}>
            {banner && (
              <img
                src={banner}
                alt=""
                className="size-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            )}
          </div>
          <div className="flex items-end gap-3 px-3 pb-3">
            <OrgLogo org={preview} className="-mt-6 size-14 ring-4 ring-surface" rounded="rounded-full" />
            <span className="min-w-0 pb-1">
              <span className="flex items-center gap-1">
                <span className="truncate text-[14px] font-semibold text-fg">{org.name}</span>
                <VerifiedBadge size={13} />
              </span>
              <span className="block truncate text-[12px] text-subtle">{org.handle}</span>
            </span>
          </div>
        </div>

        <label className="block">
          <span className="text-[12px] font-medium text-subtle">Brand colour</span>
          <div className="mt-1">
            <ColorPicker value={color} onChange={setColor} ariaLabel="Brand colour" />
          </div>
        </label>
        <ImageUploadField label="Logo" value={logo} onChange={setLogo} kind="logo" />
        <ImageUploadField label="Banner" value={banner} onChange={setBanner} kind="banner" />
      </Card>
      <Nav
        onBack={onBack}
        onSkip={onSkip}
        onNext={() => {
          save({ color, logo: logo.trim() || undefined, banner: banner.trim() || undefined })
          onNext()
        }}
      />
    </>
  )
}

function ReadyStep({ org, pending, onDone }: { org: Org; pending: boolean; onDone: () => void }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
        <PartyPopper size={22} aria-hidden />
      </span>
      <h1 className="mt-3 font-display text-[20px] font-semibold text-fg">
        {org.name} is set up
      </h1>
      {/* SAID PLAINLY, because it is the one thing that will surprise them:
          everything works and nothing is public yet. */}
      <p className="mt-1 text-[13.5px] text-subtle">
        {pending
          ? 'You can build everything now. Your profile and events go live on Community once an admin approves the club.'
          : 'Your profile is live on Community.'}
      </p>
      <ul className="mt-4 space-y-2 text-left">
        {[
          ['Post your first event', 'It shows up on the Events tab with your name on it.'],
          ['Invite your team', 'Anyone you add can post as the club — nobody shares a password.'],
          ['Answer students', 'Messages to the club land in one inbox, not in your DMs.'],
        ].map(([title, hint]) => (
          <li key={title} className="flex items-start gap-2.5 rounded-xl bg-surface-2/50 px-3 py-2.5">
            <Check size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden />
            <span>
              <span className="block text-[13.5px] font-medium text-fg">{title}</span>
              <span className="block text-[12px] text-subtle">{hint}</span>
            </span>
          </li>
        ))}
      </ul>
      <Button className="mt-5 w-full" onClick={onDone}>
        Go to my dashboard
        <ArrowRight size={15} aria-hidden />
      </Button>
      <a
        href={`/app/community/org/${orgSlug(org)}`}
        className="mt-2 block text-[12px] font-medium text-accent hover:underline"
      >
        See my public profile
      </a>
    </div>
  )
}
