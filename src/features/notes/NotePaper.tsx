import { cn } from '@/lib/cn'
import { fillBand, hasBand, pageTheme, type Band, type PageSetup } from './page-setup'
import { PAGE, PAGE_PITCH } from './extensions/pagination'

/**
 * The surface a note is written on.
 *
 * Pages: separate letter-size sheets with space between them, like a word
 * processor. The text really moves to the next sheet: the pagination
 * extension pushes any block that would cross a bottom margin onto the next
 * page and reports how many pages there are, and this draws that many sheets
 * behind the text. Pageless: one continuous surface.
 *
 * A coloured page carries the matching light or dark token set (data-theme),
 * so default text, code blocks, checkboxes and links stay readable on it
 * whichever theme the app itself is in.
 */
export function NotePaper({ setup, zoom, pages, overlay, children, paperRef, title, date }: {
  setup: PageSetup
  /** For the {title} and {date} fill-ins of the header and footer. */
  title: string
  date: string
  zoom: number
  pages: number
  /** Drawn over the page in its own coordinates (the margin comment buttons). */
  overlay?: React.ReactNode
  children: React.ReactNode
  paperRef?: React.Ref<HTMLDivElement>
}) {
  const theme = pageTheme(setup.color)
  const custom = setup.color !== 'theme'
  const paged = setup.layout === 'pages'
  const sheetStyle = custom ? { background: setup.color } : undefined
  const bands = (page: number) =>
    page === 1 && !setup.firstPage ? null : (
      <>
        {hasBand(setup.header) && <BandRow band={setup.header} line={setup.headerLine} edge="top" ctx={{ page, pages, title, date }} />}
        {hasBand(setup.footer) && <BandRow band={setup.footer} line={setup.footerLine} edge="bottom" ctx={{ page, pages, title, date }} />}
      </>
    )

  if (!paged) {
    return (
      <div style={{ zoom: zoom / 100 }} className="w-full">
        <div ref={paperRef} data-theme={theme ?? undefined} style={sheetStyle}
          className={cn('relative mx-auto min-h-full max-w-[900px] px-10 py-12 text-fg', !custom && 'ct-note-paper')}>
          {bands(1)}
          {children}
          {overlay}
        </div>
      </div>
    )
  }

  const height = pages * PAGE_PITCH - PAGE.gap
  return (
    <div style={{ zoom: zoom / 100 }} className="mx-auto my-8 w-fit">
      <div ref={paperRef} data-theme={theme ?? undefined} className="relative mx-auto text-fg" style={{ width: 816, minHeight: height }}>
        {Array.from({ length: pages }, (_, i) => (
          <div key={i} aria-hidden
            className={cn('absolute inset-x-0 rounded-[3px] shadow-[0_1px_3px_rgba(0,0,0,0.18),0_8px_28px_rgba(0,0,0,0.22)]', !custom && 'ct-note-paper')}
            style={{ top: i * PAGE_PITCH, height: PAGE.height, ...sheetStyle }}>
            {bands(i + 1)}
          </div>
        ))}
        <div className="relative" style={{ padding: `${PAGE.margin}px ${PAGE.margin}px` }}>{children}</div>
        {overlay}
      </div>
    </div>
  )
}

/** One header or footer on one page: left, centre and right, in the margin. */
function BandRow({ band, line, edge, ctx }: { band: Band; line: boolean; edge: 'top' | 'bottom'; ctx: Parameters<typeof fillBand>[1] }) {
  return (
    <div className={cn('pointer-events-none absolute inset-x-24 grid grid-cols-3 gap-4 text-[11px] text-muted', edge === 'top' ? 'top-10 pb-1.5' : 'bottom-10 pt-1.5',
      line && (edge === 'top' ? 'border-b border-border-strong' : 'border-t border-border-strong'))}>
      <span className="truncate">{fillBand(band.left, ctx)}</span>
      <span className="truncate text-center">{fillBand(band.center, ctx)}</span>
      <span className="truncate text-right">{fillBand(band.right, ctx)}</span>
    </div>
  )
}
