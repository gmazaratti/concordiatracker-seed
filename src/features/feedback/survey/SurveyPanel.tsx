import { useEffect, useState } from 'react'
import { Check, Copy, Gift, Heart, Loader2, Lock, PartyPopper } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { useAuth } from '@/app/providers/auth'
import { useUiState } from '@/app/providers/ui-state'
import { useIsAdmin } from '@/features/admin/admin-data'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import {
  EMPTY_SURVEY,
  RATING_QUESTIONS,
  REFERRAL_PAYING_CREDIT,
  REFERRAL_SIGNUP_CREDIT,
  TEXT_QUESTIONS,
  isComplete,
  loadMySurvey,
  referralCode,
  referralLink,
  submitSurvey,
  type SurveyResponse,
} from './survey-data'

const REQUIRED_DAYS = 3

/** The `?tab=survey` panel on /app/requests: a short rating + open-ended survey,
 * gated on ≥3 days of use, that rewards recommenders with a referral code. */
export function SurveyPanel() {
  const { user } = useAppData()
  const { user: authUser } = useAuth()
  const { isAdmin } = useIsAdmin()
  const { uiState, loaded, patchUiState } = useUiState()

  const [resp, setResp] = useState<SurveyResponse>(EMPTY_SURVEY)
  const [loadedResp, setLoadedResp] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Pull any prior submission (so a returning user sees their answers / done state).
  useEffect(() => {
    if (!authUser) return
    let active = true
    void (async () => {
      const prior = await loadMySurvey(authUser.id)
      if (!active) return
      if (prior) setResp(prior)
      setLoadedResp(true)
    })()
    return () => {
      active = false
    }
  }, [authUser])

  const daysUsed = uiState.visitDays?.length ?? 0
  const eligible = isAdmin || daysUsed >= REQUIRED_DAYS
  const done = !!uiState.surveyDone

  if (!loaded || !loadedResp) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-5 animate-spin text-accent" aria-label="Loading" />
      </div>
    )
  }

  if (done) {
    return <DoneCard recommend={resp.recommend} handle={user.handle} userId={authUser?.id} />
  }

  if (!eligible) {
    return <LockedCard daysUsed={daysUsed} />
  }

  const setRating = (id: string, v: number) =>
    setResp((r) => ({ ...r, ratings: { ...r.ratings, [id]: v } }))
  const setAnswer = (id: string, v: string) =>
    setResp((r) => ({ ...r, answers: { ...r.answers, [id]: v } }))
  const setRecommend = (v: boolean) => setResp((r) => ({ ...r, recommend: v }))

  const submit = async () => {
    if (!authUser || !isComplete(resp)) return
    setSaving(true)
    setError('')
    try {
      await submitSurvey(authUser.id, resp)
      patchUiState({ surveyDone: true })
    } catch {
      setError('Couldn’t save that — please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-accent/40 bg-accent-soft/50 p-4">
        <div className="flex items-start gap-2.5">
          <Gift className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
          <div>
            <p className="text-[13.5px] font-semibold text-fg">Two minutes → a real say in what we build</p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
              Your answers shape the roadmap directly. Recommend us at the end and you&rsquo;ll
              unlock a personal referral code that takes money off your semester pass.
            </p>
          </div>
        </div>
      </div>

      {/* Ratings */}
      <div className="space-y-3">
        {RATING_QUESTIONS.map((q) => (
          <RatingRow
            key={q.id}
            label={q.label}
            low={q.low}
            high={q.high}
            value={resp.ratings[q.id]}
            onChange={(v) => setRating(q.id, v)}
          />
        ))}
      </div>

      {/* Recommend → reveals the referral reward */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-[13.5px] font-medium text-fg">Would you recommend ConcordiaTracker to a friend?</p>
        <div className="mt-3 flex gap-2.5">
          <RecommendButton active={resp.recommend === true} onClick={() => setRecommend(true)} yes />
          <RecommendButton active={resp.recommend === false} onClick={() => setRecommend(false)} />
        </div>
        {resp.recommend === true && (
          <div className="mt-4">
            <ReferralReward handle={user.handle} userId={authUser?.id} />
          </div>
        )}
      </div>

      {/* Open-ended */}
      <div className="space-y-3">
        {TEXT_QUESTIONS.map((q) => (
          <label key={q.id} className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-fg">{q.label}</span>
            <textarea
              value={resp.answers[q.id] ?? ''}
              onChange={(e) => setAnswer(q.id, e.target.value)}
              placeholder={q.placeholder}
              rows={2}
              maxLength={2000}
              className="w-full resize-y rounded-lg border border-border bg-canvas px-3 py-2 text-[13.5px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
            />
          </label>
        ))}
      </div>

      {error && <p className="text-[12.5px] font-medium text-danger">{error}</p>}

      <div className="flex items-center gap-3">
        <Button size="lg" disabled={!isComplete(resp) || saving} onClick={() => void submit()}>
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Submit feedback
        </Button>
        {!isComplete(resp) && (
          <p className="text-[12px] text-subtle">Answer the ratings + the recommend question to submit.</p>
        )}
      </div>
    </div>
  )
}

// ── Rating scale ────────────────────────────────────────────────────────────────
function RatingRow({
  label,
  low,
  high,
  value,
  onChange,
}: {
  label: string
  low: string
  high: string
  value: number | undefined
  onChange: (v: number) => void
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-[13.5px] font-medium text-fg">{label}</p>
      <div className="mt-2.5 flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => {
          const active = value === n
          return (
            <button
              key={n}
              type="button"
              aria-label={`${n} of 5`}
              aria-pressed={active}
              onClick={() => onChange(n)}
              className={cn(
                'h-9 flex-1 rounded-lg border text-[13px] font-semibold tabular-nums transition-colors duration-150',
                active
                  ? 'border-accent bg-accent text-accent-contrast'
                  : 'border-border bg-surface-2/40 text-muted hover:border-border-strong hover:text-fg',
              )}
            >
              {n}
            </button>
          )
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-subtle">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  )
}

function RecommendButton({ active, onClick, yes = false }: { active: boolean; onClick: () => void; yes?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-[13.5px] font-medium transition-colors duration-150',
        active
          ? yes
            ? 'border-accent bg-accent-soft text-fg'
            : 'border-border-strong bg-surface-2 text-fg'
          : 'border-border text-muted hover:border-border-strong hover:text-fg',
      )}
    >
      {yes && <Heart size={15} className={active ? 'text-accent' : ''} aria-hidden />}
      {yes ? 'Yes, I would' : 'Not yet'}
    </button>
  )
}

// ── Referral reward ─────────────────────────────────────────────────────────────
function ReferralReward({ handle, userId }: { handle?: string | null; userId?: string | null }) {
  const code = referralCode(handle, userId)
  const link = referralLink(code)
  const [copied, setCopied] = useState(false)
  const copy = () => {
    void navigator.clipboard?.writeText(link).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    })
  }
  return (
    <div className="rounded-xl border border-accent/50 bg-accent-soft/40 p-4">
      <div className="flex items-center gap-2">
        <PartyPopper size={16} className="text-accent" aria-hidden />
        <p className="text-[13.5px] font-semibold text-fg">Here&rsquo;s your referral code</p>
      </div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
        Share this link. Every friend who signs up takes{' '}
        <span className="font-semibold text-fg">${REFERRAL_SIGNUP_CREDIT.toFixed(2)}</span> off your
        semester pass — and{' '}
        <span className="font-semibold text-fg">${REFERRAL_PAYING_CREDIT.toFixed(2)}</span> when they
        upgrade to a paid plan. Credits stack and apply automatically.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg border border-border bg-canvas px-3 py-2 text-[12.5px] text-fg">
          {link}
        </code>
        <Button size="sm" variant="outline" onClick={copy}>
          {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  )
}

