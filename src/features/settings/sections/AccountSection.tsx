import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { useAuth } from '@/app/providers/auth'
import { Select } from '@/components/ui/Select'
import { Group, Row } from '../controls'

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
        <Row label="Major / Program" description="Your primary program of study." stacked>
          <input
            value={user.program}
            onChange={(e) => updateProfile({ program: e.target.value })}
            aria-label="Major or program"
            placeholder="e.g. Computer Science"
            className="w-full max-w-xs rounded-lg border border-border bg-canvas px-3 py-2 text-[13px] text-fg outline-none transition-colors focus:border-border-strong"
          />
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
