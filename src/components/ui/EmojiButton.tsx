import { createPortal } from 'react-dom'
import { Smile } from 'lucide-react'
import { cn } from '@/lib/cn'
import { EmojiPicker } from './EmojiPicker'
import { usePopover } from './usePopover'

/** Emoji, inserted where the cursor is. */
export function EmojiButton({ onPick, className }: { onPick: (e: string) => void; className?: string }) {
  const { open, setOpen, toggle, btnRef, panelRef, pos } = usePopover()
  return (
    <>
      <button ref={btnRef} type="button" aria-label="Emoji" aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()} onClick={toggle}
        className={cn('grid size-8 shrink-0 place-items-center rounded-md text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg', className)}>
        <Smile size={16} aria-hidden />
      </button>
      {open && createPortal(
        <div ref={panelRef} role="dialog" aria-label="Emoji" style={{ ...pos, left: Math.min(pos.left, window.innerWidth - 330) }}
          className="ct-animate-pop fixed z-[200] rounded-xl border border-border bg-surface p-2.5 shadow-xl">
          <EmojiPicker onPick={(e) => { onPick(e); setOpen(false) }} />
        </div>, document.body)}
    </>
  )
}
