import { useEffect, useState } from 'react'
import { Check, Loader2, Trash2 } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { useAuth } from '@/app/providers/auth'
import { supabase } from '@/lib/supabase'
import { HANDLE_RE, useHandleCheck } from '@/features/onboarding/handle'
import { Select } from '@/components/ui/Select'
import { ProgramPicker, type ProgramSelection } from '@/components/ui/ProgramPicker'
import { programById } from '@/data/programs'
import { Group, Row } from '../controls'

const COOLDOWN_MS = 14 * 86_400_000
const DATE_FMT = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

/** Cooldown state from the last-changed timestamp. Module-level (not in render)
 * so reading the clock is allowed — like the app's other date helpers. */
function cooldownState(changedAt: string | null | undefined): {
  locked: boolean
  nextAt: Date | null
  daysLeft: number
} {
  if (!changedAt) return { locked: false, nextAt: null, daysLeft: 0 }
  const nextAt = new Date(+new Date(changedAt) + COOLDOWN_MS)
  const ms = nextAt.getTime() - Date.now()
  return { locked: ms > 0, nextAt, daysLeft: Math.max(1, Math.ceil(ms / 86_400_000)) }
}

/** Account: a Google-synced identity (sign-in is Google-only, so email + photo
 * are not editable here) plus a danger zone. All in-memory / mocked. */
const SCHOOLS = [
  'Gina Cody School of Engineering & Computer Science',
  'John Molson School of Business',
  'Faculty of Arts and Science',
  'Faculty of Fine Arts',
]

export function AccountSection() {
  const { user, updateProfile } = useAppData()
  const { signOut } = useAuth()

  return (
    <div>
      <div className="mb-6 flex items-center gap-4 rounded-xl border border-border bg-surface-2/25 px-4 py-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-accent-soft text-[18px] font-semibold text-accent">
          {user.initials}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-medium text-fg">{user.name}</p>
          <p className="truncate text-[12px] text-subtle">{user.email}</p>
          <div className="mt-1.5">
            <GoogleBadge />
          </div>
        </div>
      </div>

      <Group label="Profile">
        <Row label="Display name" description="Shown across your dashboard." stacked>
          <input
            value={user.name}
            onChange={(e) => updateProfile({ name: e.target.value })}
            aria-label="Display name"
            className="w-full max-w-xs rounded-lg border border-border bg-canvas px-3 py-2 text-[13px] text-fg outline-none transition-colors focus:border-border-strong"
          />
        </Row>
        <Row
          label="Handle"
          description="How you show up on feedback posts. Changeable once every 14 days."
          stacked
        >
          <HandleEditor />
        </Row>
        <Row label="Email address" description="Connected through Google — not editable here.">
          <span className="text-[13px] text-muted">{user.email}</span>
        </Row>
        <Row label="School / Faculty" description="Used to tailor your dashboard and Community feed." stacked>
          <Select
            ariaLabel="School or faculty"
            value={user.school}
            onChange={(v) => updateProfile({ school: v })}
            options={SCHOOLS}
            className="max-w-sm"
          />
        </Row>
        <Row label="Major / Program" description="Search Concordia's program list — or choose Other." stacked>
          <ProgramField />
        </Row>
        <Row label="Profile photo" description="Synced from your Google account.">
          <span className="grid size-9 place-items-center rounded-full bg-accent-soft text-[12px] font-semibold text-accent">
            {user.initials}
          </span>
        </Row>
      </Group>

      <Group label="Account">
        <Row label="Sign out" description="End your session on this device.">
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            Sign out
          </button>
        </Row>
        <DeleteAccountRow />
      </Group>
    </div>
  )
}

/** Program field — the searchable canonical picker. Pre-selects the user's
 * current program; reads `program_id` defensively (degrades if not migrated). */
