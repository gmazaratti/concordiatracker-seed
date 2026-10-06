import { hasBand, type Band, type PageSetup } from './page-setup'

/**
 * The header and footer as CSS page margin boxes, for printing and "Save as
 * PDF": text on every printed page, with {page} and {pages} as the real page
 * counters. Chrome and Edge print these; Safari and Firefox ignore margin
 * boxes and print the page without them.
 *
 * Every box is given SOME content when the browser's own header is switched
 * off: a page that defines its margin boxes replaces the browser's title,
 * date and web address with them, so a box left undefined would let the
 * browser's text back in.
 */
const str = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`

function content(text: string, title: string, date: string): string {
  const parts = text.split(/(\{page\}|\{pages\}|\{title\}|\{date\})/).filter(Boolean)
  if (!parts.length) return '" "'
  return parts
    .map((p) => (p === '{page}' ? 'counter(page)' : p === '{pages}' ? 'counter(pages)' : str(p === '{title}' ? title || 'Untitled note' : p === '{date}' ? date : p)))
    .join(' ')
}

const SIDES = [['left', 'left'], ['center', 'center'], ['right', 'right']] as const

function boxes(edge: 'top' | 'bottom', band: Band | null, line: boolean, keep: boolean, title: string, date: string): string {
  return SIDES.map(([key, side]) => {
    const text = band?.[key] ?? ''
    if (!text.trim() && keep) return ''
    const border = line && band && hasBand(band) ? `border-${edge === 'top' ? 'bottom' : 'top'}: 0.75pt solid #999;` : ''
    return `@${edge}-${side} { content: ${text.trim() ? content(text, title, date) : '" "'}; font: 9pt Arial, sans-serif; color: #555; text-align: ${side}; vertical-align: ${edge === 'top' ? 'bottom' : 'top'}; ${border} }`
  }).join('\n')
}

export function printBandsCss(setup: PageSetup, title: string, date: string): string {
  const keep = setup.browserHeaders
  const all = `${boxes('top', setup.header, setup.headerLine, keep, title, date)}\n${boxes('bottom', setup.footer, setup.footerLine, keep, title, date)}`
  const first = setup.firstPage ? '' : `@page note:first { ${boxes('top', null, false, keep, title, date)}\n${boxes('bottom', null, false, keep, title, date)} }`
  return `@media print { @page note { ${all} } ${first} }`
}
