import { useState } from 'react'
import {
  AlertCircle,
  AtSign,
  BarChart3,
  CalendarPlus,
  Check,
  CircleCheck,
  Copy,
  Crown,
  Loader2,
  Mail,
  Send,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import type { OrgAccount } from '@/data/teacher'
import type { EventOrg } from '@/data/community'
import { Button } from '@/components/ui/Button'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { ImageUploadField } from '@/components/ui/ImageUploadField'
import { BioField } from '@/components/ui/BioField'
import { DateTimePicker } from '@/components/ui/DateTimePicker'
import { cn } from '@/lib/cn'
import { ProfilePreview } from './ProfilePreview'
import { tidyHandle, type HandleState } from './handle-check'

export const FIELD =
  'w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13.5px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none'

/* ── The question before the questions ────────────────────────────────────── */

/** Jobs people actually hold on a Concordia exec. "Other" keeps the list short
 *  without making anybody pick a wrong one. */
const EXEC_ROLES = [
  'VP Internal',
  'VP External',
  'VP Communications',
  'VP Finance',
  'VP Events',
  'Executive',
  'Other',
]

/**
 * Who is holding the phone.
 *
 * IT IS ASKED FIRST AND SEPARATELY because the answer changes who ends up
 * owning the club, and that is not a detail to infer from whoever happened to
 * click the invite. In practice the person setting a club up is very often the
 * comms exec doing it for a president who is in class.
 *
 * SAYING NO DOES NOT DEMOTE ANYBODY. You keep full access either way — the
 * president is invited AS AN OWNER alongside you, because a club with one
 * owner who graduates in April is a club that loses its account.
 */
export function RoleGate({
  org,
  onDone,
  onSkip,
}: {
  org: OrgAccount
  onDone: () => void
  onSkip: () => void
}) {
  const { inviteOrgMember, setMyOrgTitle } = useTeacher()
  const [isPresident, setIsPresident] = useState<boolean | null>(null)
  const [role, setRole] = useState(EXEC_ROLES[0])
  const [other, setOther] = useState('')
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState<string | null>(null)

  const title = role === 'Other' ? other.trim() : role
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  function commit() {
    if (isPresident) {
      setMyOrgTitle('President')
      onDone()
      return
    }
    if (title) setMyOrgTitle(title)
    if (emailOk) {
      const m = inviteOrgMember({
        name: 'President',
        email: email.trim(),
        role: 'owner',
        title: 'President',
      })
      setSent(m.inviteToken ?? null)
      return
    }
    onDone()
  }

  if (sent !== null) {
    return (
      <div className="w-full max-w-md">
        <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
          <Send size={22} aria-hidden />
        </span>
        <h1 className="mt-5 font-display text-[25px] leading-tight font-semibold text-fg">
          Your president has been invited
        </h1>
        <p className="mt-2.5 text-[14.5px] leading-relaxed text-muted">
          {email.trim()} gets owner access to {org.org.name}. You keep yours. A club can have
          more than one owner, and it should.
        </p>
        <InviteLink token={sent} />
        <Button className="mt-6" size="lg" onClick={onDone}>
          Carry on setting up
        </Button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
        <Crown size={22} aria-hidden />
      </span>
      <h1 className="mt-5 font-display text-[25px] leading-tight font-semibold text-fg">
        Before we start: are you the president?
      </h1>
      <p className="mt-2.5 text-[14.5px] leading-relaxed text-muted">
        Either answer gives you full access. It only decides who else we should make an owner of{' '}
        {org.org.name}.
      </p>

      <div className="mt-5 flex flex-col gap-2">
        <Choice
          on={isPresident === true}
          title="Yes, I'm the president"
          hint="You'll be the owner."
          onClick={() => setIsPresident(true)}
        />
        <Choice
          on={isPresident === false}
          title="No, I'm setting it up for them"
          hint="We'll invite them as an owner too."
          onClick={() => setIsPresident(false)}
        />
      </div>

      {isPresident === false && (
        <div className="ct-animate-pop mt-4 flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-muted">Your role</span>
            <div className="flex flex-wrap gap-1.5">
              {EXEC_ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors duration-150',
                    role === r
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-border text-muted hover:text-fg',
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </label>
          {role === 'Other' && (
            <input
              value={other}
              onChange={(e) => setOther(e.target.value)}
              placeholder="What do you do here?"
              maxLength={40}
              className={FIELD}
            />
          )}
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-muted">
              Your president&rsquo;s email
            </span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              inputMode="email"
              placeholder="president@example.com"
              className={FIELD}
            />
            <span className="mt-1 block text-[11.5px] text-subtle">
              They get a link that makes them an owner. You can also do this later from Team.
            </span>
          </label>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button size="lg" disabled={isPresident === null} onClick={commit}>
          {isPresident === false && emailOk ? 'Invite them & continue' : 'Continue'}
        </Button>
        <button
          type="button"
          onClick={onSkip}
          className="text-[13px] font-medium text-subtle transition-colors hover:text-fg"
        >
          Skip setup
        </button>
      </div>
    </div>
  )
}

function Choice({
  on,
  title,
  hint,
  onClick,
}: {
  on: boolean
  title: string
  hint: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        'flex items-center gap-3 rounded-xl border p-3.5 text-left transition-colors duration-150',
        on ? 'border-accent bg-accent-soft' : 'border-border bg-surface hover:border-border-strong',
      )}
    >
      <span
        className={cn(
          'grid size-5 shrink-0 place-items-center rounded-full border-2',
          on ? 'border-accent bg-accent text-accent-contrast' : 'border-border-strong',
        )}
      >
        {on && <Check size={12} strokeWidth={3} aria-hidden />}
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-medium text-fg">{title}</span>
        <span className="block text-[12.5px] text-subtle">{hint}</span>
      </span>
    </button>
  )
}

/* ── 1. The handle ────────────────────────────────────────────────────────── */

/**
 * Claiming the name people will type.
 *
 * IT IS EDITABLE NOW AND DELIBERATELY AWKWARD LATER. The handle is the club's
 * address — it is in every link anybody shares — so the moment to choose it is
 * before a single one exists, which is exactly here. The old setup showed it
 * read-only because it had come from the invite, and an invite is a guess made
 * by whoever typed it into the admin console.
 */
export function HandleStep({
  org,
  name,
  setName,
  handle,
  setHandle,
  state,
}: {
  org: OrgAccount
  name: string
  setName: (v: string) => void
  handle: string
  setHandle: (v: string) => void
  /* CHECKED IN THE SHELL, not here, because the shell owns Continue — and a
     step that knows the handle is taken while the button does not is how
     somebody saves one anyway. */
  state: HandleState
}) {
  const original = org.org.handle.replace(/^@/, '')
  const bare = handle.replace(/^@/, '')

  return (
    <div className="mt-4 flex flex-col gap-3.5">
      <label className="block">
        <span className="mb-1 block text-[12px] font-medium text-muted">Club name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="Concordia Robotics Society"
          className={FIELD}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-[12px] font-medium text-muted">Handle</span>
        <div
          className={cn(
            'flex items-center rounded-lg border bg-surface-2 transition-colors duration-150 focus-within:border-accent',
            state.kind === 'taken' ? 'border-danger' : 'border-border',
          )}
        >
          <AtSign size={15} className="ml-3 shrink-0 text-subtle" aria-hidden />
          <input
            value={bare}
            onChange={(e) => setHandle(tidyHandle(e.target.value))}
            spellCheck={false}
            autoCapitalize="none"
            placeholder="concordiarobotics"
            className="w-full min-w-0 bg-transparent px-2 py-2 text-[13.5px] text-fg placeholder:text-subtle focus:outline-none"
          />
          <span className="mr-3 shrink-0">
            <HandleMark state={state} unchanged={bare === original} />
          </span>
        </div>
        <HandleNote state={state} unchanged={bare === original} bare={bare} />
      </label>
    </div>
  )
}

function HandleMark({ state, unchanged }: { state: HandleState; unchanged: boolean }) {
  if (unchanged) return null
  if (state.kind === 'checking') {
    return <Loader2 size={14} className="animate-spin text-subtle" aria-label="Checking" />
  }
  if (state.kind === 'free') return <CircleCheck size={15} className="text-accent" aria-hidden />
  if (state.kind === 'taken') return <AlertCircle size={15} className="text-danger" aria-hidden />
  return null
}

function HandleNote({
  state,
  unchanged,
  bare,
}: {
  state: HandleState
  unchanged: boolean
  bare: string
}) {
  if (state.kind === 'taken') {
    return <span className="mt-1 block text-[11.5px] text-danger">{state.why}</span>
  }
  // Said here rather than left to the save: under three characters nothing is
  // asked of the server, so this is the only place the rule can appear.
  if (bare.length > 0 && bare.length < 3) {
    return (
      <span className="mt-1 block text-[11.5px] text-danger">
        Handles need at least 3 characters.
      </span>
    )
  }
  if (bare.length === 0) {
    return (
      <span className="mt-1 block text-[11.5px] text-danger">
        Your club needs a handle. It is the address students share.
      </span>
    )
  }
  if (!unchanged && state.kind === 'free') {
    return (
      <span className="mt-1 block text-[11.5px] text-accent">
        @{bare} is yours. Links will read concordiatracker.com/…/org/{bare}
      </span>
    )
  }
  return (
    <span className="mt-1 block text-[11.5px] text-subtle">
      This is the address students share. Change it freely now. After you publish, old links stop
      working.
    </span>
  )
}

/* ── 2. The profile ───────────────────────────────────────────────────────── */

export function ProfileStep({
  draft,
  bio,
  setBio,
  logo,
  setLogo,
  banner,
  setBanner,
  color,
  setColor,
}: {
  draft: EventOrg
  bio: string
  setBio: (v: string) => void
  logo: string
  setLogo: (v: string) => void
  banner: string
  setBanner: (v: string) => void
  color: string
  setColor: (v: string) => void
}) {
  return (
    <div className="mt-4 flex flex-col gap-4">
      <ProfilePreview org={draft} />

      <BioField
        label="Profile description"
        value={bio}
        onChange={setBio}
        rows={3}
        maxLength={600}
        placeholder="What your club does, who it is for, and why somebody should follow it."
      />

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <ImageUploadField label="Logo" value={logo} onChange={setLogo} kind="logo" />
        <ImageUploadField label="Banner" value={banner} onChange={setBanner} kind="banner" />
      </div>

      <label className="block">
        <span className="mb-1 block text-[12px] font-medium text-muted">Brand colour</span>
        <ColorPicker value={color} onChange={setColor} ariaLabel="Brand colour" />
        <span className="mt-1 block text-[11.5px] text-subtle">
          Used wherever your club appears without a logo.
        </span>
      </label>
    </div>
  )
}

/* ── 3. The first event, without leaving ──────────────────────────────────── */

/**
 * A three-field draft, in the wizard.
 *
 * IT USED TO NAVIGATE to the full event editor, which ended onboarding: you
 * were dropped in a settings screen with the wizard gone and no way back to
 * the step you were on. Everything the editor can do is still there
 * afterwards; what an event needs to EXIST is a name, a time and a place.
 */
export function EventStep({ org, onCreated }: { org: OrgAccount; onCreated: () => void }) {
  const { createEvent } = useTeacher()
  const [title, setTitle] = useState('')
  const [start, setStart] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    d.setHours(18, 0, 0, 0)
    return d.toISOString()
  })
  const [location, setLocation] = useState('')
  const [saved, setSaved] = useState(false)

  if (org.events.some((e) => e.title.trim()) || saved) {
    return (
      <p className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-accent-soft px-3 py-2 text-[13px] font-medium text-accent">
        <CircleCheck size={15} aria-hidden /> Your first event is drafted.
      </p>
    )
  }

  return (
    <div className="mt-4 flex flex-col gap-3.5">
      <label className="block">
        <span className="mb-1 block text-[12px] font-medium text-muted">What is it called?</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Welcome night"
          maxLength={120}
          className={FIELD}
        />
      </label>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-muted">When</span>
          <DateTimePicker value={start} onChange={(iso) => setStart(iso ?? start)} ariaLabel="Event date and time" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-muted">Where</span>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="H 920, or a link"
            className={FIELD}
          />
        </label>
      </div>
      <div>
        <Button
          disabled={!title.trim()}
          onClick={() => {
            // ONE insert. See `createEvent` — a follow-up patch races it.
            createEvent({ title: title.trim(), start, location: location.trim() })
            setSaved(true)
            onCreated()
          }}
        >
          <CalendarPlus size={15} aria-hidden />
          Save this draft
        </Button>
        <p className="mt-2 text-[11.5px] text-subtle">
          It stays a draft you can finish in Events (description, banner, and the rest).
        </p>
      </div>
    </div>
  )
}

/* ── 4. The team, without leaving ─────────────────────────────────────────── */

export function TeamStep({ org }: { org: OrgAccount }) {
  const { inviteOrgMember } = useTeacher()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [token, setToken] = useState<string | null>(null)

  const others = org.members.filter((m) => !m.isYou)
  const ok = name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  return (
    <div className="mt-4 flex flex-col gap-3.5">
      {others.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {others.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-2.5 rounded-lg border border-border bg-surface px-3 py-2"
            >
              <Users size={14} className="shrink-0 text-subtle" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-[13px] text-fg">
                {m.name}
                {m.title ? <span className="text-subtle"> · {m.title}</span> : null}
              </span>
              <span className="shrink-0 text-[11px] text-subtle">
                {m.status === 'active' ? 'On the team' : 'Invited'}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Their name"
          className={FIELD}
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          inputMode="email"
          placeholder="their@email.com"
          className={FIELD}
        />
      </div>
      <div>
        <Button
          variant="outline"
          disabled={!ok}
          onClick={() => {
            const m = inviteOrgMember({ name: name.trim(), email: email.trim(), role: 'admin' })
            setToken(m.inviteToken ?? null)
            setName('')
            setEmail('')
          }}
        >
          <UserPlus size={15} aria-hidden />
          Create an invite link
        </Button>
      </div>
      {token && <InviteLink token={token} />}
    </div>
  )
}

/** The single-use link, with the one thing anybody does with it. Email
 *  delivery is connection-phase, so the link is handed over rather than
 *  promised. */
function InviteLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)
  const url = `${window.location.origin}/organizer/join/${token}`
  return (
    <div className="mt-3 rounded-xl border border-border bg-surface p-3">
      <p className="flex items-center gap-1.5 text-[12px] font-medium text-muted">
        <Mail size={13} aria-hidden /> Send them this link
      </p>
      <div className="mt-1.5 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-surface-2 px-2.5 py-2 font-mono text-[11.5px] text-fg">
          {url}
        </code>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void navigator.clipboard?.writeText(url)
            setCopied(true)
          }}
        >
          {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  )
}

/* ── 5. What happens next ─────────────────────────────────────────────────── */

export function NextUp({ approved }: { approved: boolean }) {
  return (
    <ul className="mt-4 space-y-2.5">
      {[
        approved
          ? 'You’re approved: your profile and events are live in Community.'
          : 'An admin reviews your club: usually quickly.',
        approved
          ? 'Post events anytime; followers get a heads-up when you do.'
          : 'Once approved, your profile and events go live in Community.',
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

/* ── The welcome visual, kept from the first version ──────────────────────── */

export function Pillars() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <PillarRow
        icon={CalendarPlus}
        title="Post events"
        sub="They appear in every student's Community feed"
      />
      <PillarRow
        icon={UserPlus}
        title="Grow a following"
        sub="Followers get a heads-up when you post"
        border
      />
      <PillarRow
        icon={BarChart3}
        title="See what worked"
        sub="Views, saves, and follows: aggregate only"
        border
      />
    </div>
  )
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
