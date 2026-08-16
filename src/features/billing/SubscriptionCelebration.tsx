import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, Crown, Sparkles, TrendingUp } from 'lucide-react'
import { checkoutStatus, fmtDate, type CheckoutStatus } from '@/lib/billing'
import { ModalShell } from '@/command/ModalShell'
import { Button } from '@/components/ui/Button'
import { Confetti } from '@/components/Confetti'
import { useSettings } from '@/app/providers/settings'

/**
 * The moment after a successful subscribe. Stripe returns to `/app?checkout=…`,
 * which used to just… reload. Now it throws confetti and says thank you.
 *
 * It only fires once the session is CONFIRMED complete server-side, so an
 * abandoned or failed checkout never gets a celebration.
 */
export function SubscriptionCelebration() {
  const [params, setParams] = useSearchParams()
  const { openSettings } = useSettings()
  const sessionId = params.get('checkout')
  const [status, setStatus] = useState<CheckoutStatus | null>(null)

  useEffect(() => {
    if (!sessionId) return
    let active = true
    void (async () => {
      const result = await checkoutStatus(sessionId).catch(() => null)
      if (!active) return
      if (result?.complete) setStatus(result)
      // Clean the URL either way, so a refresh can't replay it.
      setParams(
        (p) => {
          p.delete('checkout')
          return p
        },
        { replace: true },
      )
    })()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  if (!status) return null

  const semester = status.plan === 'semester'
  const close = () => setStatus(null)

  return (
    <>
      <Confetti count={140} />
      <ModalShell label="You're Pro" onClose={close}>
        <div className="p-6 text-center sm:p-7">
          <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-accent-soft text-accent">
            <Crown size={30} aria-hidden />
          </span>

          <h2 className="mt-4 font-display text-[26px] leading-tight font-semibold text-fg">
            You&rsquo;re in. Welcome to Pro 🎉
          </h2>
          <p className="mx-auto mt-2.5 max-w-md text-[14.5px] leading-relaxed text-muted">
            {status.stacked ? (
              <>
                Your {semester ? 'semester pass' : 'monthly plan'} is active: and the time you had
                left <span className="font-semibold text-fg">carried straight over</span>. Nothing
                lost.
              </>
            ) : (
              <>
                Thank you: genuinely. You&rsquo;re backing something built by a Concordia student,
                for Concordia students.
              </>
            )}
          </p>

          {status.trialEnd && (
            <p className="mt-2 text-[13px] font-medium text-accent">
              You&rsquo;re covered until {fmtDate(status.trialEnd)} before anything is charged.
            </p>
          )}

          {/* What they just unlocked */}
          <ul className="mx-auto mt-5 max-w-sm space-y-2 text-left">
            <Perk icon={TrendingUp}>GPA predictor: see where you land before you get there</Perk>
            <Perk icon={Sparkles}>Unlimited syllabus scans</Perk>
            <Perk icon={Check}>Every feature, all term</Perk>
          </ul>

          <div className="mt-6 flex flex-col items-center gap-2.5">
            <Button size="lg" className="w-full sm:w-auto" onClick={close}>
              Let&rsquo;s go
            </Button>
            <button
              type="button"
              onClick={() => {
                close()
                openSettings('billing')
              }}
              className="text-[13px] font-medium text-subtle transition-colors hover:text-fg"
            >
              View billing &amp; invoices
            </button>
          </div>
        </div>
      </ModalShell>
    </>
  )
}

function Perk({ icon: Icon, children }: { icon: typeof Check; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-[13px] leading-relaxed text-fg">
      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
        <Icon size={12} aria-hidden />
      </span>
      {children}
    </li>
  )
}
