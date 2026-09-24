import { useNavigate } from 'react-router-dom'
import { ClipboardList, Mail } from 'lucide-react'
import { useAuth } from '@/app/providers/auth'
import { Button } from '@/components/ui/Button'
import { AppleGlyph } from '@/components/AppleGlyph'
import { GoogleGlyph } from '@/components/GoogleGlyph'
import { rememberReturn } from '@/lib/auth-intent'
import { OrgApplyForm } from './OrgApplyForm'

const HERE = '/organizer/apply'

/**
 * `/organizer/apply`: the club application, at an address that can be linked.
 *
 * The form was only reachable by clicking through the portal's front door
 * ("Which are you?" then "Apply"), so nothing outside the app could point a
 * club president straight at it. This page is that address.
 *
 * SIGN-IN FIRST, AND IT COMES BACK HERE. The club is owned by the account that
 * applies, so there is nothing to fill in until there is an account. Every
 * sign-in route ends somewhere fixed (OAuth on /app, the email form on /app),
 * so the path is remembered first and AuthIntentRedirect brings them back.
 *
 * What happens after is unchanged: `apply_for_org` creates the club as
 * PENDING, the dashboard opens immediately, and nothing reaches students until
 * an admin approves it.
 */
export function OrganizerApplyPage() {
  const navigate = useNavigate()
  const { user, signInWithGoogle, signInWithApple } = useAuth()

  if (user) {
    return <OrgApplyForm onBack={() => navigate('/organizer')} onDone={() => navigate('/organizer')} />
  }

  const viaGoogle = () => {
    rememberReturn(HERE)
    void signInWithGoogle()
  }
  const viaApple = () => {
    rememberReturn(HERE)
    void signInWithApple()
  }
  const viaEmail = () => {
    rememberReturn(HERE)
    navigate('/app')
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col px-5 py-14">
      <span className="grid size-12 place-items-center self-center rounded-2xl bg-accent-soft text-accent">
        <ClipboardList size={24} aria-hidden />
      </span>
      <h1 className="mt-4 text-center font-display text-[24px] leading-tight font-semibold text-fg">
        Apply to list your club
      </h1>
      <p className="mt-1.5 text-center text-[13.5px] leading-relaxed text-subtle">
        Sign in first, with the account you will run the club from. Then a few quick questions, and your dashboard opens
        straight away. The club stays pending until we approve it.
      </p>

      <div className="mt-6 flex flex-col gap-2.5 rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <Button variant="outline" size="lg" className="w-full" onClick={viaGoogle}>
          <GoogleGlyph />
          Continue with Google
        </Button>
        <Button variant="outline" size="lg" className="w-full" onClick={viaApple}>
          <AppleGlyph />
          Continue with Apple
        </Button>
        <Button variant="outline" size="lg" className="w-full" onClick={viaEmail}>
          <Mail size={16} aria-hidden />
          Use email instead
        </Button>
      </div>
      <p className="mt-3 text-center text-[12px] text-subtle">You come back to this form once you are signed in.</p>
    </div>
  )
}
