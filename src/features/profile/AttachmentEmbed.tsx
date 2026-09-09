import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  CalendarPlus,
  CalendarRange,
  Clock,
  Download,
  ExternalLink,
  FileText,
  MapPin,
  PartyPopper,
} from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { useCommunity } from '@/features/community/useCommunity'
import { useAppData } from '@/app/providers/app-data'
import { EventMedia } from '@/features/community/EventMedia'
import { OrgLogo } from '@/features/community/OrgLogo'
import { VerifiedBadge } from '@/features/community/VerifiedBadge'
import { formatDueDateTime } from '@/lib/date'
import { courseColor } from '@/lib/course-color'
import type { Attachment, SharedClass } from '@/lib/social'
import { cn } from '@/lib/cn'
import { colorForCodes, drawSchedule, imageSize } from './schedule-image'

/**
 * What a sent thing looks like in a conversation.
 *
 * A line of text with a chevron was doing the job of a link and nothing else,
 * so a shared schedule read as less than a screenshot would have — which is the
 * thing it is supposed to replace. Each kind gets a card that shows enough to
 * be useful WITHOUT opening it, and opening it gives the actions that belong to
 * that kind rather than one generic "go here".
 */
export function AttachmentEmbed({
  attachment,
  mine,
}: {
  attachment: Attachment
  mine: boolean
}) {
  const [open, setOpen] = useState(false)
  const { events } = useCommunity()

  if (attachment.kind === 'event') {
    const event = events.find((e) => e.id === attachment.id)
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-1.5 block w-full overflow-hidden rounded-xl border border-border bg-canvas text-left transition-transform duration-150 hover:scale-[1.01]"
        >
          {event ? (
            <>
              <div className="h-24 w-full">
                <EventMedia event={event} variant="thumb" />
              </div>
              <div className="p-2.5">
                <div className="flex items-center gap-1.5">
                  <OrgLogo org={event.org} className="size-4 shrink-0 rounded" />
                  <span className="min-w-0 truncate text-[10.5px] text-subtle">
                    {event.org.name}
                  </span>
                  {event.org.verified && <VerifiedBadge size={11} />}
                </div>
                <p className="mt-1 line-clamp-2 text-[12.5px] font-medium text-fg">
                  {event.title}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-subtle">
                  <Clock size={10} aria-hidden />
                  {formatDueDateTime(event.start)}
                </p>
                {event.location && (
                  <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-subtle">
                    <MapPin size={10} className="shrink-0" aria-hidden />
                    {event.location}
                  </p>
                )}
              </div>
            </>
          ) : (
            // The event was pulled, or belongs to an org that has gone. Saying
            // so beats a card that renders as an empty frame.
            <p className="p-2.5 text-[11.5px] text-subtle">
              <PartyPopper size={12} className="mr-1 inline" aria-hidden />
              {attachment.title} — this event is no longer listed.
            </p>
          )}
        </button>
        {open && event && (
          <EventActions
            id={event.id}
            title={event.title}
            onClose={() => setOpen(false)}
          />
        )}
      </>
    )
  }

  if (attachment.kind === 'schedule') {
    const classes = attachment.classes ?? []
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-1.5 block w-full overflow-hidden rounded-xl border border-border bg-canvas p-2.5 text-left transition-transform duration-150 hover:scale-[1.01]"
        >
          <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-fg">
            <CalendarRange size={13} className="shrink-0 text-accent" aria-hidden />
            <span className="min-w-0 truncate">{attachment.name}</span>
          </p>
          <p className="mt-0.5 text-[11px] text-subtle">
            {classes.length} class{classes.length === 1 ? '' : 'es'}
            {attachment.hours ? ` · ${attachment.hours} hours a week` : ''}
          </p>
          {classes.length > 0 && <MiniWeek classes={classes} />}
        </button>
        {open && (
          <SchedulePreview attachment={attachment} mine={mine} onClose={() => setOpen(false)} />
        )}
      </>
    )
  }

  if (attachment.kind === 'course') {
    const hex = courseColor(attachment.color ?? 'blue').hex
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-1.5 flex w-full overflow-hidden rounded-xl border border-border bg-canvas text-left transition-transform duration-150 hover:scale-[1.01]"
        >
          <span className="w-1 shrink-0" style={{ backgroundColor: hex }} aria-hidden />
          <span className="min-w-0 flex-1 p-2.5">
            <span className="flex items-center gap-1.5">
              <BookOpen size={13} className="shrink-0" style={{ color: hex }} aria-hidden />
              <span className="text-[12.5px] font-semibold text-fg">{attachment.code}</span>
              {attachment.credits ? (
                <span className="text-[10.5px] text-subtle">{attachment.credits} cr</span>
              ) : null}
            </span>
            {attachment.title && (
              <span className="mt-0.5 block truncate text-[11.5px] text-subtle">
                {attachment.title}
              </span>
            )}
          </span>
        </button>
        {open && <CourseActions attachment={attachment} onClose={() => setOpen(false)} />}
      </>
    )
  }

  return (
    <Link
      to="/app/courses/blueprints"
      className="mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-canvas px-2.5 py-2 text-[11.5px] transition-opacity hover:opacity-85"
    >
      <FileText size={13} className="shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate">Outline · {attachment.code}</span>
      <ExternalLink size={11} className="shrink-0 opacity-70" aria-hidden />
    </Link>
  )
}

