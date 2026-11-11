import { CalendarPlus, Check, Clock, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/cn'
import { CLUBS, OUTLINE } from './ob-data'
import { Stage, StageLabel, StepCopy } from './ObParts'
import { beam } from './ob-beam'

/* ── Moodle: watch how it works, decide later ─────────────────────────────── */

export function StepMoodle({ choice, setChoice }: { choice: 'yes' | 'later' | null; setChoice: (c: 'yes' | 'later') => void }) {
  return (
    <>
      <StepCopy
        label="Moodle"
        title="Your profs post deadlines on Moodle. Bring them in."
        sub="Paste one link from Moodle and those deadlines show up here on their own, and stay in sync when a prof moves a date."
        note="It takes about a minute, and you can do it any time in Settings."
      />
      <Stage className="!p-3 sm:!p-4">
        <div className="overflow-hidden rounded-2xl border border-border bg-black">
          <video
            src="/moodle/setup.mp4"
            poster="/moodle/setup-poster.jpg"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-label="Connecting Moodle, start to finish"
            className="block aspect-video w-full object-cover"
          />
        </div>
        <p className="mt-2.5 flex items-center gap-1.5 px-1 text-[12.5px] text-subtle">
          <RefreshCw size={12} aria-hidden /> The whole setup, start to finish. We never see your Moodle password.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setChoice('yes')}
            aria-pressed={choice === 'yes'}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold transition-all duration-200',
              beam(choice === null),
              choice === 'yes' ? 'bg-accent text-accent-contrast' : 'border border-border-strong text-fg hover:bg-surface-2',
            )}
          >
            {choice === 'yes' && <Check size={14} strokeWidth={3} className="ct-ob-check" aria-hidden />}
            {choice === 'yes' ? 'We will set it up next' : 'Yes, connect Moodle'}
          </button>
          <button
            type="button"
            onClick={() => setChoice('later')}
            aria-pressed={choice === 'later'}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-[13.5px] font-semibold transition-all duration-200',
              choice === 'later' ? 'border-accent/40 bg-accent-soft text-accent' : 'border-border text-muted hover:text-fg',
            )}
          >
            <Clock size={14} aria-hidden /> {choice === 'later' ? 'We will remind you' : 'Maybe later'}
          </button>
        </div>
      </Stage>
    </>
  )
}

/* ── Today: tick things off ───────────────────────────────────────────────── */

export function StepTick({ ticked, toggle }: { ticked: Set<string>; toggle: (id: string) => void }) {
  const items = OUTLINE.slice(0, 3)
  const done = items.filter((i) => ticked.has(i.id)).length
  return (
    <>
      <StepCopy
        label="Today"
        title="Open the app. See what is due. Tick it off."
        sub="Today shows only what needs you right now, soonest first. That is the whole daily routine."
      />
      <Stage>
        <StageLabel right={`${done} of ${items.length} done`}>Due this week</StageLabel>
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out" style={{ width: `${(done / items.length) * 100}%` }} />
        </div>
        <ul className="space-y-2">
          {items.map((o, i) => {
            const on = ticked.has(o.id)
            return (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => toggle(o.id)}
                  aria-pressed={on}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all duration-300',
                    beam(done === 0 && i === 0),
                    on ? 'border-accent/40 bg-accent-soft/50' : 'border-border bg-canvas hover:border-border-strong',
                  )}
                >
                  <span className={cn('relative grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors duration-200', on ? 'border-accent bg-accent text-accent-contrast' : 'border-border-strong')}>
                    {on && <Check size={13} strokeWidth={3.5} className="ct-ob-check" aria-hidden />}
                    {on && <span className="ct-ob-ring pointer-events-none absolute inset-0 rounded-full border-2 border-accent" aria-hidden />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-[15px] font-medium transition-colors duration-300', on ? 'text-subtle line-through' : 'text-fg')}>{o.title}</span>
                    <span className="block text-[12px] text-subtle">COMM 305 · {o.kind} · {o.weight}%</span>
                  </span>
                  <span className={cn('shrink-0 text-[13px] font-semibold', on ? 'text-success' : 'text-fg')}>{on ? 'Done' : `Due ${o.due}`}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </Stage>
    </>
  )
}

/* ── Social: what is happening on campus ──────────────────────────────────── */

export function StepSocial({ following, toggle }: { following: Set<string>; toggle: (id: string) => void }) {
  const feed = CLUBS.filter((c) => following.has(c.id))
  return (
    <>
      <StepCopy
        label="Social"
        title="See what is happening on campus this week."
        sub="Follow clubs and their events land in your feed. One tap puts an event in your calendar, and you can message classmates and share your schedule."
      />
      <Stage>
        <StageLabel>Clubs at Concordia</StageLabel>
        <ul className="space-y-1.5">
          {CLUBS.map((c, i) => {
            const on = following.has(c.id)
            return (
              <li key={c.id} className="flex items-center gap-3 rounded-2xl border border-border bg-canvas px-3 py-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl text-[12px] font-bold text-white" style={{ backgroundColor: c.color }} aria-hidden>
                  {c.glyph}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-fg">{c.name}</span>
                  <span className="block truncate text-[12px] text-subtle">{c.handle}</span>
                </span>
                <button
                  type="button"
                  onClick={() => toggle(c.id)}
                  aria-pressed={on}
                  className={cn(
                    'shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-all duration-200',
                    beam(following.size === 0 && i === 0),
                    on ? 'border border-border text-muted' : 'bg-accent text-accent-contrast',
                  )}
                >
                  {on ? 'Following' : 'Follow'}
                </button>
              </li>
            )
          })}
        </ul>
        <div className="mt-3 min-h-[96px] rounded-2xl border border-dashed border-border-strong p-3">
          <StageLabel>Your feed</StageLabel>
          {feed.length === 0 ? (
            <p className="text-[13px] text-subtle">Follow a club and its next event shows up here.</p>
          ) : (
            <ul className="space-y-1.5">
              {feed.map((c) => (
                <li key={c.id} className="ct-ob-rise flex items-center gap-2.5 rounded-xl bg-surface-2/60 px-3 py-2">
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: c.color }} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-fg">{c.event}</span>
                    <span className="block truncate text-[12px] text-subtle">{c.name} · {c.when}</span>
                  </span>
                  <CalendarPlus size={15} className="shrink-0 text-accent" aria-hidden />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Stage>
    </>
  )
}
