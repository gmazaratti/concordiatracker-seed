/**
 * Cleaning pasted HTML before it reaches the note.
 *
 * Text copied from a dark app (another note in dark mode, a dark website, a
 * dark Notion page) arrives with its colour written into it: white or
 * light-grey text, sometimes on a dark background. Pasted onto a white page
 * it is invisible until you select it. So greys (black, white and everything
 * between) and background colours are dropped, and the text takes the page's
 * own colour; a deliberate colour, like red or blue, is kept.
 */
function isGrey(color: string): boolean {
  const c = color.trim().toLowerCase()
  if (['white', 'black', 'gray', 'grey', 'silver', 'inherit', 'currentcolor', 'windowtext'].includes(c)) return true
  let r: number, g: number, b: number
  const hex = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/)
  const rgb = c.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/)
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split('').map((x) => x + x).join('') : hex[1]
    r = parseInt(h.slice(0, 2), 16)
    g = parseInt(h.slice(2, 4), 16)
    b = parseInt(h.slice(4, 6), 16)
  } else if (rgb) {
    r = Number(rgb[1])
    g = Number(rgb[2])
    b = Number(rgb[3])
  } else {
    return false
  }
  return Math.max(r, g, b) - Math.min(r, g, b) < 24
}

export function cleanPastedHtml(html: string): string {
  if (typeof DOMParser === 'undefined' || !/style=|color=|bgcolor=/i.test(html)) return html
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.body.querySelectorAll<HTMLElement>('[style], font[color], [bgcolor]').forEach((el) => {
    el.style.removeProperty('background')
    el.style.removeProperty('background-color')
    if (el.style.color && isGrey(el.style.color)) el.style.removeProperty('color')
    if (el.hasAttribute('bgcolor')) el.removeAttribute('bgcolor')
    const fc = el.getAttribute('color')
    if (el.tagName === 'FONT' && fc && isGrey(fc)) el.removeAttribute('color')
  })
  return doc.body.innerHTML
}

export { isGrey }
