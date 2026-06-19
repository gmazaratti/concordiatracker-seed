import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import { useAuth } from '@/app/providers/auth'
import { Button } from '@/components/ui/Button'

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'OG'

const suggestHandle = (name: string) =>
  '@' + (name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'org')

/** Organizer portal entry. The primary path is YOUR own org (persistent): continue
 * to it if you have one, or create one. The email + demo paths are for the seeds. */
export function OrganizerSignIn() {
  const { myOrg, createOrg, signInSelfOrg, signInDemoOrg } = useTeacher()
  const { user: authUser, signInWithGoogle } = useAuth()
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [busy, setBusy] = useState(false)
  const [createError, setCreateError] = useState('')

  async function create() {
    if (!name.trim() || busy) return
    setBusy(true)
    setCreateError('')
    const h = (handle.trim() || suggestHandle(name)).replace(/^@?/, '@')
    const id = await createOrg({ name: name.trim(), handle: h, glyph: initials(name), color: '#5b9cf6' })
    setBusy(false)
    if (!id) setCreateError(`Couldn't create it — the handle ${h} may be taken. Try another.`)
    // On success, createOrg signs you into the portal (the dashboard renders).
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-5 py-16">
      <div className="rounded-2xl border border-border bg-surface p-6">
        <span className="grid size-11 place-items-center rounded-xl bg-accent-soft text-accent">
          <CalendarDays size={22} aria-hidden />
        </span>
        <h1 className="mt-4 font-display text-[22px] leading-tight font-semibold text-fg">
          Organizer portal
        </h1>
        <p className="mt-1 text-[13px] text-subtle">
          Post events to the Community feed and manage your org's profile.
        </p>

        {!authUser ? (
          <>
            <Button className="mt-5 w-full" onClick={() => void signInWithGoogle()}>
              Sign in with Google
            </Button>
            <p className="mt-1.5 text-center text-[12px] text-subtle">
              Sign in to create and manage your real org.
            </p>
          </>
        ) : myOrg ? (
          <>
            <Button className="mt-5 w-full" onClick={signInSelfOrg}>
              Continue as {myOrg.org.name}
            </Button>
            <p className="mt-1.5 text-center text-[12px] text-subtle">Your org and its events are saved.</p>
          </>
        ) : (
          <>
            <p className="mt-5 text-[12px] font-medium text-muted">Create your organization</p>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setCreateError('')
              }}
              placeholder="Organization name (e.g. Robotics Club)"
              aria-label="Organization name"
              className="mt-1.5 w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[14px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
            />
            <input
              value={handle}
              onChange={(e) => {
                setHandle(e.target.value)
                setCreateError('')
              }}
              placeholder={name ? suggestHandle(name) : '@handle'}
              aria-label="Org handle"
              className="mt-2 w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[14px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
            />
            {createError && <p className="mt-1.5 text-[12px] text-danger">{createError}</p>}
            <Button className="mt-3 w-full" disabled={!name.trim() || busy} onClick={create}>
              {busy ? 'Creating…' : 'Create & open dashboard'}
            </Button>
            <p className="mt-1.5 text-center text-[12px] text-subtle">
              You can add a logo, banner, and links after.
            </p>
          </>
        )}

        <div className="mt-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-[11px] text-subtle uppercase">or just look around</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <button
          type="button"
          onClick={signInDemoOrg}
          className="mt-3 w-full rounded-lg border border-border px-4 py-2.5 text-[13px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
        >
          Explore a demo org
        </button>
        <p className="mt-1.5 text-[12px] text-subtle">
          For organizers who want to look around before they're set up — no account needed. It's a
          sandbox: nothing you do is saved or affects the real site.
        </p>
      </div>

      <p className="mt-4 px-1 text-center text-[12px] text-subtle">
        <Link to="/organizer/invite/demo-robotics" className="text-accent hover:underline">
          Have an invite?
        </Link>
      </p>
    </div>
  )
}
