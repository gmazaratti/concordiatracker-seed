import { useEffect, useState } from 'react'
import {
  ArrowDownWideNarrow,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Eye,
  Link2,
  MapPin,
  Pin,
  Search,
  SquareMousePointer,
} from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { cn } from '@/lib/cn'

/**
 * A walkthrough of the things in here that are not obvious.
 *
 * Everything in this builder that is genuinely worth knowing is a gesture or a
 * side effect: dragging blocks time, right-clicking opens a menu, the eye
 * hides without deleting, generating can build on top of what you already have.
 * None of those announce themselves, and a feature nobody finds may as well not
 * exist — so this is a short, dismissible tour rather than a help page nobody
 * opens.
 *
 * One idea per card, each with a small drawn illustration built from the same
 * tokens as the real thing, so what you are shown looks like what you will see.
 */
interface Tip {
  icon: typeof Pin
  title: string
  body: string
  art: React.ReactNode
}

const TIPS: Tip[] = [
  {
    icon: CalendarRange,
    title: 'Start with the term',
    body: 'The term picker beside the schedule name scopes the whole page — search, the week, and everything the generator considers. Change it and you are planning a different semester, with nothing lost from this one.',
    art: <TermArt />,
  },
  {
    icon: Search,
    title: 'Find a class, see the seats',
    body: 'Search by code or by name. Each section shows how it meets, where, and how many seats were open when it was read. Adding one puts it on the week immediately — nothing is registered anywhere.',
    art: <SearchArt />,
  },
  {
    icon: SquareMousePointer,
    title: 'Block the time that is already yours',
    body: 'Drag down an empty column to carve out a shift, a commute or a standing appointment. Everything you generate afterwards works around it. On a phone, type it in Filters instead — a drag there is a scroll.',
    art: <BlockArt />,
  },
  {
    icon: Pin,
    title: 'Right-click a class',
    body: 'Pin it so regenerating never moves it, hide it from the week, see its room and seat counts, or take it off. The menu acts on the block under your cursor, so there is no hunting for the matching row.',
    art: <MenuArt />,
  },
  {
    icon: Eye,
    title: 'Hide without deleting',
    body: 'The eye takes a class off the grid but keeps it in this schedule. It is how you try an alternative in the same hour without losing the one you already had — and how you get it back in one click.',
    art: <EyeArt />,
  },
  {
    icon: MapPin,
    title: 'Say where you are willing to be',
    body: 'Loyola, Sir George Williams, online, or any mix. Generating then only considers sections on the campuses you ticked. Sections whose campus Concordia did not publish stay in, because a gap in our reading should not delete your options.',
    art: <CampusArt />,
  },
  {
    icon: ArrowDownWideNarrow,
    title: 'Generate the shape of week you want',
    body: 'Most days off, mornings, mid-day, evenings, shortest days, most or least time on campus. Credits still come first — a pretty nine-credit week is not an answer to “give me fifteen” — and you can build on what you already have instead of starting fresh.',
    art: <PreferArt />,
  },
  {
    icon: Link2,
    title: 'Keep it, print it, share it',
    body: 'Save as many drafts as you like and switch between them. Print gives you the week with room numbers under it. Share makes a link anyone can open — it does not say whose it is, and they can save a copy of their own.',
    art: <ShareArt />,
  },
]

