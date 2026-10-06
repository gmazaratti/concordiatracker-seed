import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { PAGE_HEIGHT, PAGE_WIDTH, pageTheme, type PageSetup } from './page-setup'

/**
 * The surface a note is written on.
 *
 * Pages: a letter-size sheet with one-inch margins and a dashed line (with the
 * page number) wherever a printed page would end, so the screen and the PDF
 * agree about where page 2 starts. Pageless: one continuous surface.
 *
 * A coloured page carries the matching light or dark token set (data-theme),
 * so default text, code blocks, checkboxes and links stay readable on it
 * whichever theme the app itself is in.
 */
export function NotePaper({ setup, zoom, children }: { setup: PageSetup; zoom: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(PAGE_HEIGHT)
  const theme = pageTheme(setup.color)
  const custom = setup.color !== 'theme'
  const pages = setup.layout === 'pages'

  useEffect(() => {
    const el = ref.current
    if (!el || !pages) return
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [pages])

  const breaks = pages ? Math.max(0, Math.ceil(height / PAGE_HEIGHT) - 1) : 0

  return (
    <div style={{ zoom: zoom / 100 }} className={cn('mx-auto transition-[max-width] duration-300 ease-out', pages ? 'my-8' : 'my-0 w-full')}>
      <div
        ref={ref}
        data-theme={theme ?? undefined}
        style={{
          ...(custom ? { background: setup.color } : {}),
          ...(pages ? { width: PAGE_WIDTH, minHeight: PAGE_HEIGHT } : {}),
        }}
        className={cn(
          'relative mx-auto text-fg transition-[background-color,box-shadow] duration-300',
          !custom && 'ct-note-paper',
          pages ? 'rounded-sm px-24 py-24 shadow-[0_2px_28px_rgba(0,0,0,0.28)]' : 'min-h-full max-w-[900px] px-10 py-12',
        )}
      >
        {children}
        {Array.from({ length: breaks }, (_, i) => (
          <div key={i} aria-hidden className="pointer-events-none absolute inset-x-0 flex items-center gap-2" style={{ top: (i + 1) * PAGE_HEIGHT }}>
            <span className="h-px flex-1 border-t border-dashed border-border-strong" />
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] font-medium text-subtle">Page {i + 2}</span>
            <span className="h-px w-6 border-t border-dashed border-border-strong" />
          </div>
        ))}
      </div>
    </div>
  )
}
