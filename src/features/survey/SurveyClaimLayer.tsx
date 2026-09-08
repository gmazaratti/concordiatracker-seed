import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Sparkles, X } from 'lucide-react'
import { useAuth } from '@/app/providers/auth'
import { redeemSurveyCode, stashClaim, takeClaim } from './public-survey'

/**
 * Turns the survey's "create my free account" link into an actual free week.
 *
 * Two steps, because they can be hours apart. The token arrives as `?claim=`
 * and is STASHED immediately — signing up leaves the page for an email link or
 * a Google redirect, and the query string does not survive that. Once there is
 * a session, the stash is spent.
 *
 * `takeClaim` removes it as it reads, so a redemption is attempted exactly
 * once; the server would reject a second attempt anyway, but a component that
 * retries on every render is how you find that out the expensive way.
 *
 * Silent on failure. An expired or already-used token is not something to
 * interrupt somebody's first minute in the app about — they came here to set up
 * their courses, and the free week was a thank-you, not a purchase.
 */
export function SurveyClaimLayer() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const [granted, setGranted] = useState(false)

  const token = params.get('claim')

  // Stash and strip on arrival, whether or not there is a session yet.
  useEffect(() => {
    if (!token) return
    stashClaim(token)
    const next = new URLSearchParams(params)
    next.delete('claim')
    setParams(next, { replace: true })
  }, [token, params, setParams])

  useEffect(() => {
    if (!user) return
    const pending = takeClaim()
    if (!pending) return
    void redeemSurveyCode(pending)
      .then(() => setGranted(true))
      .catch(() => {
        /* already used, or the migration is not in yet — not worth a dialog */
      })
  }, [user])

  if (!granted) return null

  return (
    <div
      role="status"
      className="ct-toast-in fixed inset-x-3 top-[calc(4.5rem_+_env(safe-area-inset-top))] z-[60] md:inset-x-auto md:top-auto md:right-4 md:bottom-4"
    >
      <div className="flex items-start gap-3 rounded-xl border border-accent/50 bg-surface px-4 py-3 shadow-lg md:max-w-sm">
        <Sparkles size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-fg">Your free week is on</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-subtle">
            Seven days of Pro, for filling in the survey. Nothing to cancel.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setGranted(false)}
          aria-label="Dismiss"
          className="shrink-0 text-subtle transition-colors duration-150 hover:text-fg"
        >
          <X size={15} aria-hidden />
        </button>
      </div>
    </div>
  )
}
