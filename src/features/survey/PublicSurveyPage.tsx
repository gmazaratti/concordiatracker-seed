import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Clock, Loader2 } from 'lucide-react'
import { Logo } from '@/components/Logo'
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
 * `/survey` — a public questionnaire for students who DON'T use the app yet.
 * No account, no sign-in: it's shared as a link (often from Instagram), so it
 * has to work cold and read well on a phone.
 */
export function PublicSurveyPage() {
  const [a, setA] = useState<PublicSurveyAnswers>(EMPTY)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
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
      setDone(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setError('Couldn’t send that — please try again.')
      setBusy(false)
    }
  }

  if (done) {
    return (
      <Shell>
        <div className="rounded-2xl border border-border bg-surface p-8 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
            <Check size={28} strokeWidth={2.5} aria-hidden />
          </span>
          <h1 className="mt-4 font-display text-[24px] leading-tight font-semibold text-fg">
            That genuinely helps — thank you.
          </h1>
          <p className="mx-auto mt-2.5 max-w-md text-[14px] leading-relaxed text-muted">
            I read every response myself. If you left your email I&rsquo;ll be in touch when the
            next big thing ships.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13.5px] font-semibold text-accent-contrast transition-colors hover:bg-accent-hover"
          >
            See what I&rsquo;m building
            <ArrowRight size={15} aria-hidden />
          </Link>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <header className="mb-7">
        <h1 className="font-display text-[28px] leading-tight font-semibold text-fg sm:text-[32px]">
          How do you keep track of everything?
        </h1>
        <p className="mt-2.5 text-[14.5px] leading-relaxed text-muted">
          I&rsquo;m a Concordia student building a tool to make deadlines and grades less of a mess.
          These answers decide what I build next — there are no wrong ones, and being harsh is more
          useful than being nice.
        </p>
        <p className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] text-subtle">
          <Clock size={13} aria-hidden />
          About 2 minutes · anonymous unless you add your email
        </p>
      </header>

      <div className="space-y-4">
        {RATING_QUESTIONS.map((q) => (
          <section key={q.id} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-[14px] leading-snug font-medium text-fg">{q.label}</p>
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
                      'h-11 flex-1 rounded-lg border text-[14px] font-semibold tabular-nums transition-colors duration-150',
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
              <p className="text-[14px] leading-snug font-medium text-fg">{q.label}</p>
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
              <span className="text-[14px] leading-snug font-medium text-fg">{q.label}</span>
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

        {/* Optional email — framed as a benefit, never required. */}
        <section className="rounded-xl border border-accent/40 bg-accent-soft/40 p-4">
          <label className="block">
            <span className="text-[14px] font-medium text-fg">
              Want early access when it&rsquo;s ready? <span className="text-subtle">(optional)</span>
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
      </div>

      {error && <p className="mt-4 text-center text-[13px] font-medium text-danger">{error}</p>}

      <div className="mt-6 flex flex-col items-center gap-2.5 pb-4">
        <Button size="lg" className="w-full sm:w-auto" disabled={!isComplete(a) || busy} onClick={() => void submit()}>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Send my answers
        </Button>
        {!isComplete(a) && (
          <p className="text-[12px] text-subtle">Answer the six scale questions to send.</p>
        )}
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-svh bg-canvas">
      <div className="ct-grid-bg pointer-events-none fixed inset-0" aria-hidden />
      <header className="relative border-b border-border">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-5 py-4">
          <Link to="/" aria-label="ConcordiaTracker home">
            <Logo />
          </Link>
          <Link
            to="/app"
            className="rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            Try it
          </Link>
        </div>
      </header>
      <main className="relative mx-auto w-full max-w-2xl px-5 py-8 sm:py-10">{children}</main>
      <footer className="relative border-t border-border py-5 text-center text-[11.5px] text-subtle">
        Not affiliated with Concordia University.
      </footer>
    </div>
  )
}
