import { Repeat2 } from 'lucide-react'
import { Switch } from '@/features/settings/controls'
import { cn } from '@/lib/cn'

/**
 * Cross-posting: the same announcement, in the other place it belongs.
 *
 * WHY IT IS A SWITCH AND NOT A SECOND FORM. A club that has just written an
 * event has already said everything the post needs — the title, the date, the
 * picture. Asking them to type it again in another tab is how the two drift,
 * and why most clubs just do not bother with one of them.
 *
 * THE POST LINKS THE EVENT, it does not copy it. `org_posts.event_id` means
 * the card in the feed can always show the event as it is NOW: a time that
 * moves, moves in both places. A copied description is wrong the first time
 * anybody edits the original.
 *
 * IT DOES NOT FIRE UNTIL SAVE. Ticking this on a draft nobody has saved would
 * publish a post about an event that does not exist yet.
 */
export function CrossPostRow({
  on,
  onChange,
  error,
  title,
  blocked,
}: {
  on: boolean
  onChange: (v: boolean) => void
  error?: string
  title: string
  /** Why it cannot be ticked, in the user's words. Empty = it can. */
  blocked?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3.5 py-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
          <Repeat2 size={16} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-medium text-fg">Also post this to the feed</p>
          <p className="mt-0.5 text-[11.5px] leading-snug text-subtle">
            {title.trim()
              ? `A card for “${title.trim()}” appears in Community alongside your other posts. It links the event, so a change of time shows in both.`
              : 'A card appears in Community alongside your other posts, linking this event.'}
          </p>
        </div>
        <div className={cn('shrink-0 pt-0.5', blocked && 'pointer-events-none opacity-40')}>
          <Switch
            checked={on && !blocked}
            onChange={(v) => !blocked && onChange(v)}
            label="Also post this to the feed"
          />
        </div>
      </div>
      {/* SAID BEFORE THE SAVE, NOT AFTER IT. A switch that looks available and
          then reports a constraint violation teaches people the feature is
          broken; one that explains itself teaches them to add a banner. */}
      {blocked && <p className="mt-2 text-[11.5px] text-subtle">{blocked}</p>}
      {error && <p className="mt-2 text-[11.5px] text-danger">{error}</p>}
    </div>
  )
}
