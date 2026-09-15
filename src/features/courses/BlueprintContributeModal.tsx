import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, Check, Share2 } from 'lucide-react'
import type { Course } from '@/data/types'
import { ModalShell } from '@/command/ModalShell'

/**
 * The contributor flow — publish this course's outline to the shared pool.
 *
 * Two things were wrong here and both were about honesty. The submit handler
 * could not fail: `onSubmit` returned void, so an insert rejected by RLS still
 * landed on the success screen. And the success screen described a product that
 * does not exist — "your outline is in review", "a TA will confirm the dates",
 * "+50 theme credits". There is no review queue, no TA, and no credit ledger.
 * A student who shared an outline was told it was being checked by someone and
 * then, correctly, never saw any sign of it.
 *
 * It now reports what actually happens: the outline is public immediately, it
 * is attributed to you, its dates are marked unverified until classmates
 * confirm them, and here is the link to go and look at it.
 */
export function BlueprintContributeModal({
  course,
  onSubmit,
  onClose,
}: {
  course: Course
  itemCount?: number
  onSubmit: () => Promise<void> | void
  onClose: () => void
}) {
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await onSubmit()
      setSubmitted(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sharing failed. Try again in a moment.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell label={`Share ${course.code}'s outline`} onClose={onClose}>
      <div className="border-b border-border px-5 py-4">
        <p className="text-[11px] font-medium tracking-wide text-subtle uppercase">
          Share · {course.code}
        </p>
        <h2 className="mt-0.5 font-display text-[20px] leading-tight font-medium text-fg">
          {submitted ? 'It’s up' : 'Share your outline'}
        </h2>
      </div>

      {submitted ? (
        <div className="flex flex-col items-center gap-3 px-6 py-9 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-success/15 text-success">
            <Check size={26} aria-hidden />
          </span>
          <p className="text-[14px] font-medium text-fg">
            Your {course.code} outline is live for classmates
          </p>
          <p className="max-w-xs text-[13px] text-muted">
            It shows up now when anyone adds {course.code}, under your name. The dates carry an
            <span className="text-prov-unverified"> unverified</span> badge until other students
            confirm them.
          </p>
          <div className="mt-1 flex items-center gap-2">
            <Link
              to={`/app/courses/blueprints?course=${course.id}`}
              onClick={onClose}
              className="rounded-lg border border-border px-3.5 py-2 text-[13px] font-medium text-fg transition-colors hover:bg-surface-2"
            >
              See it
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <div className="px-5 py-4">
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface-2/40 px-6 py-8 text-center transition-colors duration-150 hover:border-accent hover:bg-accent-soft/40 disabled:opacity-60"
          >
            <Share2 size={24} className="text-accent" aria-hidden />
            <span className="text-[13px] font-medium text-fg">Publish {course.code}'s outline</span>
            <span className="text-[12px] text-subtle">
              so the next student adding this class doesn’t start from a blank page
            </span>
          </button>
          <p className="mt-3 text-[12px] leading-relaxed text-subtle">
            Every assessment, weight and deadline on this course becomes public, attributed to your
            name. Your grades are never shared. You can delete it afterwards.
          </p>

          {error && (
            <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-danger/10 px-3 py-2 text-[12.5px] text-danger">
              <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden />
              <span>{error}</span>
            </p>
          )}

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:text-fg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-accent-contrast shadow-sm transition-colors duration-150 hover:bg-accent-hover disabled:opacity-60"
            >
              {busy ? 'Publishing…' : error ? 'Try again' : 'Publish outline'}
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  )
}
