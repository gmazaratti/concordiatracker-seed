import { useState } from 'react'
import { Link } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import { Button } from '@/components/ui/Button'

/** Teacher sign-in (mock auth, no passwords). Teachers join by invitation; this
 * is the returning-teacher door, plus a demo shortcut + admin/invite entry. */
export function TeacherSignIn() {
  const { signIn, signInDemo } = useTeacher()
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
          <GraduationCap size={22} aria-hidden />
        </span>
        <h1 className="mt-4 font-display text-[22px] leading-tight font-semibold text-fg">
          Teacher portal
        </h1>
        <p className="mt-1 text-[13px] text-subtle">Sign in to manage your course outlines.</p>

        <label className="mt-5 block text-[12px] font-medium text-muted" htmlFor="t-email">
          School email
        </label>
        <input
          id="t-email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            setError(false)
          }}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="you@concordia.ca"
          className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[14px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
        />
        {error && (
          <p className="mt-1.5 text-[12px] text-danger">
            No teacher account for that email — teachers join by invitation.
          </p>
        )}

        <Button className="mt-4 w-full" onClick={submit}>
          Continue
        </Button>

        <button
          type="button"
          onClick={signInDemo}
          className="mt-2 w-full rounded-lg border border-border px-4 py-2.5 text-[13px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
        >
          Use the demo teacher account
        </button>
      </div>

      <p className="mt-4 px-1 text-center text-[13px] text-muted">
        New here?{' '}
        <Link to="/teacher/request" className="font-medium text-accent hover:underline">
          Request teacher access
        </Link>
      </p>
      <p className="mt-1.5 px-1 text-center text-[12px] text-subtle">
        <Link to="/teacher/invite/demo-comm217" className="text-accent hover:underline">
          Have an invite?
        </Link>{' '}
        ·{' '}
        <Link to="/teacher/admin" className="text-accent hover:underline">
          Admin
        </Link>
      </p>
    </div>
  )
}
