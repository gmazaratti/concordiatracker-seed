import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, CheckCheck, Plus } from 'lucide-react'
import type { Message } from '@/lib/social'
import { HEART, REACTIONS, type Reaction } from '@/lib/message-extras'
import { AttachmentEmbed } from '../AttachmentEmbed'
import { cn } from '@/lib/cn'

const TIME = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
const LONG_PRESS_MS = 450
const DOUBLE_TAP_MS = 300

export interface Quote {
  who: string
  text: string
}

/**
 * One message, and everything you can do to it.
 *
 * THREE WAYS IN, one per kind of hand: a right-click (desktop), a long press
 * (phone), and — for reacting, the thing done most — a hover "+" on the other
 * person's messages, or a double-click / double-tap for a heart. Each opens or
 * does the same thing; none of them is the only way.
 *
 * Double-click would also select a word, which reads as a glitch next to a
 * heart appearing; `detail > 1` on mousedown is the browser's own count of
 * clicks, so preventing that one keeps a single click selectable.
 */
export function MessageRow({
  m,
  mine,
  grouped,
  avatar,
  quote,
  reactions,
  me,
  tick,
  footer,
  bubbleStyle,
  onMenu,
  onReact,
}: {
  m: Message
  mine: boolean
  grouped: boolean
  /** Their face on the last of a run; null for yours. */
  avatar: React.ReactNode
  quote: Quote | 'missing' | null
  reactions: Reaction[]
  me: string | null
  /** Only when both sides have receipts on. */
  tick: { read: string | null } | null
  footer: string | null
  bubbleStyle?: React.CSSProperties
  onMenu: (x: number, y: number) => void
  onReact: (emoji: string) => void
}) {
  const [picker, setPicker] = useState<{ left: number; top: number } | null>(null)
  const press = useRef<{ t: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null)
  const lastTap = useRef(0)

  const cancelPress = () => {
    if (press.current) clearTimeout(press.current.t)
    press.current = null
  }

  const interactions = {
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault()
      cancelPress()
      onMenu(e.clientX, e.clientY)
    },
    onMouseDown: (e: React.MouseEvent) => {
      if (e.detail > 1) e.preventDefault()
    },
    onDoubleClick: () => onReact(HEART),
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType !== 'touch') return
      const { clientX: x, clientY: y } = e
      press.current = { x, y, t: setTimeout(() => ((press.current = null), onMenu(x, y)), LONG_PRESS_MS) }
    },
    onPointerMove: (e: React.PointerEvent) => {
      const p = press.current
      if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) cancelPress()
    },
    onPointerUp: (e: React.PointerEvent) => {
      const wasPress = !!press.current
      cancelPress()
      if (e.pointerType !== 'touch' || !wasPress) return
      const now = performance.now()
      if (now - lastTap.current < DOUBLE_TAP_MS) {
        lastTap.current = 0
        onReact(HEART)
      } else lastTap.current = now
    },
    onPointerCancel: cancelPress,
  }

  const groups = [...new Set(reactions.map((r) => r.emoji))].map((emoji) => ({
    emoji,
    count: reactions.filter((r) => r.emoji === emoji).length,
    mine: reactions.some((r) => r.emoji === emoji && r.userId === me),
  }))

  return (
    <div className={cn('ct-msg-in flex items-end gap-2', mine ? 'justify-end' : 'justify-start', grouped ? 'mt-1' : 'mt-2.5')}>
      {!mine && avatar}
      <div className={cn('group relative max-w-[78%]', groups.length > 0 && 'mb-3')}>
        {quote && (
          <div className={cn('mb-0.5 max-w-full text-[11.5px] text-subtle', mine ? 'text-right' : 'text-left')}>
            <span className="inline-block max-w-full truncate rounded-2xl border border-border/70 bg-surface/60 px-3 py-1.5 align-bottom">
              {quote === 'missing' ? 'Replying to an earlier message' : `${quote.who}: ${quote.text}`}
            </span>
          </div>
        )}
        <div {...interactions} className="touch-manipulation">
          {m.body.trim() ? (
            <div
              className={cn(
                'rounded-[22px] px-3.5 py-2.5',
                mine ? 'rounded-br-md bg-accent text-accent-contrast' : 'rounded-bl-md border border-border bg-surface-2 text-fg',
              )}
              style={bubbleStyle}
            >
              <p className="text-[15px] leading-[1.35] break-words whitespace-pre-wrap lg:text-[14px]">{m.body}</p>
              {m.attachment && <AttachmentEmbed attachment={m.attachment} mine={mine} />}
            </div>
          ) : (
            m.attachment && <AttachmentEmbed attachment={m.attachment} mine={mine} bare />
          )}
        </div>

        {/* The hover "+": theirs only, and only where there is a hover. */}
        {!mine && (
          <button
            type="button"
            aria-label="React"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              setPicker({ left: Math.max(8, Math.min(r.left - 120, window.innerWidth - 300)), top: Math.max(8, r.top - 46) })
            }}
            className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full border border-border bg-surface text-muted opacity-0 shadow-sm transition-opacity duration-150 hover:text-fg focus-visible:opacity-100 [@media(hover:hover)]:group-hover:opacity-100"
          >
            <Plus size={13} aria-hidden />
          </button>
        )}

        {groups.length > 0 && (
          <div className={cn('absolute -bottom-3 z-10 flex gap-1', mine ? 'right-2' : 'left-2')}>
            {groups.map((g) => (
              <button
                key={g.emoji}
                type="button"
                onClick={() => onReact(g.emoji)}
                aria-label={`${g.emoji} ${g.count}${g.mine ? ', yours' : ''}`}
                className={cn(
                  'flex items-center gap-0.5 rounded-full border px-1.5 py-px text-[12px] shadow-sm',
                  g.mine ? 'border-accent/60 bg-accent-soft' : 'border-border bg-surface',
                )}
              >
                {g.emoji}
                {g.count > 1 && <span className="text-[10.5px] text-muted tabular-nums">{g.count}</span>}
              </button>
            ))}
          </div>
        )}

        {footer && <p className="mt-0.5 text-right text-[10.5px] text-subtle">{footer}</p>}
      </div>

      {mine && tick && (
        <span
          className={cn('mb-1 shrink-0', tick.read ? 'text-accent' : 'text-subtle')}
          title={tick.read ? `Read ${TIME.format(new Date(tick.read))}` : 'Sent'}
          aria-label={tick.read ? `Read ${TIME.format(new Date(tick.read))}` : 'Sent'}
        >
          {tick.read ? <CheckCheck size={13} /> : <Check size={13} />}
        </span>
      )}

      {picker &&
        createPortal(
          <PickerRow
            at={picker}
            mine={reactions.find((r) => r.userId === me)?.emoji ?? null}
            onPick={(e) => {
              setPicker(null)
              onReact(e)
            }}
            onClose={() => setPicker(null)}
          />,
          document.body,
        )}
    </div>
  )
}

function PickerRow({
  at,
  mine,
  onPick,
  onClose,
}: {
  at: { left: number; top: number }
  mine: string | null
  onPick: (e: string) => void
  onClose: () => void
}) {
  return (
    <>
      <div className="fixed inset-0 z-[94]" onPointerDown={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label="Pick a reaction"
        className="ct-animate-pop fixed z-[95] flex gap-0.5 rounded-full border border-border bg-surface px-1.5 py-1 shadow-2xl"
        style={at}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        {REACTIONS.map((e, i) => (
          <button
            key={e}
            type="button"
            autoFocus={i === 0}
            aria-label={`React ${e}`}
            aria-pressed={mine === e}
            onClick={() => onPick(e)}
            className={cn(
              'grid size-8 place-items-center rounded-full text-[19px] transition-transform duration-150 hover:scale-125',
              mine === e && 'bg-accent-soft',
            )}
          >
            {e}
          </button>
        ))}
      </div>
    </>
  )
}
