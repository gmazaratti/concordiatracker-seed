import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { CalendarRange, Download, MapPin, X } from 'lucide-react'
import { useModalDismiss } from '@/app/hooks/useModalDismiss'
import type { Attachment, SharedClass } from '@/lib/social'
import { coursesByCodes } from '@/lib/catalog'
import { cn } from '@/lib/cn'
import { colorForCodes, drawSchedule, type ScheduleHit } from './schedule-image'
import { themeSheet } from './sheet-palette'

/**
 * Somebody's week, as a POPUP: a centred card on a desktop, a sheet on a
 * phone, with the page still visible behind it. It used to take the whole
 * screen, which is a lot of ceremony for a glance.
 *
 * Every class is tappable, on the grid or in the list: tapping one says what
 * it is (the course title comes from the catalogue, since a shared schedule
 * only carries codes), when it meets and where.
 */
export function SchedulePreview({
  attachment,
  mine,
  onClose,
}: {
  attachment: Extract<Attachment, { kind: 'schedule' }>
  /** Your own schedule: offers "open in the builder". */
  mine: boolean
  onClose: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const classes = useMemo(() => attachment.classes ?? [], [attachment.classes])
  const sent = useMemo(() => (attachment.sentAt ? new Date(attachment.sentAt) : null), [attachment.sentAt])
  const { ref, onKeyDown } = useModalDismiss<HTMLDivElement>(onClose)
  const [hits, setHits] = useState<ScheduleHit[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [titles, setTitles] = useState<Record<string, string>>({})

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const h = drawSchedule(canvas, classes, {
      title: attachment.name,
      subtitle: sent
        ? `As of ${sent.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}`
        : 'Shared on ConcordiaTracker',
      colorOf: colorForCodes(classes.map((c) => c.code)),
      palette: themeSheet(),
    })
    // Kept for tapping; the canvas is drawn at 900px and scaled to fit.
    const id = window.setTimeout(() => setHits(h), 0)
    return () => window.clearTimeout(id)
  }, [attachment.name, classes, sent])

  // Course titles for whatever is on the grid, once.
  useEffect(() => {
    let alive = true
    const codes = [...new Set(classes.map((c) => c.code))]
    void coursesByCodes(codes).then((rows) => {
      if (!alive) return
      const map: Record<string, string> = {}
      for (const r of rows) map[`${r.subject} ${r.catalog}`] = r.title
      setTitles(map)
    })
    return () => {
      alive = false
    }
  }, [classes])

  function onCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scale = 900 / rect.width
    const x = (e.clientX - rect.left) * scale
    const y = (e.clientY - rect.top) * scale
    const hit = hits.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h)
    setSelected(hit ? hit.code : null)
  }

  function save() {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `${attachment.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const picked: SharedClass[] = selected ? classes.filter((c) => c.code === selected) : []

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={ref}
        onKeyDown={onKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label={attachment.name}
        tabIndex={-1}
        className="ct-animate-pop flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-surface shadow-2xl sm:max-h-[86dvh] sm:max-w-3xl sm:rounded-2xl"
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold text-fg">{attachment.name}</p>
            <p className="truncate text-[11.5px] text-subtle">
              {classes.length} class{classes.length === 1 ? '' : 'es'}
              {attachment.hours ? ` · ${attachment.hours} hours a week` : ''} · tap a class to see what it is
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-9 shrink-0 place-items-center rounded-lg text-subtle hover:bg-surface-2 hover:text-fg"
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="overflow-hidden rounded-xl border border-border bg-canvas p-1.5">
            <canvas ref={canvasRef} onClick={onCanvasClick} className="block h-auto w-full cursor-pointer" />
          </div>

          {picked.length > 0 && (
            <div className="ct-animate-pop mt-3 rounded-xl border border-accent/40 bg-accent-soft/40 px-3.5 py-3">
              <p className="text-[14px] font-semibold text-fg">
                {selected}
                {titles[selected!] && <span className="font-normal text-muted"> · {titles[selected!]}</span>}
              </p>
              {picked.map((c, i) => (
                <p key={i} className="mt-1 flex flex-wrap items-center gap-x-3 text-[12.5px] text-muted">
                  <span>{c.meets || 'No set time'}</span>
                  {c.section && <span>Section {c.section}</span>}
                  {c.room && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={12} aria-hidden /> {c.room}
                    </span>
                  )}
                </p>
              ))}
            </div>
          )}

          <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {classes.map((c, i) => (
              <li key={`${c.code}-${i}`}>
                <button
                  type="button"
                  onClick={() => setSelected(selected === c.code ? null : c.code)}
                  className={cn(
                    'flex w-full items-baseline gap-2 rounded-lg border px-3 py-2 text-left transition-colors duration-150',
                    selected === c.code ? 'border-accent bg-accent-soft/40' : 'border-border bg-canvas hover:border-accent/60',
                  )}
                >
                  <span className="text-[12.5px] font-semibold text-fg">{c.code}</span>
                  <span className="min-w-0 flex-1 truncate text-[11.5px] text-subtle">
                    {titles[c.code] ?? (c.meets || 'No set time')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <footer className="flex shrink-0 flex-wrap gap-2 border-t border-border px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3">
          <button
            type="button"
            onClick={save}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-accent-contrast hover:bg-accent-hover"
          >
            <Download size={14} aria-hidden />
            Save as image
          </button>
          {mine && (
            <Link
              to="/app/planner?tab=schedule"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px] text-muted hover:border-accent hover:text-fg"
            >
              <CalendarRange size={14} aria-hidden />
              Open in schedule builder
            </Link>
          )}
        </footer>
      </div>
    </div>,
    document.body,
  )
}
