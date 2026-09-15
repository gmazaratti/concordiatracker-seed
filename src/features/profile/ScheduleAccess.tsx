import { useEffect, useState } from 'react'
import { CalendarRange, Loader2, Lock, Send } from 'lucide-react'
import {
  canSeeSchedule,
  friendSchedule,
  requestSchedule,
  type Attachment,
  type FriendCourse,
} from '@/lib/social'
import { cn } from '@/lib/cn'
import { SchedulePreview } from './AttachmentEmbed'

/**
 * Somebody else's timetable: view it, or ask for it.
 *
 * Before this there was only half a feature — if they had shared it you saw a
 * list, and if they had not, the section simply did not render. So the common
 * case, "I want to know when they are free and they have not turned it on",
 * showed you nothing and offered you nothing, which is indistinguishable from
 * the feature not existing.
 *
 * Both states are now visible and both do something. What is NOT leaked: the
 * server answers the same way whether you are not their friend or they have it
 * switched off, so this can never be used to probe someone's settings — the
 * button says "ask", not "they have it off".
 *
 * Times and rooms only. Never a grade, not even for a friend.
 */
type State =
  | { phase: 'loading' }
  | { phase: 'shared'; rows: FriendCourse[] }
  | { phase: 'hidden' }

export function ScheduleAccess({
  handle,
  name,
  compact = false,
}: {
  handle: string
  name?: string | null
  /** The chat rail: one line, no card, no inline list. */
  compact?: boolean
}) {
  const [state, setState] = useState<State>({ phase: 'loading' })
  const [open, setOpen] = useState(false)
  const [asked, setAsked] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)

  // Reset DURING RENDER when the handle changes, tracked in state — an effect
  // that setStates on mount renders twice and trips react-hooks/set-state-in-effect.
  const [shownFor, setShownFor] = useState(handle)
  if (shownFor !== handle) {
    setShownFor(handle)
    setState({ phase: 'loading' })
    setAsked(null)
  }

  useEffect(() => {
    let alive = true
    void canSeeSchedule(handle).then(async (ok) => {
      if (!alive) return
      if (!ok) {
        setState({ phase: 'hidden' })
        return
      }
      const rows = await friendSchedule(handle)
      if (!alive) return
      setState(rows.length > 0 ? { phase: 'shared', rows } : { phase: 'hidden' })
    })
    return () => {
      alive = false
    }
  }, [handle])

  async function ask() {
    if (asking) return
    setAsking(true)
    const err = await requestSchedule(handle)
    setAsking(false)
    setAsked(err ?? `Asked ${name ?? '@' + handle}. It will be in your conversation.`)
  }

  if (state.phase === 'loading') {
    return compact ? null : (
      <p className="mt-6 flex items-center gap-2 border-t border-border pt-5 text-[12.5px] text-subtle">
        <Loader2 size={14} className="animate-spin" aria-hidden />
        Checking their schedule
      </p>
    )
  }

  const shared = state.phase === 'shared'

  const action = shared ? (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg bg-accent font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover',
        compact ? 'w-full justify-center px-2.5 py-1.5 text-[12px]' : 'px-3 py-1.5 text-[12.5px]',
      )}
    >
      <CalendarRange size={13} aria-hidden />
      View schedule
    </button>
  ) : (
    <button
      type="button"
      onClick={() => void ask()}
      disabled={asking || asked !== null}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border border-border text-muted transition-colors duration-150 hover:border-accent hover:text-fg disabled:opacity-60',
        compact ? 'w-full justify-center px-2.5 py-1.5 text-[12px]' : 'px-3 py-1.5 text-[12.5px]',
      )}
    >
      {asking ? (
        <Loader2 size={13} className="animate-spin" aria-hidden />
      ) : (
        <Send size={13} aria-hidden />
      )}
      Request schedule
    </button>
  )

  if (compact) {
    return (
      <>
        <div className="mt-3 border-t border-border pt-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">
            {shared ? <CalendarRange size={11} aria-hidden /> : <Lock size={11} aria-hidden />}
            Schedule
          </p>
          {action}
          {asked && <p className="mt-1.5 text-[11px] leading-relaxed text-subtle">{asked}</p>}
        </div>
        {open && state.phase === 'shared' && (
          <SchedulePreview
            attachment={asAttachment(handle, name, state.rows)}
            mine={false}
            onClose={() => setOpen(false)}
          />
        )}
      </>
    )
  }

  return (
    <section className="mt-6 border-t border-border pt-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="flex min-w-0 flex-1 items-center gap-2 text-[13.5px] font-semibold text-fg">
          {shared ? (
            <CalendarRange size={15} className="shrink-0 text-accent" aria-hidden />
          ) : (
            <Lock size={15} className="shrink-0 text-subtle" aria-hidden />
          )}
          Their schedule
          {shared && (
            <span className="text-[12px] font-normal text-subtle">
              {state.rows.length} class{state.rows.length === 1 ? '' : 'es'}
            </span>
          )}
        </h2>
        {action}
      </div>

      <p className="mt-1 text-[11.5px] leading-relaxed text-subtle">
        {shared
          ? 'Shared with friends. Times and rooms only — never grades.'
          : 'Not shared with you. Asking sends them a message; they decide.'}
      </p>
      {asked && <p className="mt-1.5 text-[12px] text-accent">{asked}</p>}

      {shared && (
        <ul className="mt-2.5 space-y-1.5">
          {state.rows.map((c, i) => (
            <li
              key={`${c.code}-${i}`}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-lg border border-border bg-surface px-3 py-2"
            >
              <span className="text-[12.5px] font-semibold text-fg">{c.code}</span>
              <span className="min-w-0 flex-1 truncate text-[12px] text-muted">{c.title}</span>
              <span className="text-[11.5px] text-subtle">
                {c.meeting_times || 'No set time'}
                {c.location ? ` · ${c.location}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}

      {open && state.phase === 'shared' && (
        <SchedulePreview
          attachment={asAttachment(handle, name, state.rows)}
          mine={false}
          onClose={() => setOpen(false)}
        />
      )}
    </section>
  )
}

/** Their rows in the shape the week renderer already speaks, so viewing a
 *  friend's timetable reuses the same sheet a sent one opens into rather than
 *  being a second drawing of the same thing. NOT stamped `sentAt`: this is
 *  live, and dating it would imply a snapshot. */
function asAttachment(
  handle: string,
  name: string | null | undefined,
  rows: FriendCourse[],
): Extract<Attachment, { kind: 'schedule' }> {
  return {
    kind: 'schedule',
    id: `friend-${handle}`,
    name: `${name ?? '@' + handle} · schedule`,
    classes: rows.map((c) => ({
      code: c.code,
      meets: c.meeting_times ?? '',
      room: c.location ?? undefined,
    })),
  }
}
