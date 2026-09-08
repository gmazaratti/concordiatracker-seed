import { useRef, useState } from 'react'
import { FileText, Loader2, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  CHOICE_QUESTIONS,
  EMPTY,
  MAX_OUTLINES,
  MAX_OUTLINE_MB,
  OUTLINE_TYPES,
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
  onDone: (answers: PublicSurveyAnswers, code: string | null) => void
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
      const code = await submitPublicSurvey(a)
      onDone(a, code)
    } catch {
      setError('Couldn’t send that: please try again.')
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

        {/* The cold-start ask. Last, and unmistakably optional: it is the
            biggest thing on the page, and putting it earlier would cost
            answers from everyone who does not have their syllabi to hand. */}
        <OutlineDrop
          files={a.files}
          onChange={(files) => setA((p) => ({ ...p, files }))}
        />

        {/* Signed-out visitors only: an existing user already has an account. */}
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


/**
 * "Got your outlines on you?"
 *
 * The cold-start problem in one control. The app is about to meet its first
 * real users with almost nothing in it, and a survey handed out in a library is
 * the one moment a hundred students are already holding their syllabi.
 *
 * Deliberately quiet about what it is worth to us. It says what happens to the
 * file and what the student gets, and it is skippable in the most obvious way
 * possible — no default state, no red asterisk, no nag if it is left empty.
 */
function OutlineDrop({
  files,
  onChange,
}: {
  files: File[]
  onChange: (files: File[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  const add = (picked: FileList | null) => {
    if (!picked) return
    const next = [...files]
    for (const f of Array.from(picked)) {
      if (next.length >= MAX_OUTLINES) break
      if (f.size > MAX_OUTLINE_MB * 1024 * 1024) continue
      if (next.some((x) => x.name === f.name && x.size === f.size)) continue
      next.push(f)
    }
    onChange(next)
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <p className="text-[14px] leading-snug font-medium text-fg">
        Got a course outline on you? <span className="text-subtle">(optional)</span>
      </p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-subtle">
        Drop in any syllabus PDF and we&rsquo;ll turn it into a shared outline for everyone else in
        your section — dates, weights, the lot. It&rsquo;s the fastest way to make this useful for
        the people sitting next to you.
      </p>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong px-3 py-3 text-[13px] font-medium text-muted transition-colors duration-150 hover:border-accent hover:text-fg"
      >
        <Upload size={15} aria-hidden />
        {files.length ? 'Add another' : 'Choose a file'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={OUTLINE_TYPES}
        multiple
        className="hidden"
        onChange={(e) => {
          add(e.target.files)
          e.target.value = ''
        }}
      />

      {files.length > 0 && (
        <ul className="mt-2.5 space-y-1.5">
          {files.map((f) => (
            <li
              key={`${f.name}-${f.size}`}
              className="flex items-center gap-2 rounded-lg bg-canvas px-2.5 py-1.5"
            >
              <FileText size={14} aria-hidden className="shrink-0 text-subtle" />
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-fg">{f.name}</span>
              <button
                type="button"
                onClick={() => onChange(files.filter((x) => x !== f))}
                aria-label={`Remove ${f.name}`}
                className="shrink-0 text-subtle transition-colors duration-150 hover:text-danger"
              >
                <X size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2.5 text-[11.5px] leading-relaxed text-subtle">
        PDF or Word, up to {MAX_OUTLINE_MB} MB each. We only publish the dates and weights &mdash;
        never your name, and never the file itself.
      </p>
    </section>
  )
}
