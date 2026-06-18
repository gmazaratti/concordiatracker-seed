import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import { Button } from '@/components/ui/Button'

/** Organizer sign-in (mock auth, no passwords). Orgs join by invitation; this is
 * the returning-organizer door, plus a demo shortcut + request/invite/admin entry. */
export function OrganizerSignIn() {
  const { signIn, signInDemoOrg } = useTeacher()
  const [email, setEmail] = useState('')
  const [error, setError] = useState(false)

  function submit() {
    if (!email.trim()) return
    if (!signIn(email)) setError(true)
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
          Sign in to manage your org's events and profile.
        </p>

        <label className="mt-5 block text-[12px] font-medium text-muted" htmlFor="o-email">
          Org email
        </label>
        <input
          id="o-email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            setError(false)
          }}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="team@yourclub.org"
          className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[14px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
        />
        {error && (
          <p className="mt-1.5 text-[12px] text-danger">
            No organizer account for that email — orgs join by invitation.
          </p>
        )}

        <Button className="mt-4 w-full" onClick={submit}>
          Continue
        </Button>

        <button
          type="button"
          onClick={signInDemoOrg}
          className="mt-2 w-full rounded-lg border border-border px-4 py-2.5 text-[13px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
        >
          Use the demo organizer account
        </button>
      </div>

      <p className="mt-4 px-1 text-center text-[13px] text-muted">
        New here?{' '}
        <Link to="/organizer/request" className="font-medium text-accent hover:underline">
          Request organizer access
        </Link>
      </p>
      <p className="mt-1.5 px-1 text-center text-[12px] text-subtle">
        <Link to="/organizer/invite/demo-robotics" className="text-accent hover:underline">
          Have an invite?
        </Link>{' '}
        ·{' '}
        <Link to="/organizer/admin" className="text-accent hover:underline">
          Admin
        </Link>
      </p>
    </div>
  )
}
