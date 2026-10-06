import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Ban, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

/** A toolbar button. mousedown is cancelled so the editor keeps its selection. */
export function ToolBtn({ icon: Icon, label, onClick, active, disabled }: {
  icon: LucideIcon
  label: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
}) {
  return (
    <button type="button" title={label} aria-label={label} aria-pressed={active} disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} onClick={onClick}
      className={cn(
        'grid size-8 shrink-0 place-items-center rounded-md text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg disabled:pointer-events-none disabled:opacity-35',
        active && 'bg-accent-soft text-accent hover:bg-accent-soft hover:text-accent',
      )}>
      <Icon size={16} aria-hidden />
    </button>
  )
}

export const ToolSep = () => <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />

/** A small panel under a toolbar button, portaled so the toolbar's horizontal
 *  scroll never clips it, and closed by Escape or a click elsewhere. */
function usePopover() {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: 0, top: 0 })
  useEffect(() => {
    if (!open) return
    const down = (e: PointerEvent) => {
      if (!panel.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false)
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('pointerdown', down, true)
      window.removeEventListener('keydown', key)
    }
  }, [open])
  /** Measured when it opens, not in an effect, so the panel never paints at 0,0. */
  const toggle = () => {
    const r = btn.current?.getBoundingClientRect()
    if (r) setPos({ left: Math.min(r.left, window.innerWidth - 260), top: r.bottom + 6 })
    setOpen((o) => !o)
  }
  return { open, setOpen, toggle, btnRef: btn, panelRef: panel, pos }
}

export function SwatchPopover({ label, current, swatches, onPick, icon: Icon, glyph }: {
  label: string
  current: string | null
  swatches: { label: string; value: string | null }[]
  onPick: (v: string | null) => void
  icon?: LucideIcon
  glyph?: string
}) {
  const { open, setOpen, toggle, btnRef, panelRef, pos } = usePopover()
  return (
    <>
      <button ref={btnRef} type="button" title={label} aria-label={label} aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()} onClick={toggle}
        className="flex size-8 shrink-0 flex-col items-center justify-center rounded-md text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg">
        {Icon ? <Icon size={15} aria-hidden /> : <span className="text-[14px] leading-none font-semibold">{glyph}</span>}
        <span className="mt-0.5 h-[3px] w-4 rounded-full" style={{ background: current ?? 'currentColor' }} />
      </button>
      {open && createPortal(
        <div ref={panelRef} role="dialog" aria-label={label} style={pos}
          className="ct-animate-pop fixed z-[200] grid grid-cols-5 gap-1.5 rounded-xl border border-border bg-surface p-2.5 shadow-xl">
          {swatches.map((s) => (
            <button key={s.label} type="button" title={s.label} aria-label={s.label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onPick(s.value); setOpen(false) }}
              className={cn('grid size-7 place-items-center rounded-full border border-border transition-transform duration-150 hover:scale-110', current === s.value && 'ring-2 ring-accent')}
              style={{ background: s.value ?? 'transparent' }}>
              {!s.value && <Ban size={13} className="text-subtle" aria-hidden />}
            </button>
          ))}
        </div>, document.body)}
    </>
  )
}

export function LinkPopover({ icon: Icon, current, onApply, onRemove }: {
  icon: LucideIcon
  current: string | null
  onApply: (href: string) => void
  onRemove: () => void
}) {
  const { open, setOpen, toggle, btnRef, panelRef, pos } = usePopover()
  const [value, setValue] = useState('')
  const apply = () => {
    const v = value.trim()
    if (!v) return
    onApply(/^https?:\/\//i.test(v) ? v : `https://${v}`)
    setOpen(false)
  }
  return (
    <>
      <button ref={btnRef} type="button" title="Link (Ctrl+K)" aria-label="Link" aria-pressed={!!current}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => { setValue(current ?? ''); toggle() }}
        className={cn('grid size-8 shrink-0 place-items-center rounded-md text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg', current && 'bg-accent-soft text-accent')}>
        <Icon size={16} aria-hidden />
      </button>
      {open && createPortal(
        <div ref={panelRef} role="dialog" aria-label="Link" style={pos}
          className="ct-animate-pop fixed z-[200] flex w-64 flex-col gap-2 rounded-xl border border-border bg-surface p-2.5 shadow-xl">
          <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="Paste a link"
            onKeyDown={(e) => e.key === 'Enter' && apply()} aria-label="Link address"
            className="h-9 rounded-lg border border-border bg-surface-2 px-2.5 text-[13px] text-fg outline-none focus:border-accent" />
          <div className="flex justify-end gap-1.5">
            {current && <button type="button" onClick={() => { onRemove(); setOpen(false) }} className="rounded-md px-2.5 py-1 text-[12.5px] text-danger hover:bg-danger/10">Remove</button>}
            <button type="button" onClick={apply} className="rounded-md bg-accent px-2.5 py-1 text-[12.5px] font-medium text-accent-contrast hover:bg-accent-hover">Apply</button>
          </div>
        </div>, document.body)}
    </>
  )
}
