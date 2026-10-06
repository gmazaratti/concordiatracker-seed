import { useState } from 'react'
import { FileText, ScrollText } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { Button } from '@/components/ui/Button'
import { HsvPicker } from '@/components/ui/HsvPicker'
import { cn } from '@/lib/cn'
import { PAGE_COLORS, type PageSetup } from './page-setup'
import { HeaderFooterFields } from './HeaderFooterFields'

/**
 * Page setup for this note: separate pages (a letter sheet, broken where the
 * PDF breaks) or one endless page, and the colour of the page. Everyone who
 * opens the note sees the same setup.
 */
export function PageSetupDialog({ value, onSave, onClose }: { value: PageSetup; onSave: (v: PageSetup) => void; onClose: () => void }) {
  const [layout, setLayout] = useState(value.layout)
  const [color, setColor] = useState(value.color)
  const [custom, setCustom] = useState(!PAGE_COLORS.some((c) => c.value === value.color))
  const [bands, setBands] = useState({
    header: value.header, footer: value.footer, headerLine: value.headerLine,
    footerLine: value.footerLine, firstPage: value.firstPage, browserHeaders: value.browserHeaders,
  })

  return (
    <ModalShell label="Page setup" onClose={onClose}>
      <div className="flex flex-col gap-5 p-5">
        <h2 className="text-[17px] font-semibold text-fg">Page setup</h2>

        <fieldset>
          <legend className="mb-2 text-[12px] font-semibold tracking-wide text-subtle uppercase">Layout</legend>
          <div className="grid grid-cols-2 gap-2">
            {([
              { v: 'pages', icon: FileText, title: 'Pages', body: 'Separate letter-size sheets, like a printed document.' },
              { v: 'pageless', icon: ScrollText, title: 'Pageless', body: 'One endless page. Good for long notes and wide images.' },
            ] as const).map((o) => (
              <button key={o.v} type="button" onClick={() => setLayout(o.v)} aria-pressed={layout === o.v}
                className={cn('flex flex-col gap-1.5 rounded-xl border p-3 text-left transition-colors duration-150',
                  layout === o.v ? 'border-accent bg-accent-soft' : 'border-border hover:border-border-strong')}>
                <o.icon size={18} className={layout === o.v ? 'text-accent' : 'text-muted'} aria-hidden />
                <span className="text-[13.5px] font-semibold text-fg">{o.title}</span>
                <span className="text-[12px] leading-snug text-muted">{o.body}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-[12px] font-semibold tracking-wide text-subtle uppercase">Page colour</legend>
          <div className="flex flex-wrap gap-2">
            {PAGE_COLORS.map((c) => (
              <button key={c.value} type="button" title={c.label} aria-label={c.label} aria-pressed={!custom && color === c.value}
                onClick={() => { setCustom(false); setColor(c.value) }}
                className={cn('flex flex-col items-center gap-1 rounded-lg p-1 text-[11px] text-muted', !custom && color === c.value && 'text-fg')}>
                <span className={cn('size-10 rounded-lg border border-border-strong transition-transform duration-150 hover:scale-105', !custom && color === c.value && 'ring-2 ring-accent ring-offset-2 ring-offset-surface')}
                  style={{ background: c.swatch }} />
                {c.label}
              </button>
            ))}
            <button type="button" aria-pressed={custom} onClick={() => { setCustom(true); if (color === 'theme') setColor('#fdf6e3') }}
              className={cn('flex flex-col items-center gap-1 rounded-lg p-1 text-[11px] text-muted', custom && 'text-fg')}>
              <span className={cn('size-10 rounded-lg border border-border-strong', custom && 'ring-2 ring-accent ring-offset-2 ring-offset-surface')}
                style={{ background: custom ? color : 'conic-gradient(#e5484d,#d6a100,#30a46c,#0090ff,#8e4ec6,#e5484d)' }} />
              Custom
            </button>
          </div>
          {custom && <div className="mt-3"><HsvPicker value={color.startsWith('#') ? color : '#fdf6e3'} onChange={setColor} /></div>}
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-[12px] font-semibold tracking-wide text-subtle uppercase">Header and footer</legend>
          <HeaderFooterFields value={bands} onChange={setBands} />
        </fieldset>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave({ layout, color, ...bands })}>Apply</Button>
        </div>
      </div>
    </ModalShell>
  )
}
