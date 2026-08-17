/**
 * The small amount of colour arithmetic a custom theme needs.
 *
 * A student picks ONE colour. Everything else — the hover state, the text that
 * sits on top of it, the soft fill behind a badge, the focus ring — is derived
 * here rather than asked for, because nobody wants to choose five colours and
 * the four they didn't choose are the ones that break legibility.
 *
 * The contrast maths is WCAG's, not an eyeball: `readableOn` picks black or
 * white by measuring the actual contrast ratio, so a pale mint accent gets dark
 * text and a deep navy gets light text without anyone having to think about it.
 */

export interface Rgb {
  r: number
  g: number
  b: number
}

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)))

/** `#rgb` or `#rrggbb` → channels. Null for anything else, so callers can fall back. */
export function parseHex(hex: string): Rgb | null {
  const s = hex.trim().replace(/^#/, '')
  const full = s.length === 3 ? s.replace(/./g, (c) => c + c) : s
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  }
}

export function toHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((n) => clamp(n).toString(16).padStart(2, '0')).join('')}`
}

/** WCAG relative luminance. */
export function luminance({ r, g, b }: Rgb): number {
  const lin = (c: number) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** WCAG contrast ratio, 1 (identical) to 21 (black on white). */
export function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Black or white — whichever is more readable on this colour. */
export function readableOn(hex: string): string {
  const rgb = parseHex(hex)
  if (!rgb) return '#ffffff'
  const black = { r: 0, g: 0, b: 0 }
  const white = { r: 255, g: 255, b: 255 }
  return contrast(rgb, black) >= contrast(rgb, white) ? '#101010' : '#ffffff'
}

/** Blend two colours. `amount` 0 → a, 1 → b. */
export function mix(a: Rgb, b: Rgb, amount: number): Rgb {
  return {
    r: a.r + (b.r - a.r) * amount,
    g: a.g + (b.g - a.g) * amount,
    b: a.b + (b.b - a.b) * amount,
  }
}

export const lighten = (hex: string, amount: number): string => {
  const rgb = parseHex(hex)
  return rgb ? toHex(mix(rgb, { r: 255, g: 255, b: 255 }, amount)) : hex
}

export const darken = (hex: string, amount: number): string => {
  const rgb = parseHex(hex)
  return rgb ? toHex(mix(rgb, { r: 0, g: 0, b: 0 }, amount)) : hex
}

export function rgba(hex: string, alpha: number): string {
  const rgb = parseHex(hex)
  if (!rgb) return hex
  return `rgba(${clamp(rgb.r)}, ${clamp(rgb.g)}, ${clamp(rgb.b)}, ${alpha})`
}

/**
 * Pull a colour far enough from the page to be readable on it.
 *
 * Somebody will pick near-white on a light theme or near-black on a dark one —
 * usually on purpose, wanting a subtle look — and then their buttons vanish.
 * Rather than refuse the colour, we walk it toward the opposite end until it
 * clears the target ratio. 3:1 is WCAG's bar for large text and UI components,
 * which is what an accent actually is.
 */
export function ensureContrast(hex: string, background: string, target = 3): string {
  const bg = parseHex(background)
  const fg = parseHex(hex)
  if (!bg || !fg) return hex

  if (contrast(fg, bg) >= target) return hex

  // Move away from the background: darker on a light page, lighter on a dark one.
  const toward = luminance(bg) > 0.4 ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 }
  for (let step = 0.05; step <= 1; step += 0.05) {
    const next = mix(fg, toward, step)
    if (contrast(next, bg) >= target) return toHex(next)
  }
  return toHex(toward)
}

/**
 * The full set of accent tokens for a custom theme, derived from one colour.
 *
 * `base` decides which way the derivations go: hover lightens on a dark page and
 * darkens on a light one, matching how the built-in themes behave.
 */
export function accentTokens(
  accent: string,
  base: 'dark' | 'light',
): Record<string, string> {
  const page = base === 'dark' ? '#0f0f16' : '#f5f6f4'
  const safe = ensureContrast(accent, page)
  return {
    '--ct-accent': safe,
    '--ct-accent-hover': base === 'dark' ? lighten(safe, 0.14) : darken(safe, 0.14),
    '--ct-accent-contrast': readableOn(safe),
    '--ct-accent-soft': rgba(safe, base === 'dark' ? 0.14 : 0.12),
    '--ct-accent-ring': rgba(safe, 0.5),
    '--ct-brand': safe,
  }
}
