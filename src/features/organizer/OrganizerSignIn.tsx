import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, ClipboardList, Ticket } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import { useAuth } from '@/app/providers/auth'
import { Button } from '@/components/ui/Button'
import { AppleGlyph } from '@/components/AppleGlyph'
import { OrgApplyForm } from './OrgApplyForm'

/**
 * Organizer portal entry.
 *
 * TWO DOORS, ASKED AS A QUESTION. Most people arriving here followed a link
 * we sent and hold a code; the rest are a club that found us on its own and
 * has to be vetted. Those are different journeys, and this screen used to
 * offer only the second one, unlabelled — so an invited org typed a name into
 * a box and quietly became an unreviewed application, while a club that found
 * us was never asked anything that would let anyone approve it.
 *
 * Applying does NOT gate the product: it opens the dashboard immediately and
 * gates PUBLICATION. Somebody's evening of setup is never held hostage to our
 * review queue.
 */
export function OrganizerSignIn() {
  const { myOrg, signInSelfOrg, signInDemoOrg } = useTeacher()
  const { user: authUser, signInWithGoogle, signInWithApple } = useAuth()
  const [path, setPath] = useState<'choose' | 'invite' | 'apply'>('choose')
  const [code, setCode] = useState('')

  if (path === 'apply') {
    return <OrgApplyForm onBack={() => setPath('choose')} onDone={signInSelfOrg} />
  }

  if (path === 'invite') {
    // A code, not a second account system: the invite LINK already works by
    // itself. This is for the person who has the code but not the link —
    // forwarded, retyped off a slide, read out in a meeting.
    const token = code.trim().replace(/^.*\/(?:join|invite)\//, '')
    return (
      <div className="mx-auto w-full max-w-md px-5 py-16">
        <button
          type="button"
          onClick={() => setPath('choose')}
          className="mb-4 text-[13px] text-muted transition-colors duration-150 hover:text-fg"
        >
          ← Back
        </button>
        <h1 className="font-display text-[22px] leading-tight font-semibold text-fg">
          Enter your invite
        </h1>
        <p className="mt-1.5 text-[13px] text-subtle">
          Paste the whole link or just the code — either works.
        </p>
        <input
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="demo-robotics"
          aria-label="Invite code"
          className="mt-5 w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 font-mono text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
        />
        <Link to={token ? `/organizer/invite/${encodeURIComponent(token)}` : '#'}>
          <Button className="mt-3 w-full" disabled={!token}>
            Continue
          </Button>
        </Link>
        <button
          type="button"
          onClick={() => setPath('apply')}
          className="mt-4 w-full text-[12.5px] text-subtle transition-colors duration-150 hover:text-fg"
        >
          No invite? Apply instead
        </button>
      </div>
    )
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
            <Button
              variant="outline"
              className="mt-2 w-full"
              onClick={() => void signInWithApple()}
            >
              <AppleGlyph />
              Sign in with Apple
            </Button>
            <p className="mt-1.5 text-center text-[12px] text-subtle">
              Sign in first — then tell us whether you were invited or are applying.
            </p>
          </>
        ) : myOrg ? (
          <>
            <Button className="mt-5 w-full" onClick={signInSelfOrg}>
              Continue as {myOrg.org.name}
            </Button>
            <p className="mt-1.5 text-center text-[12px] text-subtle">
              Your org and its events are saved.
            </p>
          </>
        ) : (
          <>
            <p className="mt-5 text-[12px] font-medium text-muted">Which are you?</p>
            <div className="mt-2 flex flex-col gap-2">
              <Door
                icon={<Ticket size={15} className="shrink-0 text-accent" aria-hidden />}
                title="I was invited"
                sub="You have a link or a code from us"
                onClick={() => setPath('invite')}
              />
              <Door
                icon={<ClipboardList size={15} className="shrink-0 text-accent" aria-hidden />}
                title="Apply to list my club"
                sub="Six questions. Dashboard straight away, live once we approve you."
                onClick={() => setPath('apply')}
              />
            </div>
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
          For organizers who want to look around before they're set up: no account needed. It's a
          sandbox: nothing you do is saved or affects the real site.
        </p>
      </div>
    </div>
  )
}

function Door({
  icon,
  title,
  sub,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  sub: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-border bg-surface-2 px-3.5 py-3 text-left transition-colors duration-150 hover:border-accent"
    >
      <span className="flex items-center gap-2 text-[13.5px] font-medium text-fg">
        {icon}
        {title}
      </span>
      <span className="mt-0.5 block text-[12px] text-subtle">{sub}</span>
    </button>
  )
}
