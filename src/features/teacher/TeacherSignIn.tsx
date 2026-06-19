import { Link } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import { useAppData } from '@/app/providers/app-data'
import { useAuth } from '@/app/providers/auth'
import { Button } from '@/components/ui/Button'

/** Teacher portal entry. Signed in → your own persistent account; signed out →
 * Google sign-in for a real account. Either way, a public demo button lets anyone
 * look around the seeded portal (a sandbox that writes nothing). */
export function TeacherSignIn() {
  const { signInSelf, signInDemo } = useTeacher()
  const { user: authUser, signInWithGoogle } = useAuth()
  const { user } = useAppData()

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-5 py-16">
      <div className="rounded-2xl border border-border bg-surface p-6">
        <span className="grid size-11 place-items-center rounded-xl bg-accent-soft text-accent">
          <GraduationCap size={22} aria-hidden />
        </span>
        <h1 className="mt-4 font-display text-[22px] leading-tight font-semibold text-fg">
          Teacher portal
        </h1>
        <p className="mt-1 text-[13px] text-subtle">
          Manage your course outlines, publish verified blueprints, and post announcements.
        </p>

        {authUser ? (
          <>
            <Button className="mt-5 w-full" onClick={signInSelf}>
              Continue as {user.name}
            </Button>
            <p className="mt-1.5 text-center text-[12px] text-subtle">
              Your courses are saved to your account.
            </p>
          </>
        ) : (
          <>
            <Button className="mt-5 w-full" onClick={() => void signInWithGoogle()}>
              Sign in with Google
            </Button>
            <p className="mt-1.5 text-center text-[12px] text-subtle">
              Sign in to manage your real course outlines.
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
          onClick={signInDemo}
          className="mt-3 w-full rounded-lg border border-border px-4 py-2.5 text-[13px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
        >
          Explore a demo teacher
        </button>
        <p className="mt-1.5 text-[12px] text-subtle">
          For teachers who want to look around before they're set up — no account needed. It's a
          sandbox: nothing you do is saved or affects the real site.
        </p>
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
        </Link>
      </p>
    </div>
  )
}
