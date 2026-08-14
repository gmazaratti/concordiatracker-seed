import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  CHOICE_QUESTIONS,
  EMPTY,
  RATING_QUESTIONS,
  TEXT_QUESTIONS,
  isComplete,
  submitPublicSurvey,
  type PublicSurveyAnswers,
} from './public-survey'
import { cn } from '@/lib/cn'

/**
 * The questionnaire itself, split out from the page so it can run both on the
 * public /survey route and inside the app's feedback tab. Hands the completed
 * answers back so the caller can show the personalised result.
 */
export function PublicSurveyForm({
  onDone,
  compact = false,
}: {
  onDone: (answers: PublicSurveyAnswers) => void
  /** In-app: tighter type, no email capture (they already have an account). */
  compact?: boolean
}) {
  const [a, setA] = useState<PublicSurveyAnswers>(EMPTY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const setRating = (id: string, v: number) =>
    setA((p) => ({ ...p, ratings: { ...p.ratings, [id]: v } }))
  const setAnswer = (id: string, v: string) =>
    setA((p) => ({ ...p, answers: { ...p.answers, [id]: v } }))

  const toggleMulti = (id: string, option: string) =>
    setA((p) => {
      const current = (p.answers[id] ?? '').split('|').filter(Boolean)
      const next = current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option]
      return { ...p, answers: { ...p.answers, [id]: next.join('|') } }
    })

  const submit = async () => {
    if (!isComplete(a)) return
    setBusy(true)
    setError('')
    try {
      await submitPublicSurvey(a)
      onDone(a)
    } catch {
      setError('Couldn’t send that — please try again.')
      setBusy(false)
    }
  }

  const label = compact ? 'text-[13.5px]' : 'text-[14px]'

  return (
    <>
      <div className="space-y-4">
        {RATING_QUESTIONS.map((q) => (
          <section key={q.id} className="rounded-xl border border-border bg-surface p-4">
            <p className={cn('leading-snug font-medium text-fg', label)}>{q.label}</p>
            <div className="mt-3 flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => {
                const active = a.ratings[q.id] === n
                return (
                  <button
                    key={n}
                    type="button"
                    aria-label={`${n} of 5`}
                    aria-pressed={active}
                    onClick={() => setRating(q.id, n)}
                    className={cn(
                      'flex-1 rounded-lg border text-[14px] font-semibold tabular-nums transition-colors duration-150',
                      compact ? 'h-9' : 'h-11',
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
            <div className="mt-1.5 flex justify-between text-[11.5px] text-subtle">
              <span>{q.low}</span>
              <span>{q.high}</span>
            </div>
          </section>
        ))}

        {CHOICE_QUESTIONS.map((q) => {
          const picked = (a.answers[q.id] ?? '').split('|').filter(Boolean)
          return (
            <section key={q.id} className="rounded-xl border border-border bg-surface p-4">
              <p className={cn('leading-snug font-medium text-fg', label)}>{q.label}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {q.options.map((opt) => {
                  const active = q.multi ? picked.includes(opt) : a.answers[q.id] === opt
                  return (
                    <button
                      key={opt}
                      type="button"
                      aria-pressed={active}
                      onClick={() => (q.multi ? toggleMulti(q.id, opt) : setAnswer(q.id, opt))}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors duration-150',
                        active
                          ? 'border-accent bg-accent-soft text-fg'
                          : 'border-border text-muted hover:border-border-strong hover:text-fg',
                      )}
                    >
                      {opt}
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}

        {TEXT_QUESTIONS.map((q) => (
          <section key={q.id} className="rounded-xl border border-border bg-surface p-4">
            <label className="block">
              <span className={cn('leading-snug font-medium text-fg', label)}>{q.label}</span>
              <textarea
                value={a.answers[q.id] ?? ''}
                onChange={(e) => setAnswer(q.id, e.target.value)}
                placeholder={q.placeholder}
                rows={3}
                maxLength={2000}
                className="mt-2.5 w-full resize-y rounded-lg border border-border bg-canvas px-3 py-2 text-[14px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
              />
            </label>
          </section>
        ))}

        {/* Signed-out visitors only — an existing user already has an account. */}
        {!compact && (
          <section className="rounded-xl border border-accent/40 bg-accent-soft/40 p-4">
            <label className="block">
              <span className="text-[14px] font-medium text-fg">
                Want early access when it&rsquo;s ready?{' '}
                <span className="text-subtle">(optional)</span>
              </span>
              <input
                type="email"
                value={a.email}
                onChange={(e) => setA((p) => ({ ...p, email: e.target.value }))}
                placeholder="you@live.concordia.ca"
                className="mt-2.5 w-full rounded-lg border border-border bg-canvas px-3 py-2 text-[14px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
              />
              <span className="mt-1.5 block text-[11.5px] text-subtle">
                Only used to tell you when something ships. No list, no spam.
              </span>
            </label>
          </section>
        )}
      </div>

      {error && <p className="mt-4 text-center text-[13px] font-medium text-danger">{error}</p>}

      <div className="mt-6 flex flex-col items-center gap-2.5 pb-4">
        <Button
          size="lg"
          className="w-full sm:w-auto"
          disabled={!isComplete(a) || busy}
          onClick={() => void submit()}
        >
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Send my answers
        </Button>
        {!isComplete(a) && (
          <p className="text-[12px] text-subtle">Answer the six scale questions to send.</p>
        )}
      </div>
    </>
  )
}
