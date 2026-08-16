import { Check, CircleHelp, X } from 'lucide-react'
import { checkPrereq, parsePrereq, type Term } from '@/lib/prereq'
import { cn } from '@/lib/cn'

/**
 * A prerequisite, coloured against what you have actually finished.
 *
 * GATED on a complete record. Colouring against a half-entered history is worse
 * than not colouring at all: it would tell someone in red that they are missing
 * COMP 248 when the truth is they took it and have not typed it in yet, and red
 * is the kind of answer people act on. So the caller decides whether the record
 * is trustworthy, and until it is, this shows the sentence with no verdict.
 */
export function PrereqChips({
  prerequisites,
  completed,
  credits,
  /** False until the student says their history is complete. */
  trusted,
}: {
  prerequisites: string | null
  completed: Set<string>
  credits: number
  trusted: boolean
}) {
  if (!prerequisites?.trim()) return null

  const parsed = parsePrereq(prerequisites)
  const result = checkPrereq(prerequisites, { completed, credits })

  return (
    <div>
      <p className="text-[11px] font-semibold tracking-wide text-subtle uppercase">Prerequisites</p>

      {/* Concordia's own sentence, always. The chips are a reading of it, not a
          replacement for it. */}
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{prerequisites}</p>

      {parsed.terms.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {parsed.terms.map((term, i) => (
            <TermChip
              key={i}
              term={term}
              completed={completed}
              trusted={trusted}
            />
          ))}
        </div>
      )}

      {parsed.antirequisites.length > 0 && (
        <p className="mt-2 text-[11.5px] text-warning">
          Cannot be taken with credit for {parsed.antirequisites.join(', ')}
        </p>
      )}

      {trusted && (
        <p
          className={cn(
            'mt-2 text-[11.5px] font-medium',
            result.verdict === 'met' && 'text-success',
            result.verdict === 'not-met' && 'text-danger',
            result.verdict === 'blocked' && 'text-danger',
            result.verdict === 'unknown' && 'text-subtle',
          )}
        >
          {result.verdict === 'met' && 'You meet these prerequisites.'}
          {result.verdict === 'not-met' && 'You do not meet these yet.'}
          {result.verdict === 'blocked' && result.notes[0]}
          {result.verdict === 'unknown' &&
            'Partly depends on something we cannot check, such as permission or an equivalent.'}
        </p>
      )}

      {!trusted && (
        <p className="mt-2 text-[11.5px] text-subtle">
          Mark your record complete in My record to see which of these you have met.
        </p>
      )}
    </div>
  )
}

function TermChip({
  term,
  completed,
  trusted,
}: {
  term: Term
  completed: Set<string>
  trusted: boolean
}) {
  const satisfied = term.alternatives.some((a) => a.code !== null && completed.has(a.code))
  // An alternative with no course code ("or equivalent", a Cegep course) cannot
  // be checked, so an unsatisfied term containing one is amber, not red: we do
  // not know that it is unmet, only that we cannot confirm it.
  const uncheckable = term.alternatives.some((a) => a.code === null)
  const state = !trusted ? 'neutral' : satisfied ? 'met' : uncheckable ? 'unknown' : 'missing'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium',
        state === 'met' && 'border-success/50 bg-success/10 text-success',
        state === 'missing' && 'border-danger/50 bg-danger/10 text-danger',
        state === 'unknown' && 'border-warning/50 bg-warning/10 text-warning',
        state === 'neutral' && 'border-border text-muted',
      )}
    >
      {state === 'met' && <Check size={11} aria-hidden />}
      {state === 'missing' && <X size={11} aria-hidden />}
      {state === 'unknown' && <CircleHelp size={11} aria-hidden />}
      {term.alternatives.map((a) => a.text).join(' or ')}
      {term.concurrent && <span className="opacity-70">(can be concurrent)</span>}
    </span>
  )
}
