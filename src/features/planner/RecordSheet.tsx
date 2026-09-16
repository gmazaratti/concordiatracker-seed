import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  Check,
  ChevronLeft,
  Copy,
  Download,
  Image as ImageIcon,
  Printer,
  Send,
  X,
} from 'lucide-react'
import { useModalDismiss } from '@/app/hooks/useModalDismiss'
import { drawRecord, recordImageHeight, RECORD_IMAGE_WIDTH } from './record-image'
import {
  recordFilename,
  recordToCsv,
  recordToText,
  type RecordSnapshot,
} from '@/lib/record-export'
import { communityHref } from '@/features/community/sections'

/**
 * The record as a sheet you can take away.
 *
 * Full-screen, because this is a document rather than a dialog: the point is
 * to see the whole thing at once, the way whoever you hand it to will.
 *
 * FOUR WAYS OUT, and they are deliberately different jobs rather than four
 * buttons for one. Print is for an advising appointment or a form. CSV is for
 * a spreadsheet, and it is the only lossless one. Copy is for pasting into an
 * email in three seconds. Send is for the classmate who asked what you have
 * already taken — that one goes through the app, so they get a live card
 * rather than a screenshot that will be wrong by December.
 *
 * NO GRADES ARE HIDDEN AND NONE ARE ADDED: this shows exactly what your record
 * holds. It is your own data leaving on your own instruction, so the only rule
 * is that it must be accurate and dated.
 */