export function ScheduleTips({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0)
  const tip = TIPS[i]
  const Icon = tip.icon

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setI((n) => Math.min(n + 1, TIPS.length - 1))
      if (e.key === 'ArrowLeft') setI((n) => Math.max(n - 1, 0))
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <ModalShell label="Schedule builder tips" onClose={onClose} widthClass="sm:max-w-lg">
      <div className="p-4 sm:p-5">
        <div className="grid h-40 place-items-center overflow-hidden rounded-xl border border-border bg-canvas">
          {tip.art}
        </div>

        <h2 className="mt-4 flex items-center gap-2 font-display text-[17px] font-medium text-fg">
          <Icon size={15} className="shrink-0 text-accent" aria-hidden />
          {tip.title}
        </h2>
        {/* Fixed height so the card does not jump as you page through it. */}
        <p className="mt-1.5 min-h-[66px] text-[12.5px] leading-relaxed text-muted">{tip.body}</p>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setI((n) => Math.max(n - 1, 0))}
            disabled={i === 0}
            aria-label="Previous tip"
            className="grid size-8 shrink-0 place-items-center rounded-lg border border-border text-muted transition-colors duration-150 hover:text-fg disabled:opacity-40"
          >
            <ChevronLeft size={15} aria-hidden />
          </button>

          <span className="flex flex-1 justify-center gap-1.5">
            {TIPS.map((t, n) => (
              <button
                key={t.title}
                type="button"
                onClick={() => setI(n)}
                aria-label={`Tip ${n + 1}: ${t.title}`}
                aria-current={n === i}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-200',
                  n === i ? 'w-5 bg-accent' : 'w-1.5 bg-border-strong hover:bg-subtle',
                )}
              />
            ))}
          </span>

          {i === TIPS.length - 1 ? (
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
            >
              Got it
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setI((n) => n + 1)}
              aria-label="Next tip"
              className="grid size-8 shrink-0 place-items-center rounded-lg border border-border text-muted transition-colors duration-150 hover:text-fg"
            >
              <ChevronRight size={15} aria-hidden />
            </button>
          )}
        </div>
      </div>
    </ModalShell>
  )
}

/* ── Illustrations ──────────────────────────────────────────────────────────
   Drawn from the same tokens as the real interface rather than screenshotted,
   so they cannot go stale the way an image of a UI does. */

function Frame({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('w-[236px]', className)}>{children}</div>
}

/** A stand-in for a class rectangle on the week. */
function Slot({
  className,
  style,
  children,
}: {
  className?: string
  style?: React.CSSProperties
  children?: React.ReactNode
}) {
  return (
    <span
      className={cn('block rounded-[3px] bg-accent-soft text-[7px] text-accent', className)}
      style={style}
    >
      {children}
    </span>
  )
}

function MiniWeek({ children }: { children?: React.ReactNode }) {
  return (
    <div className="relative grid h-[92px] grid-cols-5 gap-px overflow-hidden rounded-lg border border-border bg-surface">
      {[0, 1, 2, 3, 4].map((d) => (
        <div key={d} className="relative border-r border-border/60 last:border-r-0" />
      ))}
      {children}
    </div>
  )
}

function TermArt() {
  return (
    <Frame>
      <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1.5">
        <span className="flex-1 text-[9px] font-semibold text-fg">My schedule</span>
        <span className="rounded border border-accent bg-accent-soft px-1.5 py-0.5 text-[8px] text-accent">
          Fall 2026
        </span>
      </div>
      <div className="mt-1.5 flex gap-1">
        {['Fall 2026', 'Winter 2027', 'Summer 2027'].map((t, n) => (
          <span
            key={t}
            className={cn(
              'rounded px-1.5 py-1 text-[7.5px]',
              n === 0 ? 'bg-accent-soft text-accent' : 'bg-surface text-subtle',
            )}
          >
            {t}
          </span>
        ))}
      </div>
    </Frame>
  )
}

function SearchArt() {
  return (
    <Frame>
      <div className="rounded-lg border border-accent bg-surface px-2 py-1.5 text-[8.5px] text-fg">
        COMM 225
      </div>
      {[
        ['A · LEC', 'Mon · Wed 10:15', '12 seats'],
        ['B · LEC', 'Tue · Thu 13:15', 'Full · 4 waiting'],
      ].map(([s, when, seats], n) => (
        <div
          key={s}
          className="mt-1 flex items-baseline gap-1.5 rounded-lg border border-border bg-surface px-2 py-1.5"
        >
          <span className="text-[8px] font-medium text-fg">{s}</span>
          <span className="flex-1 text-[7.5px] text-subtle">{when}</span>
          <span className={cn('text-[7.5px]', n === 0 ? 'text-success' : 'text-warning')}>
            {seats}
          </span>
        </div>
      ))}
    </Frame>
  )
}

