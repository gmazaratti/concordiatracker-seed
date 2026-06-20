import { Check, MessagesSquare, Pencil } from 'lucide-react'
import { AppPreview } from '@/features/landing/AppPreview'
import { Logo } from '@/components/Logo'
import { useAppData } from '@/app/providers/app-data'
import { cn } from '@/lib/cn'

/** Shared slide frame: a visual on top, then a tight headline + a line or two. */
function Slide({ visual, headline, sub, extra }: { visual: React.ReactNode; headline: React.ReactNode; sub: string; extra?: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center text-center">
      {visual}
      <h2 className="mt-6 font-display text-[22px] leading-tight font-semibold text-fg sm:mt-8 sm:text-[30px]">{headline}</h2>
      <p className="mt-2.5 max-w-md text-[13px] leading-relaxed text-muted sm:text-[14px]">{sub}</p>
      {extra}
    </div>
  )
}

export function WelcomeSlide() {
  return (
    <Slide
      visual={<Logo size="lg" />}
      headline={
        <>
          Stop guessing <span className="text-accent">what's due</span>.
        </>
      }
      sub="ConcordiaTracker pulls every deadline and grade into one calm place. Let's set you up in a minute."
    />
  )
}

export function TodaySlide() {
  const { user } = useAppData()
  return (
    <Slide
      visual={<FramedPreview name={user.name} />}
      headline="It all lands on Today"
      sub="Your deadlines surface here automatically, across every course, with your GPA at a glance."
    />
  )
}

export function CalendarSlide() {
  return (
    <Slide
      visual={<CalendarVisual />}
      headline="Your whole term, one calendar"
      sub="See it as a month, week, or agenda. Your deadlines and Concordia's academic dates are toggleable layers — everything at once, or just what's yours."
    />
  )
}

export function EditingSlide() {
  return (
    <Slide
      visual={<EditingVisual />}
      headline="Edit anything, mark as you go"
      sub="Tap an assignment to set its due date, grade, or notes. Check it off when it's done — or mark it late, missed, or awaiting a grade. Overdue is figured out from the date for you."
    />
  )
}

export function DoneSlide() {
  return (
    <Slide
      visual={
        <span className="grid size-16 place-items-center rounded-2xl bg-accent-soft text-accent">
          <Check size={32} aria-hidden />
        </span>
      }
      headline="You're all set"
      sub="That's the spine — the rest you'll pick up as you go. Let's get you to Today."
      extra={
        <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-border bg-surface px-4 py-3 text-left">
          <MessagesSquare size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
          <p className="text-[13px] leading-relaxed text-muted">
            Got an idea? Request a feature any time from your{' '}
            <span className="font-medium text-fg">profile menu → Feedback</span>. We read every one and reply.
          </p>
        </div>
      }
    />
  )
}

/** A small static month-grid mock for the calendar slide (course-color + info
 * dots, two layer chips). Decorative — not the real calendar. */
const CAL_DOTS: Record<number, string[]> = {
  3: ['bg-accent'],
  6: ['bg-info'],
  9: ['bg-accent', 'bg-info'],
  12: ['bg-accent'],
  15: ['bg-info'],
  18: ['bg-accent'],
  20: ['bg-accent', 'bg-info'],
}

function CalendarVisual() {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-4 text-left">
      <div className="flex items-center justify-between">
        <span className="font-display text-[14px] font-semibold text-fg">June 2026</span>
        <div className="flex gap-0.5 rounded-lg border border-border bg-canvas p-0.5">
          {['Month', 'Week', 'Agenda'].map((v, i) => (
            <span key={v} className={cn('rounded-md px-2 py-0.5 text-[10px] font-medium', i === 0 ? 'bg-surface-2 text-fg' : 'text-subtle')}>
              {v}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[9px] text-subtle">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: 21 }).map((_, i) => {
          const day = i + 1
          const today = day === 12
          return (
            <div key={i} className={cn('flex h-9 flex-col rounded-md border p-1', today ? 'border-accent' : 'border-border/60')}>
              <span className={cn('text-[9px] leading-none', today ? 'font-bold text-accent' : 'text-muted')}>{day}</span>
              <span className="mt-auto flex gap-0.5">
                {CAL_DOTS[day]?.map((c, j) => (
                  <span key={j} className={cn('size-1.5 rounded-full', c)} aria-hidden />
                ))}
              </span>
            </div>
          )
        })}
      </div>

      <div className="mt-3 flex items-center gap-4 text-[11px]">
        <span className="inline-flex items-center gap-1.5 text-muted">
          <span className="size-2 rounded-full bg-accent" aria-hidden /> My deadlines
        </span>
        <span className="inline-flex items-center gap-1.5 text-muted">
          <span className="size-2 rounded-full bg-info" aria-hidden /> Concordia
        </span>
      </div>
    </div>
  )
}

/** A small static assessment list for the editing/marking slide. Decorative. */
function EditingVisual() {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-3 text-left">
      <ul className="divide-y divide-border">
        <EditRow title="Assignment 2 — Classes" done meta="Done" tone="text-success" />
        <EditRow title="Quiz 3 — Markets" meta="Due 2 days ago" tone="text-danger" />
        <EditRow title="Midterm exam" meta="Due in 5 days" tone="text-subtle" />
      </ul>
      <p className="mt-2.5 flex items-center gap-1.5 px-1 text-[11px] text-subtle">
        <Pencil size={12} aria-hidden /> Tap any assignment to edit its date, grade, or notes.
      </p>
    </div>
  )
}

function EditRow({ title, meta, tone, done = false }: { title: string; meta: string; tone: string; done?: boolean }) {
  return (
    <li className="flex items-center gap-2.5 py-2">
      <span
        className={cn(
          'grid size-4 shrink-0 place-items-center rounded-full border',
          done ? 'border-accent bg-accent text-accent-contrast' : 'border-border-strong',
        )}
        aria-hidden
      >
        {done && <Check size={11} />}
      </span>
      <span className={cn('min-w-0 flex-1 truncate text-[12px]', done ? 'text-subtle line-through' : 'text-fg')}>{title}</span>
      <span className={cn('shrink-0 text-[11px] font-medium', tone)}>{meta}</span>
    </li>
  )
}

/** The real Today recreation in a browser-chrome frame, clipped with a fade. */
function FramedPreview({ name }: { name?: string }) {
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex items-center gap-1.5 border-b border-border bg-surface-2/60 px-3 py-2">
        <span className="size-2.5 rounded-full bg-border-strong" />
        <span className="size-2.5 rounded-full bg-border-strong" />
        <span className="size-2.5 rounded-full bg-border-strong" />
        <span className="ml-2 truncate text-[11px] text-subtle">concordiatracker.com/today</span>
      </div>
      <div className="relative h-[190px] overflow-hidden sm:h-[300px]">
        <div className="pointer-events-none origin-top scale-[0.78] sm:scale-[0.92]">
          <AppPreview name={name} />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-surface" />
      </div>
    </div>
  )
}
