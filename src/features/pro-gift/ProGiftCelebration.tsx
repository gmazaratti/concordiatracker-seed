import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Check, Copy, Crown, Sparkles } from 'lucide-react'
import { useAuth } from '@/app/providers/auth'
import { useAppData } from '@/app/providers/app-data'
import { supabase, fireWrite } from '@/lib/supabase'
import { ModalShell } from '@/command/ModalShell'
import { Button } from '@/components/ui/Button'
import { Confetti } from '@/components/Confetti'
import {
  REFERRAL_PAYING_CREDIT,
  REFERRAL_SIGNUP_CREDIT,
  referralCode,
  referralLink,
} from '@/features/feedback/survey/survey-data'

/**
 * When an admin gifts a user Pro (db/pro_gift.sql sets pro_gift_pending), this
 * throws a one-time confetti + personal thank-you the next time they open the
 * app — and nudges them toward the survey + inviting friends. Reads/clears the
 * flag itself, so it needs no provider plumbing.
 */
export function ProGiftCelebration() {
  const { user: authUser } = useAuth()
  const { user } = useAppData()
  const navigate = useNavigate()
  const [by, setBy] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!authUser) return
    let active = true
    void (async () => {
      const { data } = await supabase
        .from('user_profile')
        .select('pro_gift_pending, pro_gift_by')
        .eq('user_id', authUser.id)
        .maybeSingle()
      if (!active) return
      if (data?.pro_gift_pending) setBy((data.pro_gift_by as string) || 'the ConcordiaTracker team')
      setReady(true)
    })()
    return () => {
      active = false
    }
  }, [authUser])

  if (!ready || !by) return null

  const dismiss = () => {
    setBy(null)
    fireWrite(supabase.rpc('dismiss_pro_gift'))
  }

  // "Alex Degryse" → "Alex"; a team fallback stays whole.
  const firstName = /team/i.test(by) ? by : by.split(/\s+/)[0]
  const link = referralLink(referralCode(user.handle, authUser?.id))

  return (
    <>
      <Confetti />
      <ModalShell label="A gift for you" onClose={dismiss}>
        <div className="p-6 text-center sm:p-7">
          <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-accent-soft text-accent">
            <Crown size={30} aria-hidden />
          </span>
          <h2 className="mt-4 font-display text-[24px] leading-tight font-semibold text-fg">
            You&rsquo;ve been gifted Pro 🎉
          </h2>
          <p className="mx-auto mt-2.5 max-w-md text-[14.5px] leading-relaxed text-muted">
            {firstName} upgraded you to <span className="font-semibold text-fg">ConcordiaTracker Pro</span>{' '}
           : personally, and on the house. No charge, no catch. It genuinely means a lot that
            you&rsquo;re here early, and this is our way of saying <span className="font-medium text-fg">thank you</span> for
            supporting what we&rsquo;re building.
          </p>

          <div className="mx-auto mt-4 flex max-w-md items-center gap-2.5 rounded-xl border border-accent/40 bg-accent-soft/40 p-3 text-left">
            <Sparkles className="size-5 shrink-0 text-accent" aria-hidden />
            <p className="text-[12.5px] leading-relaxed text-fg">
              Everything&rsquo;s unlocked now: the GPA predictor, unlimited syllabus scans, and every
              other Pro feature.
            </p>
          </div>

          {/* Invite others: their referral link */}
          <div className="mx-auto mt-3 max-w-md text-left">
            <p className="mb-1.5 text-[12.5px] text-muted">
              Pay it forward? Share your link: every friend who joins takes{' '}
              <span className="font-semibold text-fg">${REFERRAL_SIGNUP_CREDIT.toFixed(2)}</span> off a
              future term ({' '}
              <span className="font-semibold text-fg">${REFERRAL_PAYING_CREDIT.toFixed(2)}</span> if they
              go Pro).
            </p>
            <CopyLink link={link} />
          </div>

          <div className="mt-6 flex flex-col items-center gap-2.5">
            <Button size="lg" className="w-full sm:w-auto" onClick={dismiss}>
              Thank you! 🙌
            </Button>
            <button
              type="button"
              onClick={() => {
                dismiss()
                navigate('/app/requests?tab=survey')
              }}
              className="inline-flex items-center gap-1 text-[13px] font-medium text-accent transition-colors hover:underline"
            >
              Help shape what&rsquo;s next: take the 2-min survey
              <ArrowRight size={14} aria-hidden />
            </button>
          </div>
        </div>
      </ModalShell>
    </>
  )
}

function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    void navigator.clipboard?.writeText(link).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    })
  }
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-lg border border-border bg-canvas px-3 py-2 text-[12.5px] text-fg">
        {link}
      </code>
      <Button size="sm" variant="outline" onClick={copy}>
        {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  )
}
