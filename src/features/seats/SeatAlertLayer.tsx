import { useCallback, useEffect, useState } from 'react'
import { BellRing, Check, Copy, ExternalLink } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { ackSeatAlert, mySeatAlerts, termLabel, type SeatAlert } from '@/lib/seats'

/**
 * A seat opened. Say so, loudly.
 *
 * This is the one place in the app that earns an unprompted modal. A seat in a
 * full section can vanish in minutes, the student explicitly asked to be told,
 * and there is exactly one useful action to take. A toast in the corner loses
 * that race; a badge they notice on Thursday is worthless.
 *
 * It only appears when a watched section is open AND unacknowledged, so it can
 * never nag: dismissing marks it seen server-side and it will not return unless
 * the section fills and opens again.
 */

/** Where the class number is actually typed. The Student Centre lives behind a
 *  login inside the hub, so the hub is as deep as a link can honestly go. */
const STUDENT_HUB = 'https://www.concordia.ca/students.html'

const POLL_MS = 60_000

export function SeatAlertLayer() {
  const [alerts, setAlerts] = useState<SeatAlert[]>([])

  const refresh = useCallback(() => {
    void mySeatAlerts().then(setAlerts)
  }, [])

  useEffect(() => {
    refresh()
    const id = window.setInterval(() => {
      // Nothing to see while the tab is hidden, and polling a backgrounded tab
      // is just noise on their bill and ours.
      if (document.visibilityState === 'visible') refresh()
    }, POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  const current = alerts[0]
  if (!current) return null

  const dismiss = () => {
    setAlerts((prev) => prev.slice(1))
    void ackSeatAlert(current.id)
  }

  return <SeatOpenModal alert={current} remaining={alerts.length - 1} onDismiss={dismiss} />
}

function SeatOpenModal({
  alert,
  remaining,
  onDismiss,
}: {
  alert: SeatAlert
  remaining: number
  onDismiss: () => void
}) {
  const [copied, setCopied] = useState(false)
  const free =
    alert.last_capacity !== null && alert.last_enrollment !== null
      ? Math.max(0, alert.last_capacity - alert.last_enrollment)
      : null
  const course = `${alert.subject} ${alert.catalog}`

  const copy = () => {
    void navigator.clipboard.writeText(alert.class_number).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <ModalShell label={`A seat opened in ${course}`} onClose={onDismiss}>
      <div className="p-5">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-success/15 text-success">
            <BellRing size={18} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-[19px] leading-tight font-semibold text-fg">
              A seat opened in {course}
            </h2>
            <p className="text-[12.5px] text-subtle">
              Section {alert.section} · {termLabel(alert.term_code)}
              {alert.course_title ? ` · ${alert.course_title}` : ''}
            </p>
          </div>
        </div>

        <p className="mt-4 text-[13.5px] leading-relaxed text-muted">
          {free === 1 ? '1 seat is' : `${free ?? 0} seats are`} free right now. Seats in a full
          section go fast, so register before someone else does.
        </p>

        {/* Concordia flags sections that hold seats for specific programs. A
            promise we cannot keep is worse than a caveat nobody enjoys. */}
        {alert.has_reserved && (
          <p className="mt-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-[12.5px] leading-relaxed text-fg">
            Some seats in this section are reserved for specific programs, so an open seat is not
            guaranteed to be one you can take.
          </p>
        )}

        <div className="mt-4 rounded-lg border border-border bg-surface-2 px-3.5 py-3">
          <p className="text-[11px] font-semibold tracking-wide text-subtle uppercase">
            Class number
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-display text-[19px] font-semibold text-fg tabular-nums">
              {alert.class_number}
            </span>
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11.5px] text-muted transition-colors duration-150 hover:text-fg"
            >
              {copied ? <Check size={11} aria-hidden /> : <Copy size={11} aria-hidden />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-subtle">
            In the Student Centre, choose Enter Class Number and paste this.
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          {remaining > 0 && (
            <span className="mr-auto text-[12px] text-subtle">
              {remaining} more {remaining === 1 ? 'seat' : 'seats'} opened
            </span>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg border border-border px-3 py-2 text-[13px] text-muted transition-colors duration-150 hover:text-fg"
          >
            Dismiss
          </button>
          <a
            href={STUDENT_HUB}
            target="_blank"
            rel="noreferrer"
            onClick={onDismiss}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
          >
            Register on the Student Hub
            <ExternalLink size={13} aria-hidden />
          </a>
        </div>
      </div>
    </ModalShell>
  )
}
