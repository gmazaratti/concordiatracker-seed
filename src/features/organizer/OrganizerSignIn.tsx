import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, ClipboardList, Ticket } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import { useAuth } from '@/app/providers/auth'
import { Button } from '@/components/ui/Button'
import { AppleGlyph } from '@/components/AppleGlyph'
import { GoogleGlyph } from '@/components/GoogleGlyph'
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
  const { myOrg, myOrgs, ownedOrgIds, switchOrg, signInSelfOrg, signInDemoOrg } = useTeacher()
  const [showAll, setShowAll] = useState(false)
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
          Paste the whole link or just the code. Either works.
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
    <div className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-sm flex-col justify-center px-5 py-12">
      <div className="flex flex-col items-center text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
          <CalendarDays size={24} aria-hidden />
        </span>
        <h1 className="mt-4 font-display text-[26px] leading-tight font-semibold text-fg">Organizer portal</h1>
        <p className="mt-1.5 max-w-[18rem] text-[13.5px] text-subtle">
          Post events and updates to the Community feed, and run your club's profile.
        </p>
      </div>

      <div className="mt-7 rounded-2xl border border-border bg-surface p-5 shadow-sm">
        {!authUser ? (
          <>
            <Button variant="outline" size="lg" className="w-full" onClick={() => void signInWithGoogle()}>
              <GoogleGlyph />
              Continue with Google
            </Button>
            <Button variant="outline" size="lg" className="mt-2.5 w-full" onClick={() => void signInWithApple()}>
              <AppleGlyph />
              Continue with Apple
            </Button>
            <p className="mt-3 text-center text-[12px] leading-snug text-subtle">
              Use the account you'll run the club from. Invited or applying, you choose next.
            </p>
          </>
        ) : myOrg ? (
          <>
            {/* ONE BUTTON PER CLUB. There used to be a single "Continue as"
                naming whichever club sorted first, so somebody running two
                clubs could only reach the second through the switcher once
                inside. "Yours" = owned or on the team; a platform admin can
                reach every club, which is not the same as running them, so
                those stay behind the switcher. */}
            {(() => {
              const mine = myOrgs.filter(
                (o) => ownedOrgIds.has(o.id) || o.members.some((m) => !!m.userId && m.userId === authUser.id),
              )
              const list = mine.length ? mine : [myOrg]
              const shown = showAll ? list : list.slice(0, 5)
              return (
                <div className="flex flex-col gap-2">
                  {shown.map((o, i) => (
                    <Button
                      key={o.id}
                      size="lg"
                      variant={i === 0 ? undefined : 'outline'}
                      className="w-full"
                      onClick={() => switchOrg(o.id)}
                    >
                      <span className="truncate">Continue as {o.org.name}</span>
                    </Button>
                  ))}
                  {list.length > shown.length && (
                    <button
                      type="button"
                      onClick={() => setShowAll(true)}
                      className="rounded-lg py-1 text-[12.5px] font-medium text-accent hover:underline"
                    >
                      Show {list.length - shown.length} more
                    </button>
                  )}
                </div>
              )
            })()}
            <p className="mt-2 text-center text-[12px] text-subtle">Signed in as {authUser.email}</p>
          </>
        ) : (
          <>
            <p className="text-[12px] font-medium text-muted">Which are you?</p>
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
                sub="A few questions. Dashboard straight away, live once we approve you."
                onClick={() => setPath('apply')}
              />
            </div>
          </>
        )}
      </div>

      {/* THE DEMO IS A LINK, NOT A DOOR. It sat under its own divider as a
          full-width button, which made "look at a fake club" the loudest thing
          on a screen whose job is signing a real one in. */}
      <button
        type="button"
        onClick={signInDemoOrg}
        title="A sandbox: nothing you do there is saved"
        className="mx-auto mt-5 text-[12.5px] text-subtle underline-offset-4 transition-colors duration-150 hover:text-fg hover:underline"
      >
        See how a demo looks?
      </button>
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