function BlockArt() {
  return (
    <Frame>
      <MiniWeek>
        <span
          className="pointer-events-none absolute rounded border border-accent bg-accent-soft"
          style={{ left: '40.5%', right: '39.5%', top: 26, bottom: 14 }}
        >
          <span className="block px-1 pt-0.5 text-[7px] font-medium text-accent">16:00–19:00</span>
        </span>
        <span
          className="pointer-events-none absolute size-2.5 rounded-full border-2 border-accent bg-canvas"
          style={{ left: '58%', top: 74 }}
        />
      </MiniWeek>
      <p className="mt-1.5 text-center text-[7.5px] text-subtle">Drag · “Work”</p>
    </Frame>
  )
}

function MenuArt() {
  return (
    <Frame className="flex gap-1.5">
      <div className="flex-1">
        <MiniWeek>
          <Slot
            className="pointer-events-none absolute px-1 pt-0.5"
            style={{ left: '1%', right: '61%', top: 16, height: 26 }}
          >
            COMP 248
          </Slot>
        </MiniWeek>
      </div>
      <div className="w-[104px] shrink-0 self-start rounded-lg border border-border bg-surface py-1 shadow-lg">
        {['Pin this one', 'Hide from week', 'Details'].map((l) => (
          <span key={l} className="block px-2 py-[3px] text-[7.5px] text-muted">
            {l}
          </span>
        ))}
        <span className="mt-0.5 block border-t border-border px-2 pt-[3px] pb-[2px] text-[7.5px] text-danger">
          Remove
        </span>
      </div>
    </Frame>
  )
}

function EyeArt() {
  return (
    <Frame>
      {[
        ['COMP 248', true],
        ['SOEN 287', false],
      ].map(([code, shown]) => (
        <div
          key={String(code)}
          className={cn(
            'mt-1 flex items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1.5',
            !shown && 'opacity-55',
          )}
        >
          <span className="size-2 rounded-full bg-accent" aria-hidden />
          <span className="flex-1 text-[8.5px] text-fg">{code}</span>
          {shown ? (
            <Eye size={10} className="text-subtle" aria-hidden />
          ) : (
            <span className="flex items-center gap-1 text-[7.5px] text-subtle">
              hidden
              <Eye size={10} className="text-accent" aria-hidden />
            </span>
          )}
        </div>
      ))}
      <p className="mt-1.5 text-center text-[7.5px] text-subtle">Still in the schedule</p>
    </Frame>
  )
}

function CampusArt() {
  return (
    <Frame className="flex gap-1.5">
      {[
        ['SGW', true],
        ['Loyola', false],
        ['Online', true],
      ].map(([label, on]) => (
        <span
          key={String(label)}
          className={cn(
            'flex-1 rounded-lg border px-2 py-2 text-center text-[8px]',
            on ? 'border-accent bg-accent-soft text-accent' : 'border-border text-subtle',
          )}
        >
          <MapPin size={11} className="mx-auto mb-1" aria-hidden />
          {label}
        </span>
      ))}
    </Frame>
  )
}

function PreferArt() {
  return (
    <Frame>
      <div className="rounded-lg border border-border bg-surface px-2 py-1.5 text-[8.5px] text-fg">
        Most days off
      </div>
      <div className="mt-1.5">
        <MiniWeek>
          {[
            [0, 12, 22],
            [0, 44, 30],
            [2, 20, 34],
          ].map(([col, top, h], n) => (
            <Slot
              key={n}
              className="pointer-events-none absolute"
              style={{
                left: `${Number(col) * 20 + 1}%`,
                width: '18%',
                top: Number(top),
                height: Number(h),
              }}
            />
          ))}
        </MiniWeek>
      </div>
      <p className="mt-1.5 text-center text-[7.5px] text-subtle">15 credits · 3 days off</p>
    </Frame>
  )
}

function ShareArt() {
  return (
    <Frame>
      <div className="rounded-lg border border-accent/40 bg-accent-soft px-2 py-1.5">
        <span className="block truncate text-[8px] text-fg">
          concordiatracker.com/s/7fa2c1
        </span>
      </div>
      <div className="mt-1.5 flex gap-1">
        {['Fall draft A', 'Fall draft B', 'No 8ams'].map((n, x) => (
          <span
            key={n}
            className={cn(
              'rounded border px-1.5 py-1 text-[7.5px]',
              x === 0 ? 'border-accent bg-accent-soft text-accent' : 'border-border text-subtle',
            )}
          >
            {n}
          </span>
        ))}
      </div>
    </Frame>
  )
}
