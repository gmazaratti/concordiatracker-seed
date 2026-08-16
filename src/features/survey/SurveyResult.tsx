import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Check } from 'lucide-react'
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
          That genuinely helps: thank you.
        </h1>
        <p className="mx-auto mt-2.5 max-w-md text-[14px] leading-relaxed text-muted">
          I read every response myself.
        </p>
      </div>

      {pitches.length > 0 && (
        <>
          <p className="mt-8 mb-3 text-[13px] font-medium tracking-wide text-subtle uppercase">
            {pitchHeadline(pitches)}
          </p>
          {/* Their answer is the quiet label; the benefit is the thing you read.
              Numbered rather than iconned: a row of decorative glyphs makes the
              whole block scan as filler. */}
          <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {pitches.map((p, i) => (
              <li key={p.id} className="flex gap-3.5 p-4">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-[12px] font-bold text-accent tabular-nums">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-[11.5px] font-medium text-subtle">{p.problem}</p>
                  <p className="mt-0.5 text-[15px] leading-snug font-semibold text-fg">{p.title}</p>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{p.answer}</p>
                </div>
              </li>
            ))}
          </ol>
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
