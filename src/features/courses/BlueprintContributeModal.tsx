import { useState } from 'react'
import { Check, FileUp, Sparkles } from 'lucide-react'
import type { Course } from '@/data/types'
import { ModalShell } from '@/command/ModalShell'

/** The contributor flow — a Courses action opened from the blueprint browser.
 * The PDF drop is still mock (no real parse), but submitting REALLY shares this
 * course's current outline as a community blueprint (`onSubmit` inserts it into
 * `shared_blueprints`), then shows the theme-credit reward. */
export function BlueprintContributeModal({
  course,
  onSubmit,
  onClose,
}: {
  course: Course
  onSubmit: () => Promise<void> | void
  onClose: () => void
}) {
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (busy) return
    setBusy(true)
    try {
      await onSubmit()
      setSubmitted(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell label={`Contribute a blueprint for ${course.code}`} onClose={onClose}>
      <div className="border-b border-border px-5 py-4">
        <p className="text-[11px] font-medium tracking-wide text-subtle uppercase">
          Contribute · {course.code}
        </p>
        <h2 className="mt-0.5 font-display text-[20px] leading-tight font-medium text-fg">
          {submitted ? 'Thanks for sharing' : 'Share your syllabus'}
        </h2>
      </div>

      {submitted ? (
        <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-success/15 text-success">
            <Check size={26} aria-hidden />
          </span>
          <p className="text-[14px] font-medium text-fg">Your outline is in review</p>
          <p className="max-w-xs text-[13px] text-muted">
            We'll parse it and a TA will confirm the dates. You earned
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-accent-soft px-3 py-1.5 text-[13px] font-semibold text-accent">
            <Sparkles size={15} aria-hidden />
            +50 theme credits
          </span>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
          >
            Done
          </button>
        </div>
      ) : (
        <div className="px-5 py-4">
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface-2/40 px-6 py-8 text-center transition-colors duration-150 hover:border-accent hover:bg-accent-soft/40 disabled:opacity-60"
          >
            <FileUp size={24} className="text-accent" aria-hidden />
            <span className="text-[13px] font-medium text-fg">Share {course.code}'s outline</span>
            <span className="text-[12px] text-subtle">
              your current assessments become a community blueprint
            </span>
          </button>
          <p className="mt-3 text-[12px] text-subtle">
            We share every assessment, weight, and deadline you've added. Shared dates land as
            <span className="text-prov-unverified"> unverified</span> until classmates
            confirm them — contributors earn theme credits.
          </p>
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
              {busy ? 'Sharing…' : 'Share outline'}
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  )
}
