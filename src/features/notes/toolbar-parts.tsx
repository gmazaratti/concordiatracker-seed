import { useState } from 'react'
import { usePopover } from '@/components/ui/usePopover'
import { createPortal } from 'react-dom'
import { Ban, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { HsvPicker } from '@/components/ui/HsvPicker'

/** A toolbar button. mousedown is cancelled so the editor keeps its selection. */
export function ToolBtn({ icon: Icon, label, onClick, active, disabled }: {
  icon: LucideIcon
  label: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
}) {
  return (
    <button type="button" aria-label={label} aria-pressed={active} disabled={disabled}
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

/**
 * Text colour or highlight: a palette like a word processor's, a way back to
 * the default, and Custom — a real picker with a hex field for anything else.
 */
export function ColorPopover({ label, current, palette, onPick, icon: Icon, glyph, noneLabel }: {
  label: string
  current: string | null
  palette: string[]
  onPick: (v: string | null) => void
  icon?: LucideIcon
  glyph?: string
  noneLabel: string
}) {
  const { open, setOpen, toggle, btnRef, panelRef, pos } = usePopover()
  const [custom, setCustom] = useState(false)
  return (
    <>
      <button ref={btnRef} type="button" aria-label={label} aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()} onClick={() => { setCustom(false); toggle() }}
        className="flex size-8 shrink-0 flex-col items-center justify-center rounded-md text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg">
        {Icon ? <Icon size={15} aria-hidden /> : <span className="text-[14px] leading-none font-semibold">{glyph}</span>}
        <span className="mt-0.5 h-[3px] w-4 rounded-full" style={{ background: current ?? 'currentColor' }} />
      </button>
      {open && createPortal(
        <div ref={panelRef} role="dialog" aria-label={label} style={pos}
          onMouseDown={(e) => { if (!(e.target instanceof HTMLInputElement)) e.preventDefault() }}
          className="ct-animate-pop fixed z-[200] flex flex-col gap-2 rounded-xl border border-border bg-surface p-2.5 shadow-xl">
          <button type="button" onClick={() => { onPick(null); setOpen(false) }}
            className="flex items-center gap-2 rounded-md px-1.5 py-1 text-left text-[12.5px] text-fg hover:bg-surface-2">
            <Ban size={14} className="text-subtle" aria-hidden />{noneLabel}
          </button>
          {custom ? (
            <HsvPicker value={current && current.startsWith('#') ? current : '#3e63dd'} onChange={(hex) => onPick(hex)} />
          ) : (
            <div className="grid grid-cols-8 gap-1">
              {palette.map((c) => (
                <button key={c} type="button" title={c} aria-label={c} onClick={() => { onPick(c); setOpen(false) }}
                  className={cn('size-6 rounded-full border border-border transition-transform duration-150 hover:scale-110', current === c && 'ring-2 ring-accent ring-offset-1 ring-offset-surface')}
                  style={{ background: c }} />
              ))}
            </div>
          )}
          <button type="button" onClick={() => setCustom((x) => !x)}
            className="rounded-md px-1.5 py-1 text-left text-[12.5px] font-medium text-accent hover:bg-surface-2">
            {custom ? 'Back to the palette' : 'Custom colour…'}
          </button>
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
      <button ref={btnRef} type="button" aria-label="Link (Ctrl+K)" aria-pressed={!!current}
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
