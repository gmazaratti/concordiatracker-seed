import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Check, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { buildPitch, pitchHeadline, type PublicSurveyAnswers } from './public-survey'

/**
 * What they see after sending the survey: their own answers reflected back,
 * with the specific things that would change for them.
 *
 * Everything claimed here is a feature that exists today — the matching lives in
 * `buildPitch`, and it deliberately shows at most three so it reads as an answer
 * rather than a brochure.
 */
export function SurveyResult({
  answers,
  showSignup = true,
}: {
  answers: PublicSurveyAnswers
  /** Off when the reader already has an account (in-app). */
  showSignup?: boolean
}) {
  const navigate = useNavigate()
  const pitches = useMemo(() => buildPitch(answers), [answers])

  return (
    <div>
      <div className="text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
          <Check size={28} strokeWidth={2.5} aria-hidden />
        </span>
        <h1 className="mt-4 font-display text-[25px] leading-tight font-semibold text-fg sm:text-[28px]">
          That genuinely helps — thank you.
        </h1>
        <p className="mx-auto mt-2.5 max-w-md text-[14px] leading-relaxed text-muted">
          I read every response myself.
        </p>
      </div>

      {pitches.length > 0 && (
        <>
          <p className="mt-8 mb-3 text-[14px] font-medium text-fg">{pitchHeadline(pitches)}</p>
          <div className="space-y-3">
            {pitches.map((p) => (
              <section key={p.id} className="rounded-xl border border-border bg-surface p-4">
                <p className="flex items-start gap-2 text-[13.5px] font-semibold text-fg">
                  <Sparkles size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                  {p.problem}
                </p>
                <p className="mt-1.5 pl-[23px] text-[13.5px] leading-relaxed text-muted">{p.answer}</p>
              </section>
            ))}
          </div>
        </>
      )}

      {pitches.length === 0 && (
        <p className="mt-8 rounded-xl border border-border bg-surface p-4 text-center text-[13.5px] leading-relaxed text-muted">
          {pitchHeadline(pitches)} If you ever want it in one place anyway, it&rsquo;s free to try.
        </p>
      )}

      {showSignup && (
        <div className="mt-6 rounded-2xl border border-accent/40 bg-accent-soft/40 p-5 text-center">
          <h2 className="font-display text-[19px] leading-tight font-semibold text-fg">
            Want to try it? It takes about a minute.
          </h2>
          <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted">
            Sign in with your Google account, add a class, and you&rsquo;ll see your term laid out.
            The core features are free with no time limit.
          </p>
          <Button size="lg" className="mt-4 w-full sm:w-auto" onClick={() => navigate('/app')}>
            Set up my semester
            <ArrowRight size={16} aria-hidden />
          </Button>
          <p className="mt-2 text-[11.5px] text-subtle">No card needed. Nothing to cancel.</p>
        </div>
      )}
    </div>
  )
}
