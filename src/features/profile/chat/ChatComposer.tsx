import { forwardRef } from 'react'
import { Plus, Reply, Send, X } from 'lucide-react'
import type { Attachment, Message } from '@/lib/social'
import { describe } from './chat-helpers'
import { cn } from '@/lib/cn'

/**
 * The bar at the bottom of a conversation.
 *
 * 16px ON A PHONE, AND THAT IS THE WHOLE FIX. iOS Safari zooms the page into
 * any focused field whose text is smaller than 16px — the textarea was 15px,
 * so tapping it scaled the whole thread up: the header's icons slid off the
 * right edge and this bar ballooned past the screen. At 16px there is no zoom
 * to undo. Desktop keeps the tighter 14px.
 *
 * PINNED. `shrink-0` inside a column whose middle is the only thing that
 * scrolls, with the home-indicator inset inside it, so a long conversation can
 * never push the box off the bottom of the screen.
 */
export const ChatComposer = forwardRef<
  HTMLTextAreaElement,
  {
    body: string
    onBody: (v: string) => void
    onSubmit: () => void
    placeholder: string
    canSend: boolean
    attachOpen: boolean
    onAttach: () => void
    pending: Attachment | null
    onClearPending: () => void
    replyTo: Message | null
    replyName: string
    onClearReply: () => void
    notice: string | null
    warning: string | null
    error: string | null
  }
>(function ChatComposer(p, ref) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        p.onSubmit()
      }}
      className="shrink-0 border-t border-border/70 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] sm:p-2.5"
    >
      {p.replyTo && (
        <div className="ct-animate-pop mb-2 flex items-center gap-2 rounded-lg border-l-2 border-accent bg-surface-2 px-2.5 py-1.5">
          <Reply size={14} className="shrink-0 text-accent" aria-hidden />
          <span className="min-w-0 flex-1 text-[12px]">
            <span className="block font-medium text-fg">Replying to {p.replyName}</span>
            <span className="block truncate text-subtle">{p.replyTo.body.trim() || 'An attachment'}</span>
          </span>
          <button type="button" onClick={p.onClearReply} aria-label="Cancel reply" className="grid size-7 place-items-center rounded-full text-subtle hover:text-fg">
            <X size={14} aria-hidden />
          </button>
        </div>
      )}
      {p.notice && <p className="mb-2 text-[12px] text-subtle">{p.notice}</p>}
      {p.warning && <p className="mb-2 text-[12px] text-warning">{p.warning}</p>}
      {p.pending && (
        <div className="ct-animate-pop mb-2 flex items-center gap-2 rounded-lg border border-accent/40 bg-accent-soft px-2.5 py-1.5">
          <span className="min-w-0 flex-1 truncate text-[11.5px] text-fg">{describe(p.pending)}</span>
          <button type="button" onClick={p.onClearPending} className="text-[11px] text-subtle hover:text-fg">
            Remove
          </button>
        </div>
      )}

      <div className="flex items-end gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={p.onAttach}
          aria-label="Send something"
          aria-expanded={p.attachOpen}
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-full border border-border text-muted transition-all duration-200 hover:border-accent hover:text-fg sm:size-[42px]',
            p.attachOpen && 'rotate-45 border-accent text-accent',
          )}
        >
          <Plus size={18} aria-hidden />
        </button>

        {/* ONE PILL holding the text and the send — the button inside it is
            what makes the row read as one field instead of three controls. */}
        <div className="flex min-h-10 min-w-0 flex-1 items-end gap-1 rounded-[20px] border border-border bg-canvas py-1 pr-1 pl-3.5 transition-colors duration-150 focus-within:border-accent sm:min-h-[42px]">
          <textarea
            ref={ref}
            value={p.body}
            onChange={(e) => p.onBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                p.onSubmit()
              }
            }}
            rows={1}
            enterKeyHint="send"
            placeholder={p.placeholder}
            className="max-h-28 min-h-[30px] min-w-0 flex-1 resize-none self-center bg-transparent py-1 text-[16px] leading-snug text-fg placeholder:text-subtle focus:outline-none lg:text-[14px]"
          />
          {/* THE SEND ARRIVES WITH THE FIRST CHARACTER; `disabled` stays for
              the keyboard, because hiding is not disabling. */}
          <button
            type="submit"
            aria-label="Send"
            disabled={!p.canSend}
            tabIndex={p.canSend ? 0 : -1}
            className={cn(
              'grid h-8 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-accent-contrast',
              'transition-[width,opacity,transform] duration-200 ease-out hover:bg-accent-hover',
              p.canSend ? 'w-8 scale-100 opacity-100' : 'pointer-events-none w-0 scale-75 opacity-0',
            )}
          >
            {/* Nudged right a pixel: the glyph's ink is off-centre in its box. */}
            <Send size={15} className="translate-x-px" aria-hidden />
          </button>
        </div>
      </div>
      {p.error && <p className="mt-1.5 text-[11.5px] text-warning">{p.error}</p>}
    </form>
  )
})