/** A tiny five-column glance, so the card says something before it is opened. */
function MiniWeek({ classes }: { classes: SharedClass[] }) {
  const colorOf = useMemo(() => colorForCodes(classes.map((c) => c.code)), [classes])
  const blocks = useMemo(() => {
    const out: { day: number; top: number; h: number; code: string }[] = []
    for (const c of classes) {
      for (const m of c.meets.split(/[;\n]/)) {
        const match = /(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/.exec(m)
        if (!match) continue
        const from = Number(match[1]) * 60 + Number(match[2])
        const to = Number(match[3]) * 60 + Number(match[4])
        const days = ['mon', 'tue', 'wed', 'thu', 'fri']
        days.forEach((d, i) => {
          if (m.toLowerCase().includes(d)) {
            out.push({
              day: i,
              top: Math.max(0, ((from - 480) / 600) * 100),
              h: Math.max(6, ((to - from) / 600) * 100),
              code: c.code,
            })
          }
        })
      }
    }
    return out
  }, [classes])

  return (
    <span className="mt-2 grid h-14 grid-cols-5 gap-px overflow-hidden rounded border border-border bg-surface-2">
      {[0, 1, 2, 3, 4].map((d) => (
        <span key={d} className="relative block bg-canvas">
          {blocks
            .filter((b) => b.day === d)
            .map((b, i) => (
              <span
                key={i}
                className="absolute inset-x-px block rounded-[2px]"
                style={{
                  top: `${b.top}%`,
                  height: `${b.h}%`,
                  backgroundColor: colorOf(b.code),
                  opacity: 0.75,
                }}
              />
            ))}
        </span>
      ))}
    </span>
  )
}

/**
 * The whole week, big, with the two things you actually do with someone else's
 * schedule: look at it, and keep a picture of it.
 *
 * Importing is deliberately NOT the headline. Somebody else's timetable is not
 * yours to adopt wholesale, and the reason people screenshot these is to glance
 * at them later.
 */
function SchedulePreview({
  attachment,
  mine,
  onClose,
}: {
  attachment: Extract<Attachment, { kind: 'schedule' }>
  mine: boolean
  onClose: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Memoised so the draw effect does not re-run on every render — a canvas
  // redraw per keystroke elsewhere on the page is a lot of work for nothing.
  const classes = useMemo(() => attachment.classes ?? [], [attachment.classes])
  const sent = useMemo(
    () => (attachment.sentAt ? new Date(attachment.sentAt) : null),
    [attachment.sentAt],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    drawSchedule(canvas, classes, {
      title: attachment.name,
      subtitle: sent
        ? `As of ${sent.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}`
        : 'Shared on ConcordiaTracker',
      colorOf: colorForCodes(classes.map((c) => c.code)),
    })
  }, [attachment.name, classes, sent])

  function save() {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `${attachment.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const { width } = imageSize(classes)

  return (
    <ModalShell label={attachment.name} onClose={onClose} widthClass="sm:max-w-3xl">
      <div className="p-4 sm:p-5">
        <h2 className="font-display text-[17px] font-medium text-fg">{attachment.name}</h2>
        <p className="mt-0.5 text-[12px] text-subtle">
          {classes.length} class{classes.length === 1 ? '' : 'es'}
          {attachment.hours ? ` · ${attachment.hours} hours a week` : ''}
          {sent
            ? ` · as it was on ${sent.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
            : ''}
        </p>

        <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-white p-1">
          <canvas ref={canvasRef} style={{ maxWidth: '100%', width }} />
        </div>

        <ul className="mt-3 grid gap-1 sm:grid-cols-2">
          {classes.map((c, i) => (
            <li key={`${c.code}-${i}`} className="flex items-baseline gap-2 text-[12px]">
              <span className="font-medium text-fg">{c.code}</span>
              <span className="min-w-0 flex-1 truncate text-subtle">
                {c.meets || 'No set time'}
                {c.room ? ` · ${c.room}` : ''}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={save}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
          >
            <Download size={14} aria-hidden />
            Save as image
          </button>
          {/* Only offered on your OWN schedule: "open in the builder" cannot
              open a row you are not allowed to read. */}
          {mine && (
            <Link
              to="/app/planner?tab=schedule"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px] text-muted transition-colors duration-150 hover:border-accent hover:text-fg"
            >
              <CalendarRange size={14} aria-hidden />
              Open in schedule builder
            </Link>
          )}
        </div>
      </div>
    </ModalShell>
  )
}

function CourseActions({
  attachment,
  onClose,
}: {
  attachment: Extract<Attachment, { kind: 'course' }>
  onClose: () => void
}) {
  const { courses } = useAppData()
  const have = courses.some((c) => c.code.trim().toUpperCase() === attachment.code.toUpperCase())
  const mine = courses.find((c) => c.code.trim().toUpperCase() === attachment.code.toUpperCase())

  return (
    <ModalShell label={attachment.code} onClose={onClose} widthClass="sm:max-w-sm">
      <div className="p-4 sm:p-5">
        <p className="text-[11px] font-semibold tracking-wide text-subtle uppercase">Class</p>
        <h2 className="mt-0.5 font-display text-[18px] font-medium text-fg">{attachment.code}</h2>
        {attachment.title && <p className="mt-0.5 text-[13px] text-muted">{attachment.title}</p>}

        <div className="mt-4 space-y-2">
          {have && mine ? (
            <Row
              to={`/app/courses/${mine.id}`}
              onClose={onClose}
              icon={BookOpen}
              title="Open this class"
              body="You are already taking it."
            />
          ) : (
            <>
              <Row
                to={`/app/courses/blueprints?course=${encodeURIComponent(attachment.code)}`}
                onClose={onClose}
                icon={FileText}
                title="Find an outline"
                body="Import its dates and weights in one click, if somebody has shared one."
              />
              <Row
                to="/app/courses"
                onClose={onClose}
                icon={CalendarPlus}
                title="Add it to my courses"
                body="Adds the class; you pick the section yourself."
              />
            </>
          )}
          <Row
            to={`/app/planner?tab=directory&q=${encodeURIComponent(attachment.code)}`}
            onClose={onClose}
            icon={ExternalLink}
            title="Look it up"
            body="Description, prerequisites and when it runs."
          />
        </div>
      </div>
    </ModalShell>
  )
}

function EventActions({
  id,
  title,
  onClose,
}: {
  id: string
  title: string
  onClose: () => void
}) {
  return (
    <ModalShell label={title} onClose={onClose} widthClass="sm:max-w-sm">
      <div className="p-4 sm:p-5">
        <p className="text-[11px] font-semibold tracking-wide text-subtle uppercase">Event</p>
        <h2 className="mt-0.5 font-display text-[18px] font-medium text-fg">{title}</h2>
        <div className="mt-4 space-y-2">
          <Row
            to={`/app/community?event=${id}`}
            onClose={onClose}
            icon={PartyPopper}
            title="Open the event"
            body="Full details, and add it to your calendar."
          />
          <Row
            to={`/e/${id}`}
            onClose={onClose}
            icon={ExternalLink}
            title="Public link"
            body="Opens for anyone, account or not."
          />
        </div>
      </div>
    </ModalShell>
  )
}

function Row({
  to,
  onClose,
  icon: Icon,
  title,
  body,
}: {
  to: string
  onClose: () => void
  icon: typeof BookOpen
  title: string
  body: string
}) {
  return (
    <Link
      to={to}
      onClick={onClose}
      className={cn(
        'flex items-start gap-3 rounded-xl border border-border bg-surface px-3.5 py-2.5',
        'transition-colors duration-150 hover:border-accent',
      )}
    >
      <Icon size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-fg">{title}</span>
        <span className="block text-[11.5px] leading-relaxed text-subtle">{body}</span>
      </span>
    </Link>
  )
}
