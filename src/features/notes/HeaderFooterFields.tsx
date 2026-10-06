import { useRef } from 'react'
import { Switch } from '@/features/settings/controls'
import { BAND_TOKENS, type Band, type PageSetup } from './page-setup'

type Bands = Pick<PageSetup, 'header' | 'footer' | 'headerLine' | 'footerLine' | 'firstPage' | 'browserHeaders'>

/**
 * Headers and footers, like a word processor's: text on the left, middle and
 * right of every page, with fill-ins for the page number, the page count,
 * the title and the date (so "Degryse {page}" reads "Degryse 1", "Degryse 2"…).
 */
export function HeaderFooterFields({ value, onChange }: { value: Bands; onChange: (v: Bands) => void }) {
  // The last field typed in, so a fill-in chip lands where the cursor was.
  const last = useRef<{ band: 'header' | 'footer'; key: keyof Band; el: HTMLInputElement } | null>(null)

  const setCell = (band: 'header' | 'footer', key: keyof Band, text: string) =>
    onChange({ ...value, [band]: { ...value[band], [key]: text.slice(0, 80) } })

  const insert = (token: string) => {
    const l = last.current
    const band = l?.band ?? 'header'
    const key = l?.key ?? 'right'
    const cur = value[band][key]
    const at = l?.el.selectionStart ?? cur.length
    setCell(band, key, cur.slice(0, at) + token + cur.slice(at))
    requestAnimationFrame(() => {
      l?.el.focus()
      l?.el.setSelectionRange(at + token.length, at + token.length)
    })
  }

  const row = (band: 'header' | 'footer', label: string) => (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-medium text-fg">{label}</span>
      <div className="grid grid-cols-3 gap-1.5">
        {(['left', 'center', 'right'] as const).map((key) => (
          <input key={key} value={value[band][key]} placeholder={key === 'left' ? 'Left' : key === 'center' ? 'Centre' : 'Right'}
            aria-label={`${label}, ${key}`} maxLength={80}
            onFocus={(e) => { last.current = { band, key, el: e.target } }}
            onChange={(e) => { last.current = { band, key, el: e.target }; setCell(band, key, e.target.value) }}
            className={`h-9 min-w-0 rounded-lg border border-border bg-surface-2 px-2.5 text-[13px] text-fg outline-none focus:border-accent ${key === 'center' ? 'text-center' : key === 'right' ? 'text-right' : ''}`} />
        ))}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-3">
      {row('header', 'Header')}
      {row('footer', 'Footer')}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[12px] text-subtle">Insert:</span>
        {BAND_TOKENS.map((t) => (
          <button key={t.token} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(t.token)}
            className="rounded-md border border-border px-2 py-0.5 text-[12px] text-muted hover:bg-surface-2 hover:text-fg">
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-[12px] text-subtle">For example “Degryse {'{page}'}” on the right gives Degryse 1, Degryse 2, and so on.</p>
      <div className="flex flex-col gap-2">
        <Toggle label="Line under the header" checked={value.headerLine} onChange={(v) => onChange({ ...value, headerLine: v })} />
        <Toggle label="Line above the footer" checked={value.footerLine} onChange={(v) => onChange({ ...value, footerLine: v })} />
        <Toggle label="Show on the first page" checked={value.firstPage} onChange={(v) => onChange({ ...value, firstPage: v })} />
        <Toggle label="When printing, let the browser add its own title, date and web address" checked={value.browserHeaders}
          onChange={(v) => onChange({ ...value, browserHeaders: v })} />
      </div>
      <p className="text-[11.5px] leading-snug text-subtle">
        Chrome and Edge follow the last switch. Safari adds its own header unless you untick “Print headers and footers” in its print dialog.
      </p>
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 text-[13px] text-fg">
      {label}
      <Switch label={label} checked={checked} onChange={onChange} />
    </label>
  )
}
