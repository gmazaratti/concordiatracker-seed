import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Check, Copy, Loader2, Lock, Mail, Search, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { FallbackImg } from '@/components/ui/FallbackImg'
import { initialsOf } from '@/lib/initials'
import type { OrgRoleDef } from '@/lib/org-roles'
import { findInvitees, inviteByEmail, inviteUser, type Invitee } from '@/lib/org-invites'
import { cn } from '@/lib/cn'

const field =
  'w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none'

type Mode = 'user' | 'email'

type Done =
  | { kind: 'notified'; name: string }
  | { kind: 'link'; token: string }

/**
 * Invite a teammate — two routes, side by side.
 *
 * SOMEBODY ALREADY ON THE SITE is found by name, handle or their exact email,
 * and the invite reaches their notifications to accept in the app: they have
 * an account and a bell, so building them a link to paste is the wrong funnel.
 *
 * AN ADDRESS gets the link, as before. When that address turns out to belong to
 * an account the server invites the account instead (it will not store a
 * second, email-only invite for somebody it can simply ask), and the result
 * says so rather than showing a link nobody needs.
 *
 * `demo` keeps the old in-memory email path for the sample club, which has no
 * rows for the database to check.
 */
export function InviteForm({
  orgId,
  roles,
  mine,
  demo,
  onDemoInvite,
  onInvited,
}: {
  orgId: string
  roles: OrgRoleDef[]
  mine: number
  demo: boolean
  onDemoInvite: (input: { name: string; email: string }, role: OrgRoleDef) => string | null
  onInvited: () => void
}) {
  // Only roles strictly below yours: the database refuses anything else.
  const grantable = useMemo(() => roles.filter((r) => r.position < mine && !r.isOwner), [roles, mine])
  const [mode, setMode] = useState<Mode>(demo ? 'email' : 'user')
  const [roleId, setRoleId] = useState('')
  const [done, setDone] = useState<Done | null>(null)
  const [error, setError] = useState<string | null>(null)
  const chosen = grantable.find((r) => r.id === roleId) ?? grantable.find((r) => r.systemKey === 'member') ?? grantable.at(-1)

  if (grantable.length === 0) return null

  const roleSelect = (
    <label className="sm:w-44">
      <span className="mb-1 block text-[12px] font-medium text-muted">Role</span>
      <Select
        ariaLabel="Role"
        value={chosen?.id ?? ''}
        onChange={setRoleId}
        options={grantable.map((r) => ({ value: r.id, label: r.name }))}
      />
    </label>
  )

  const switchTo = (m: Mode) => {
    setMode(m)
    setDone(null)
    setError(null)
  }

  return (
    <div className="mt-5 rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-fg">
          <UserPlus size={15} className="text-accent" aria-hidden />
          Invite a teammate
        </h2>
        {!demo && (
          <div role="tablist" aria-label="How to invite" className="ml-auto flex rounded-lg bg-surface-2 p-0.5">
            {(
              [
                ['user', 'On the site', Search],
                ['email', 'By email', Mail],
              ] as const
            ).map(([m, label, Icon]) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => switchTo(m)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors duration-150',
                  mode === m ? 'bg-surface text-fg shadow-sm' : 'text-subtle hover:text-fg',
                )}
              >
                <Icon size={13} aria-hidden />
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {mode === 'user' && !demo ? (
        <UserSearch
          orgId={orgId}
          roleSelect={roleSelect}
          onPick={async (p) => {
            if (!chosen) return
            setError(null)
            try {
              await inviteUser(orgId, p.userId, chosen.id)
              setDone({ kind: 'notified', name: p.name || `@${p.handle}` })
              onInvited()
            } catch (e) {
              setError((e as Error).message)
            }
          }}
        />
      ) : (
        <EmailInvite
          roleSelect={roleSelect}
          disabled={!chosen}
          onSubmit={async (input) => {
            if (!chosen) return
            setError(null)
            if (demo) {
              const token = onDemoInvite(input, chosen)
              if (token) setDone({ kind: 'link', token })
              return
            }
            try {
              const r = await inviteByEmail(orgId, input.name, input.email, chosen.id)
              setDone(r.existingUser ? { kind: 'notified', name: r.name } : { kind: 'link', token: r.token })
              onInvited()
            } catch (e) {
              setError((e as Error).message)
            }
          }}
        />
      )}

      {error && (
        <p role="alert" className="mt-2.5 text-[12px] text-danger">
          {error}
        </p>
      )}
      {done?.kind === 'notified' && (
        <p role="status" className="mt-3 flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-[12px] text-success">
          <Bell size={14} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            <strong className="font-semibold">{done.name}</strong> is already on ConcordiaTracker, so the invite went to
            their notifications. They join the team when they accept.
          </span>
        </p>
      )}
      {done?.kind === 'link' && <InviteLink token={done.token} />}

      <p className="mt-2.5 flex items-start gap-1.5 text-[11px] text-subtle">
        <Lock size={12} className="mt-0.5 shrink-0" aria-hidden />
        {mode === 'user' && !demo
          ? 'You can invite people to any role below your own. They see it in their notifications and can accept or decline.'
          : 'You can invite people to any role below your own. Invite emails are not sent yet: share the link directly.'}
      </p>
    </div>
  )
}

function UserSearch({
  orgId,
  roleSelect,
  onPick,
}: {
  orgId: string
  roleSelect: React.ReactNode
  onPick: (p: Invitee) => Promise<void>
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Invitee[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const query = q.trim()
  const searchable = query.replace(/^@/, '').length >= 2

  useEffect(() => {
    if (!searchable) return
    let active = true
    const t = setTimeout(() => {
      findInvitees(orgId, query)
        .then((r) => active && setResults(r))
        .catch(() => active && setResults([]))
    }, 220)
    return () => {
      active = false
      clearTimeout(t)
    }
  }, [orgId, query, searchable, reload])

  const shown = searchable ? results : null

  return (
    <div className="mt-3">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className="mb-1 block text-[12px] font-medium text-muted">Name, @handle or email</span>
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setResults(null)
            }}
            placeholder="Search people on ConcordiaTracker"
            className={field}
            autoComplete="off"
          />
        </label>
        {roleSelect}
      </div>

      {shown === null && searchable && (
        <p className="mt-3 flex items-center gap-2 text-[12px] text-subtle">
          <Loader2 size={13} className="animate-spin" aria-hidden /> Searching…
        </p>
      )}
      {shown && shown.length === 0 && (
        <p className="mt-3 text-[12px] text-subtle">
          Nobody matches “{query}”. Emails only match exactly, so try inviting them by email instead.
        </p>
      )}
      {shown && shown.length > 0 && (
        <ul className="mt-3 overflow-hidden rounded-lg border border-border">
          {shown.map((p, i) => (
            <li key={p.userId} className={cn('flex items-center gap-3 px-3 py-2', i > 0 && 'border-t border-border/70')}>
              <span className="relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-2 text-[11px] font-semibold text-muted">
                {initialsOf(p.name, p.handle)}
                <FallbackImg src={p.avatarUrl} className="absolute inset-0 size-full object-cover" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-fg">{p.name || `@${p.handle}`}</span>
                <span className="block truncate text-[11.5px] text-subtle">
                  {p.handle ? `@${p.handle}` : 'No handle yet'}
                  {p.byEmail && ' · matches that email'}
                </span>
              </span>
              {p.state ? (
                <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-subtle">
                  {p.state === 'member' ? 'On the team' : 'Invited'}
                </span>
              ) : (
                <Button
                  size="sm"
                  disabled={busy !== null}
                  onClick={async () => {
                    setBusy(p.userId)
                    await onPick(p)
                    setBusy(null)
                    setReload((n) => n + 1)
                  }}
                >
                  {busy === p.userId ? 'Inviting…' : 'Invite'}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function EmailInvite({
  roleSelect,
  disabled,
  onSubmit,
}: {
  roleSelect: React.ReactNode
  disabled: boolean
  onSubmit: (input: { name: string; email: string }) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <div className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:items-end">
      <label className="flex-1">
        <span className="mb-1 block text-[12px] font-medium text-muted">Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={field} />
      </label>
      <label className="flex-1">
        <span className="mb-1 block text-[12px] font-medium text-muted">Email</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="them@club.ca" className={field} />
      </label>
      {roleSelect}
      <Button
        disabled={disabled || busy || !name.trim() || !email.trim()}
        onClick={async () => {
          setBusy(true)
          await onSubmit({ name: name.trim(), email: email.trim() })
          setBusy(false)
          setName('')
          setEmail('')
        }}
      >
        {busy ? 'Creating…' : 'Create invite'}
      </Button>
    </div>
  )
}

function InviteLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)
  const path = `/organizer/join/${token}`
  return (
    <div className="mt-3 rounded-lg border border-success/30 bg-success/10 p-3">
      <p className="text-[12px] font-medium text-success">Invite link created.</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded bg-surface-2 px-2 py-1 text-[11px] text-muted">{path}</code>
        <button
          type="button"
          onClick={() =>
            navigator.clipboard?.writeText(`${window.location.origin}${path}`).then(
              () => setCopied(true),
              () => setCopied(false),
            )
          }
          className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[12px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
        >
          {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <Link to={path} className="text-[12px] font-medium text-accent hover:underline">
          Open
        </Link>
      </div>
    </div>
  )
}
