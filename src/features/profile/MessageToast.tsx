import { useNavigate } from 'react-router-dom'
import { PersonAvatar } from '@/features/community/PersonAvatar'
import { dismissMessageAlert, useMessageAlert } from '@/lib/message-toast'

/**
 * The banner that drops from the top when a message arrives.
 *
 * GLASS, and the blur is on this element because nothing inside it moves —
 * the opposite of the bottom bar, where the filter had to be lifted onto a
 * sibling because it was an ancestor of the sliding rows and forced a
 * re-composite every frame. Here the text swaps in place and the surface is
 * still, so one blurred layer is computed once.
 *
 * TWO LINES, HARD. The point of the cap is that a long message must not make
 * the banner taller, because a banner that resizes while a second message
 * lands is exactly the "re-pops and moves" the coalescing exists to prevent.
 * The box reserves both lines whether or not they are used, so it is the same
 * height from the first frame to the last.
 *
 * It sits below the safe area and below the mobile header, and it is `fixed`
 * with a z above the app chrome but below a modal — a message is not more
 * important than the dialog you are in the middle of.
 */
export function MessageToast() {
  const alert = useMessageAlert()
  const navigate = useNavigate()
  if (!alert) return null

  const open = () => {
    dismissMessageAlert()
    // Straight into that conversation, not into the list. "Click to see the
    // whole thing" and "click to reply" are the same click.
    navigate(
      alert.handle
        ? `/app/community?c=messages&chat=${encodeURIComponent(alert.handle)}`
        : '/app/community?c=messages',
    )
  }

  return (
    <div
      /* Mounted only while a banner is open, so `ct-toast-in` cannot replay:
         a coalesced message re-renders this element, it does not remount it. */
      className="ct-toast-in fixed inset-x-0 top-[env(safe-area-inset-top)] z-[45] flex justify-center px-3 pt-2"
      role="status"
      aria-live="polite"
    >
      <button
        type="button"
        onClick={open}
        className="flex w-full max-w-sm items-center gap-3 rounded-2xl border border-white/15 bg-surface/70 px-3 py-2.5 text-left shadow-2xl backdrop-blur-xl backdrop-saturate-[180%] transition-transform duration-150 active:scale-[0.98]"
      >
        <PersonAvatar
          person={{ handle: alert.handle ?? '', name: alert.name, avatar_url: alert.avatar }}
          className="size-9 shrink-0"
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-fg">
              {alert.name}
            </span>
            {alert.extra > 0 && (
              <span className="shrink-0 text-[11px] text-subtle">+{alert.extra} more</span>
            )}
          </span>
          {/*
            A FIXED TWO LINES, not a minimum. `h-[2.1rem]` is exactly two
            lines of `leading-[1.05rem]`, so a one-word message and a
            paragraph produce the same box and the banner cannot resize while
            a second message lands on it — which is the half of "does not
            re-pop or move" that coalescing alone does not buy.

            `line-clamp-2`, not hand-written arbitrary properties: the first
            version paired `block` with `[display:-webkit-box]` and the core
            utility won the cascade, so the clamp silently did nothing and the
            box grew to 131px. Measured, not assumed.
          */}
          <span className="mt-0.5 h-[2.1rem] text-[12.5px] leading-[1.05rem] text-muted line-clamp-2">
            {alert.body}
          </span>
        </span>
      </button>
    </div>
  )
}
