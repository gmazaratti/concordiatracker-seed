import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { Editor } from '@tiptap/react'
import { Check } from 'lucide-react'
import { usePopover } from '@/components/ui/usePopover'
import { LINE_HEIGHTS, cleanLineHeight } from './extensions/line-height'

/**
 * The text size, as a number you can type into. − and + step through the
 * common sizes; typing any size from 6 to 96 and pressing Enter (or leaving
 * the box) applies it.
 */
export function FontSizeInput({ size, onSize }: { size: number; onSize: (n: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    const n = Math.round(Number(draft))
    if (draft !== null && Number.isFinite(n) && n >= 6 && n <= 96) onSize(n)
    setDraft(null)
  }
  return (
    <input
      value={draft ?? String(size)}
      onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
      onFocus={(e) => e.target.select()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
          ;(e.target as HTMLInputElement).blur()
        } else if (e.key === 'Escape') {
          setDraft(null)
          ;(e.target as HTMLInputElement).blur()
        }
      }}
      inputMode="numeric"
      aria-label="Text size"
      className="h-7 w-10 shrink-0 rounded-md border border-border bg-transparent text-center text-[12.5px] text-fg tabular-nums outline-none focus:border-accent"
    />
  )
}

/** Line spacing: for the highlighted text, or the whole note when nothing is highlighted. */
export function LineSpacing({ editor, current }: { editor: Editor; current: string | null }) {
  const { open, setOpen, toggle, btnRef, panelRef, pos } = usePopover()
  const [custom, setCustom] = useState('')
  const scope = editor.state.selection.empty ? 'Whole note' : 'Highlighted text'
  const apply = (v: string | null) => {
    editor.chain().focus().setBlockLineHeight(v).run()
    setOpen(false)
  }
  return (
    <>
      <button ref={btnRef} type="button" aria-label="Line spacing" aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()} onClick={toggle}
        className="grid size-8 shrink-0 place-items-center rounded-md text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M11 6h10M11 12h10M11 18h10M4 8l2-3 2 3M4 16l2 3 2-3M6 5v14" />
        </svg>
      </button>
      {open && createPortal(
        <div ref={panelRef} role="dialog" aria-label="Line spacing" style={pos}
          onMouseDown={(e) => { if (!(e.target instanceof HTMLInputElement)) e.preventDefault() }}
          className="ct-animate-pop fixed z-[200] flex w-52 flex-col gap-0.5 rounded-xl border border-border bg-surface p-1.5 shadow-xl">
          <p className="px-2 pt-1 pb-1.5 text-[11.5px] font-medium text-subtle">Applies to: {scope}</p>
          {LINE_HEIGHTS.map((v) => (
            <button key={v} type="button" onClick={() => apply(v)}
              className="flex items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] text-fg hover:bg-surface-2">
              {v === '1' ? 'Single' : v === '2' ? 'Double' : v}
              {current === v && <Check size={14} className="text-accent" aria-hidden />}
            </button>
          ))}
          <button type="button" onClick={() => apply(null)} className="rounded-md px-2 py-1.5 text-left text-[13px] text-muted hover:bg-surface-2">
            Default
          </button>
          <div className="mt-1 flex items-center gap-1.5 border-t border-border px-1 pt-2">
            <input value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^0-9.]/g, '').slice(0, 4))}
              onKeyDown={(e) => e.key === 'Enter' && cleanLineHeight(custom) && apply(custom)}
              placeholder="Custom, e.g. 1.75" aria-label="Custom line spacing"
              className="h-8 min-w-0 flex-1 rounded-md border border-border bg-surface-2 px-2 text-[12.5px] text-fg outline-none focus:border-accent" />
            <button type="button" disabled={!cleanLineHeight(custom)} onClick={() => apply(custom)}
              className="h-8 rounded-md bg-accent px-2.5 text-[12.5px] font-medium text-accent-contrast disabled:opacity-40">Set</button>
          </div>
        </div>, document.body)}
    </>
  )
}