function ProgramField() {
  const { user, setProgram } = useAppData()
  const { user: authUser } = useAuth()
  const [sel, setSel] = useState<ProgramSelection | null>(
    user.program ? { id: '', name: user.program } : null,
  )

  useEffect(() => {
    if (!authUser) return
    let active = true
    void supabase
      .from('user_profile')
      .select('program_id')
      .eq('user_id', authUser.id)
      .maybeSingle()
      .then(({ data }) => {
        const pid = (data as { program_id?: string } | null)?.program_id
        if (active && pid) setSel({ id: pid, name: programById(pid)?.name ?? user.program })
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id])

  return (
    <ProgramPicker
      value={sel}
      size="sm"
      onChange={(s) => {
        setSel(s)
        setProgram(s)
      }}
    />
  )
}

/** Edit the @handle, with the 14-day cooldown. The DB trigger is authoritative;
 * this reads `handle_changed_at` (defensively — degrades if the column isn't
 * there yet) to show the lock state, and surfaces the live availability check. */
function HandleEditor() {
  const { user, changeHandle } = useAppData()
  const { user: authUser } = useAuth()
  const current = user.handle ?? ''

  const [changedAt, setChangedAt] = useState<string | null | undefined>(undefined) // undefined = loading
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(current)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const status = useHandleCheck(value)

  // Defensive read of the cooldown timestamp (null if column absent / never changed).
  useEffect(() => {
    if (!authUser) return
    let active = true
    void supabase
      .from('user_profile')
      .select('handle_changed_at')
      .eq('user_id', authUser.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setChangedAt((data as { handle_changed_at?: string } | null)?.handle_changed_at ?? null)
      })
    return () => {
      active = false
    }
  }, [authUser])

  const { locked, nextAt, daysLeft } = cooldownState(changedAt)
  const valid = HANDLE_RE.test(value)
  const changed = value.trim().toLowerCase() !== current

  const save = async () => {
    setError('')
    setSaving(true)
    const { error: err } = await changeHandle(value)
    setSaving(false)
    if (err === 'taken') return setError(`@${value} is taken — try another.`)
    if (err === 'cooldown') return setError('You can only change your handle once every 14 days.')
    if (err === 'invalid') return setError('3–20 lowercase letters, numbers, or underscores.')
    if (err) return setError('Couldn’t save — please try again.')
    setChangedAt(new Date().toISOString())
    setEditing(false)
  }

  if (!current && !editing) {
    return <span className="text-[13px] text-subtle">No handle set yet.</span>
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[13px] font-medium text-fg">@{current}</span>
        {locked ? (
          <span className="text-[12px] text-subtle">
            Changeable again {DATE_FMT.format(nextAt!)} ({daysLeft} day{daysLeft === 1 ? '' : 's'})
          </span>
        ) : (
          <button
            type="button"
            onClick={() => {
              setValue(current)
              setError('')
              setEditing(true)
            }}
            className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            Change
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-xs">
      <div className="flex items-center rounded-lg border border-border bg-canvas px-3 py-2 focus-within:border-border-strong">
        <span className="text-[13px] text-subtle">@</span>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))}
          aria-label="Handle"
          className="ml-0.5 w-full bg-transparent text-[13px] text-fg outline-none"
        />
        {changed && valid && status === 'free' && <Check size={14} className="shrink-0 text-success" aria-hidden />}
      </div>

      {error ? (
        <p className="mt-1.5 text-[12px] text-danger">{error}</p>
      ) : value.length > 0 && !valid ? (
        <p className="mt-1.5 text-[12px] text-warning">At least 3 characters.</p>
      ) : changed && valid && status === 'taken' ? (
        <p className="mt-1.5 text-[12px] text-danger">@{value} is taken.</p>
      ) : changed && valid && status === 'free' ? (
        <p className="mt-1.5 text-[12px] text-success">@{value} is available.</p>
      ) : (
        <p className="mt-1.5 text-[12px] text-subtle">You won’t be able to change it again for 14 days.</p>
      )}

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={saving || !valid || !changed || status === 'taken'}
          onClick={() => void save()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving && <Loader2 size={13} className="animate-spin" aria-hidden />}
          Save
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false)
            setError('')
          }}
          className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-muted transition-colors hover:text-fg"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

/** Privacy policy references a "Delete Account" button here. Mocked — there is no
 * backend, so it just demonstrates the confirm flow. */
function DeleteAccountRow() {
  const [confirming, setConfirming] = useState(false)
  const [done, setDone] = useState(false)

  return (
    <div className="px-4 py-3.5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-danger">
            <Trash2 size={14} aria-hidden />
            Delete account
          </p>
          <p className="mt-0.5 text-[12px] text-subtle">
            Permanently removes your courses, grades, notifications, and profile.
          </p>
        </div>
        {!confirming && !done && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="shrink-0 rounded-lg border border-danger/40 px-3 py-1.5 text-[12px] font-medium text-danger transition-colors hover:bg-danger/10"
          >
            Delete
          </button>
        )}
      </div>

      {confirming && !done && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2.5">
          <span className="text-[12px] text-fg">This can’t be undone. Are you sure?</span>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-md px-2.5 py-1 text-[12px] font-medium text-muted hover:text-fg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false)
                setDone(true)
              }}
              className="rounded-md bg-danger px-2.5 py-1 text-[12px] font-medium text-white"
            >
              Delete account
            </button>
          </div>
        </div>
      )}

      {done && (
        <p className="mt-3 rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-[12px] text-subtle">
          Account deletion is mocked in this seed — no backend to delete from.
        </p>
      )}
    </div>
  )
}

/** Google's 4-color "G", inline so we don't pull an icon dependency. */
function GoogleBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-canvas px-2 py-0.5 text-[11px] font-medium text-muted">
      <svg viewBox="0 0 48 48" className="size-3.5" aria-hidden>
        <path fill="#4285F4" d="M45 24c0-1.6-.1-3.1-.4-4.5H24v9h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1C42.7 36.4 45 30.7 45 24z" />
        <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8.1 41.1 15.4 46 24 46z" />
        <path fill="#FBBC05" d="M11.8 28.2c-.4-1.3-.7-2.7-.7-4.2s.3-2.9.7-4.2v-5.7H4.5C3 17.1 2 20.4 2 24s1 6.9 2.5 9.9l7.3-5.7z" />
        <path fill="#EA4335" d="M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.2 29.9 2 24 2 15.4 2 8.1 6.9 4.5 14.1l7.3 5.7c1.7-5.2 6.5-9 12.2-9z" />
      </svg>
      Connected with Google
    </span>
  )
}
