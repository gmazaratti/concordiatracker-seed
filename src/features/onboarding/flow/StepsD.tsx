import { useState } from 'react'
import { CalendarPlus, Check, Clock, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/cn'
import { percentToGrade } from '@/lib/gpa'
import { useCommunity } from '@/features/community/useCommunity'
import { OrgLogo } from '@/features/community/OrgLogo'
import { useFollows } from '@/app/providers/follows'
import { MoodleStep } from '../MoodleStep'
import { OUTLINE, readGrade } from './ob-data'
import { Stage, StageLabel, StepCopy } from './ObParts'
import { beam } from './ob-beam'

/* ── Moodle: watch how it works, connect now or later ─────────────────────── */

export function StepMoodle({
  choice,
  setChoice,
  onConnected,
}: {
  choice: 'yes' | 'later' | null
  setChoice: (c: 'yes' | 'later') => void
  onConnected: () => void
}) {
  return (
    <>
      <StepCopy
        label="Moodle"
        title="Your profs post deadlines on Moodle. Bring them in."
        sub="Paste one link from Moodle and those deadlines show up here on their own, and stay in sync when a prof moves a date."
        note="It takes about a minute. You can also do it any time in Settings."
      />
      <Stage className="!p-3 sm:!p-4">
        {choice === 'yes' ? (
          <div className="ct-ob-rise px-1 py-1">
            <MoodleStep onConnected={onConnected} />
          </div>
        ) : (
          <>
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
              <RefreshCw size={12} className="shrink-0" aria-hidden /> The whole setup, start to finish. We never see your Moodle password.
            </p>
          </>
        )}
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
            {choice === 'yes' ? 'Connecting below' : 'Yes, connect Moodle'}
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

/* ── Today: tick it off, then the grade prompt ────────────────────────────── */

export function StepTick({ ticked, toggle }: { ticked: Set<string>; toggle: (id: string) => void }) {
  const items = OUTLINE.slice(0, 3)
  const done = items.filter((i) => ticked.has(i.id)).length
  const [grade, setGrade] = useState('')
  const [saved, setSaved] = useState(false)
  const pct = readGrade(grade)
  const lastTicked = items.find((i) => ticked.has(i.id))
  return (
    <>
      <StepCopy
        label="Today"
        title="Open the app. See what is due. Tick it off."
        sub="Today shows only what needs you right now, soonest first. Tick something off and it asks for your grade, so your standing is always current."
      />
      <Stage>
        <StageLabel right={`${done} of ${items.length} done`}>Due this week · sample</StageLabel>
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
                    on ? 'border-accent/40 bg-accent-soft/50' : 'border-border bg-canvas hover:border-border-strong',
                  )}
                >
                  {/* The light is on the circle itself: that is the thing to press. */}
                  <span
                    className={cn(
                      'grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors duration-200',
                      beam(done === 0 && i === 0),
                      on ? 'border-accent bg-accent text-accent-contrast' : 'border-border-strong',
                    )}
                  >
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

        {lastTicked && (
          <div className="ct-ob-rise mt-3 rounded-2xl border border-accent/40 bg-accent-soft/40 p-3.5">
            <p className="text-[13.5px] font-semibold text-fg">Nice. How did {lastTicked.title} go?</p>
            {saved && pct !== null ? (
              <p className="ct-ob-pop mt-2 text-[13px] text-success">
                Saved: {Math.round(pct)}%, {/^[AF]/.test(percentToGrade(pct).letter) ? 'an' : 'a'} {percentToGrade(pct).letter}. Next: what that means for the rest of the term.
              </p>
            ) : (
              <div className="mt-2 flex items-center gap-2">
                <span className={cn('block rounded-xl', beam(!grade))}>
                  <input
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    inputMode="decimal"
                    placeholder="17/20 or 85"
                    aria-label="Your grade"
                    className="w-32 rounded-xl border border-border bg-canvas px-3 py-2 text-center text-[15px] font-semibold text-fg outline-none placeholder:font-normal placeholder:text-subtle focus:border-accent"
                  />
                </span>
                <button type="button" disabled={pct === null} onClick={() => setSaved(true)} className="rounded-xl bg-accent px-3.5 py-2 text-[13px] font-semibold text-accent-contrast transition-opacity duration-200 disabled:opacity-40">
                  Save
                </button>
                <span className="text-[12px] text-subtle">or skip it</span>
              </div>
            )}
          </div>
        )}
      </Stage>
    </>
  )
}

/* ── Social: real clubs, real follows ─────────────────────────────────────── */

export function StepSocial({ onFollowed }: { onFollowed: () => void }) {
  const { orgs, events } = useCommunity()
  const { isFollowing, toggleFollow } = useFollows()
  const [now] = useState(() => Date.now())
  // Clubs with a real logo first, then verified ones: faces make the list.
  const clubs = [...orgs].sort((a, b) => Number(!!b.logo) - Number(!!a.logo) || Number(b.verified) - Number(a.verified)).slice(0, 4)
  const anyFollowed = clubs.some((c) => isFollowing(c.handle))
  const feed = clubs
    .filter((c) => isFollowing(c.handle))
    .map((c) => ({
      club: c,
      next: events.filter((e) => e.org.handle === c.handle && new Date(e.start).getTime() > now).sort((a, b) => a.start.localeCompare(b.start))[0],
    }))
  const when = (iso: string) => new Intl.DateTimeFormat('en-CA', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
  return (
    <>
      <StepCopy
        label="Social"
        title="See what is happening on campus this week."
        sub="Follow clubs and their events land in your feed. One tap puts an event in your calendar, and you can message classmates and share your schedule."
      />
      <Stage>
        <StageLabel>Clubs at Concordia</StageLabel>
        {clubs.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-subtle">Loading clubs…</p>
        ) : (
          <ul className="space-y-1.5">
            {clubs.map((c, i) => {
              const on = isFollowing(c.handle)
              return (
                <li
                  key={c.handle}
                  className="ct-ob-drop flex items-center gap-3 rounded-2xl border border-border bg-canvas px-3 py-2.5"
                  style={{ '--d': `${200 + i * 140}ms` } as React.CSSProperties}
                >
                  <OrgLogo org={c} className="size-10" rounded="rounded-xl" textClass="text-[12px]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-fg">{c.name}</span>
                    <span className="block truncate text-[12px] text-subtle">{c.handle}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      toggleFollow(c.handle)
                      if (!on) onFollowed()
                    }}
                    aria-pressed={on}
                    className={cn(
                      'shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-all duration-200',
                      beam(!on && !anyFollowed),
                      on ? 'border border-border text-muted' : 'bg-accent text-accent-contrast',
                    )}
                  >
                    {on ? 'Following' : 'Follow'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <div className="mt-3 min-h-[92px] rounded-2xl border border-dashed border-border-strong p-3">
          <StageLabel>Your feed</StageLabel>
          {feed.length === 0 ? (
            <p className="text-[13px] text-subtle">Follow a club and its next event shows up here.</p>
          ) : (
            <ul className="space-y-1.5">
              {feed.map(({ club, next }) => (
                <li key={club.handle} className="ct-ob-rise flex items-center gap-2.5 rounded-xl bg-surface-2/60 px-3 py-2">
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: club.color }} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-fg">{next ? next.title : `You follow ${club.name}`}</span>
                    <span className="block truncate text-[12px] text-subtle">{next ? `${club.name} · ${when(next.start)}` : 'Their next event will show up here.'}</span>
                  </span>
                  {next && <CalendarPlus size={15} className="shrink-0 text-accent" aria-hidden />}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Stage>
    </>
  )
}
