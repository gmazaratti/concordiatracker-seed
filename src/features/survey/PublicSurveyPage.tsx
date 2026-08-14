import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { PublicSurveyForm } from './PublicSurveyForm'
import { SurveyResult } from './SurveyResult'
import type { PublicSurveyAnswers } from './public-survey'

/**
 * `/survey` — a public questionnaire for students who DON'T use the app yet.
 * No account, no sign-in: it's shared as a link (often from Instagram), so it
 * has to work cold and read well on a phone.
 *
 * Sending it doesn't dead-end in a thank-you — it answers them, using what they
 * just said, and offers a one-tap path into the app.
 */
export function PublicSurveyPage() {
  const [sent, setSent] = useState<PublicSurveyAnswers | null>(null)

  return (
    <Shell>
      {sent ? (
        <SurveyResult answers={sent} />
      ) : (
        <>
          <header className="mb-7">
            <h1 className="font-display text-[28px] leading-tight font-semibold text-fg sm:text-[32px]">
              How do you keep track of everything?
            </h1>
            <p className="mt-2.5 text-[14.5px] leading-relaxed text-muted">
              I&rsquo;m a Concordia student building a tool to make deadlines and grades less of a
              mess. These answers decide what I build next — there are no wrong ones, and being
              harsh is more useful than being nice.
            </p>
            <p className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] text-subtle">
              <Clock size={13} aria-hidden />
              About 2 minutes · anonymous unless you add your email
            </p>
          </header>

          <PublicSurveyForm
            onDone={(answers) => {
              setSent(answers)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
          />
        </>
      )}
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