// ── Locked / done states ────────────────────────────────────────────────────────
function LockedCard({ daysUsed }: { daysUsed: number }) {
  const pct = Math.min(100, (daysUsed / REQUIRED_DAYS) * 100)
  return (
    <div className="rounded-2xl border border-border bg-surface p-6 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-xl bg-surface-2 text-subtle">
        <Lock size={22} aria-hidden />
      </span>
      <h3 className="mt-3.5 text-[16px] font-semibold text-fg">The survey unlocks soon</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted">
        We ask after you&rsquo;ve had a few real days with ConcordiaTracker, so your feedback is
        grounded in actual use. You&rsquo;re{' '}
        <span className="font-semibold text-fg">{daysUsed} of {REQUIRED_DAYS} days</span> in.
      </p>
      <div className="mx-auto mt-4 h-1.5 w-48 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-3 text-[12px] text-subtle">Come back on another day — we&rsquo;ll be ready.</p>
    </div>
  )
}

function DoneCard({
  recommend,
  handle,
  userId,
}: {
  recommend: boolean | null
  handle?: string | null
  userId?: string | null
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-xl bg-accent-soft text-accent">
        <Check size={24} strokeWidth={2.5} aria-hidden />
      </span>
      <h3 className="mt-3.5 text-[17px] font-semibold text-fg">Thank you — genuinely.</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted">
        Your answers go straight into what we build next. If something changes because of you,
        you&rsquo;ll see it in <span className="font-medium text-fg">What&rsquo;s new</span>.
      </p>
      {recommend === true && (
        <div className="mx-auto mt-5 max-w-md text-left">
          <ReferralReward handle={handle} userId={userId} />
        </div>
      )}
    </div>
  )
}