export function RecordSheet({
  snapshot,
  own,
  onClose,
}: {
  snapshot: RecordSnapshot
  /** Yours, so it can offer to send it. A received one is read-only. */
  own: boolean
  onClose: () => void
}) {
  const { ref, onKeyDown } = useModalDismiss<HTMLDivElement>(onClose)
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)

  function print() {
    // The class scopes the print stylesheet to this sheet: everything else on
    // the page is hidden, and the header/footer of the overlay with it.
    document.body.classList.add('ct-printing')
    const done = () => document.body.classList.remove('ct-printing')
    window.addEventListener('afterprint', done, { once: true })
    window.print()
    // Safari never fires afterprint for some flows, so clean up regardless.
    window.setTimeout(done, 1000)
  }

  function download() {
    const blob = new Blob([recordToCsv(snapshot)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = recordFilename(snapshot, 'csv')
    a.click()
    URL.revokeObjectURL(url)
  }

  /**
   * The record as a PNG.
   *
   * Drawn at 2x and scaled down, because the reason to want an image is to put
   * it somewhere else — a message, a story — and a 1x canvas of 13px text
   * turns to mush the moment anything resamples it.
   */
  function savePng() {
    const canvas = document.createElement('canvas')
    const height = recordImageHeight(snapshot)
    const scale = 2
    canvas.width = RECORD_IMAGE_WIDTH * scale
    canvas.height = height * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(scale, scale)
    drawRecord(ctx, snapshot, RECORD_IMAGE_WIDTH)
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = recordFilename(snapshot, 'png')
      a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(recordToText(snapshot))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked — the other three exports still work */
    }
  }

  const dated = new Date(snapshot.generatedAt).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return createPortal(
    <div
      ref={ref}
      onKeyDown={onKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label="Academic record"
      tabIndex={-1}
      className="ct-print-root fixed inset-0 z-[80] flex flex-col bg-canvas"
    >
      <header className="ct-print-hide flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
        >
          <ChevronLeft size={16} aria-hidden />
          Back
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium text-fg">Academic record</p>
          <p className="truncate text-[11.5px] text-subtle">
            {snapshot.courseCount} course{snapshot.courseCount === 1 ? '' : 's'} ·{' '}
            {snapshot.credits} credits · as of {dated}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid size-9 shrink-0 place-items-center rounded-lg text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
        >
          <X size={18} aria-hidden />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-5">
          <article className="ct-print-sheet rounded-2xl border border-border bg-surface p-5 sm:p-7">
            <h1 className="font-display text-[22px] leading-tight font-semibold text-fg">
              {snapshot.name}
            </h1>
            <p className="mt-0.5 text-[13px] text-subtle">
              {[
                snapshot.handle ? `@${snapshot.handle}` : '',
                snapshot.program ?? '',
                snapshot.year ? `Year ${snapshot.year}` : '',
                snapshot.minor ? `Minor in ${snapshot.minor}` : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Credits" value={String(snapshot.credits)} />
              <Stat label="Courses" value={String(snapshot.courseCount)} />
              <Stat
                label="GPA"
                value={snapshot.gpa === null ? '—' : snapshot.gpa.toFixed(2)}
                note={
                  snapshot.gpa === null
                    ? 'no graded courses'
                    : `over ${snapshot.gradedCredits} graded credits`
                }
              />
              <Stat label="Terms" value={String(snapshot.terms.length)} />
            </div>

            {snapshot.terms.length === 0 ? (
              <p className="mt-6 rounded-xl border border-dashed border-border px-4 py-8 text-center text-[12.5px] text-subtle">
                Nothing in your record yet. Add a finished course and it appears here.
              </p>
            ) : (
              <div className="mt-6 space-y-5">
                {snapshot.terms.map((t) => (
                  <section key={t.term}>
                    <h2 className="mb-1.5 flex items-baseline justify-between gap-2 border-b border-border pb-1 text-[12px] font-semibold tracking-wide text-subtle uppercase">
                      {t.term}
                      <span className="font-normal normal-case">{t.credits} credits</span>
                    </h2>
                    <ul>
                      {t.courses.map((c, i) => (
                        <li
                          key={`${c.code}-${i}`}
                          className="flex items-baseline gap-3 border-b border-border/60 py-1.5 last:border-0"
                        >
                          <span className="w-[5.5rem] shrink-0 text-[12.5px] font-semibold text-fg">
                            {c.code}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[12.5px] text-muted">
                            {c.title}
                          </span>
                          <span className="w-10 shrink-0 text-right text-[12px] text-subtle tabular-nums">
                            {c.credits}
                          </span>
                          {/* A dash, not a blank: an empty cell reads as a
                              missing grade rather than a course that never
                              carried one. */}
                          <span className="w-8 shrink-0 text-right text-[12.5px] font-medium text-fg">
                            {c.letter ?? '—'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}

            <p className="mt-6 border-t border-border pt-3 text-[11px] text-subtle">
              Exported from ConcordiaTracker on {dated}. Self-reported — not an official
              transcript.
            </p>
          </article>
        </div>
      </div>

      <footer className="ct-print-hide flex shrink-0 flex-wrap gap-2 border-t border-border px-4 py-3">
        <button
          type="button"
          onClick={print}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
        >
          <Printer size={14} aria-hidden />
          Print or save as PDF
        </button>
        <button
          type="button"
          onClick={download}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px] text-muted transition-colors duration-150 hover:border-accent hover:text-fg"
        >
          <Download size={14} aria-hidden />
          Download CSV
        </button>
        <button
          type="button"
          onClick={savePng}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px] text-muted transition-colors duration-150 hover:border-accent hover:text-fg"
        >
          <ImageIcon size={14} aria-hidden />
          Save as PNG
        </button>
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px] text-muted transition-colors duration-150 hover:border-accent hover:text-fg"
        >
          {copied ? <Check size={14} className="text-accent" aria-hidden /> : <Copy size={14} aria-hidden />}
          {copied ? 'Copied' : 'Copy as text'}
        </button>
        {own && (
          <button
            type="button"
            onClick={() => {
              onClose()
              navigate(`${communityHref('messages')}&attach=record`)
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px] text-muted transition-colors duration-150 hover:border-accent hover:text-fg"
          >
            <Send size={14} aria-hidden />
            Send to a classmate
          </button>
        )}
      </footer>
    </div>,
    document.body,
  )
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-border bg-canvas px-3 py-2.5">
      <p className="text-[11px] tracking-wide text-subtle uppercase">{label}</p>
      <p className="mt-0.5 font-display text-[19px] leading-none font-semibold text-fg">{value}</p>
      {note && <p className="mt-1 text-[10.5px] leading-tight text-subtle">{note}</p>}
    </div>
  )
}
