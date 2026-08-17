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
export function ensureContrast(
  hex: string,
  background: string,
  target = 3,
  /**
   * Which way to walk. Defaults to whichever end the background is further
   * from, which is right for an accent. Callers deriving a text scale must pass
   * it: the page decides the direction for the WHOLE scale, and re-deciding per
   * step let a bright cyan page (light, so black text) hand its slightly-darker
   * card to this function, which read it as dark and went looking for a white
   * that could never clear the bar.
   */
  direction?: 'lighter' | 'darker',
): string {
  const bg = parseHex(background)
  const fg = parseHex(hex)
  if (!bg || !fg) return hex

  if (contrast(fg, bg) >= target) return hex

  const away = direction ?? (luminance(bg) > 0.4 ? 'darker' : 'lighter')
  const toward = away === 'darker' ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 }
  for (let step = 0.05; step <= 1; step += 0.05) {
    // Test the ROUNDED colour, which is the one we return. Checking the
    // un-rounded mix and returning the rounded hex meant the answer could sit
    // just under the target it was chosen for — enough that feeding a result
    // back in moved it again.
    const next = toHex(mix(fg, toward, step))
    if (contrast(parseHex(next)!, bg) >= target) return next
  }
  return toHex(toward)
}

/** Is this colour dark enough that text on it should be light? */
export function isDark(hex: string): boolean {
  const rgb = parseHex(hex)
  return rgb ? luminance(rgb) < 0.4 : true
}

/** The default page colour for each base, when none is chosen. */
export const BASE_CANVAS = { dark: '#0f0f16', light: '#f5f6f4' } as const

/**
 * The full set of accent tokens for a custom theme, derived from one colour.
 *
 * `base` decides which way the derivations go: hover lightens on a dark page and
 * darkens on a light one, matching how the built-in themes behave. `canvas` is
 * the page the accent has to survive against — a chosen background moves that
 * target, so the contrast guard has to know about it.
 */
export function accentTokens(
  accent: string,
  base: 'dark' | 'light',
  canvas?: string,
): Record<string, string> {
  const page = canvas ?? BASE_CANVAS[base]
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

/**
 * A whole custom theme from what the student chose — THE one entry point.
 *
 * Everything that needs to know what a custom theme looks like goes through
 * here: the provider that paints it, and the picker that previews it. The clamp
 * in `usableCanvas` is applied exactly once, which matters more than it sounds
 * — running it twice moved a deepened blue a further step, so the swatch in the
 * picker and the page it produced were different colours.
 */
export function customTheme(custom: { base: 'dark' | 'light'; accent: string; canvas?: string }): {
  /** The page colour actually used, after the readability clamp. */
  page: string
  /** Which built-in palette the rest of the tokens fall back to. */
  base: 'dark' | 'light'
  /** True when the clamp moved their colour, so the UI can say so. */
  adjusted: boolean
  tokens: Record<string, string>
} {
  const chosen = custom.canvas
  const page = chosen ? usableCanvas(chosen) : BASE_CANVAS[custom.base]
  const base = chosen ? (isDark(page) ? 'dark' : 'light') : custom.base
  return {
    page,
    base,
    adjusted: Boolean(chosen) && page.toLowerCase() !== chosen!.toLowerCase(),
    tokens: {
      // A chosen page brings a whole surface and text scale with it, derived so
      // the contrast holds. Without one, only the accent changes.
      ...(chosen ? baseTokens(page) : {}),
      ...accentTokens(custom.accent, base, page),
    },
  }
}

/**
 * The nearest version of a colour that can actually be a page.
 *
 * A mid-tone background cannot host readable text — not "looks a bit off",
 * genuinely cannot: mid-grey is about 3.4:1 against BOTH black and white, so
 * every level of the type scale collapses onto the same unreadable value and no
 * amount of deriving fixes it. Rather than refuse a colour someone liked, we
 * commit it to the end it is already nearer, far enough that white (or black)
 * text clears 9:1. A mid-blue comes back as a deep navy blue: still theirs,
 * and now a page.
 *
 * `usableCanvas` is idempotent — a colour that already works is returned
 * untouched, so the built-in palettes pass through unchanged.
 */
export function usableCanvas(hex: string): string {
  const rgb = parseHex(hex)
  if (!rgb) return hex
  const dark = isDark(hex)
  const text = dark ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 }
  if (contrast(rgb, text) >= 9) return hex

  // Push away from the text colour: darker under white text, lighter under black.
  const toward = dark ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 }
  for (let amount = 0.05; amount <= 1; amount += 0.05) {
    // Rounded before testing, so the returned value genuinely clears the bar
    // and `usableCanvas` is idempotent — see the note in `ensureContrast`.
    const next = toHex(mix(rgb, toward, amount))
    if (contrast(parseHex(next)!, text) >= 9) return next
  }
  return toHex(toward)
}

/**
 * A whole surface palette from one background colour.
 *
 * The chosen colour IS the page. Everything stacked on it — cards, the raised
 * fills, borders — is that colour stepped toward the opposite end, so the
 * hierarchy stays in the same order no matter what was picked: a card is always
 * a little nearer the light on a dark page and a little nearer the dark on a
 * light one. Text is then pinned to the far end and pulled back in measured
 * steps, so muted and subtle keep their WCAG margins instead of being whatever
 * the source colour happened to allow.
 *
 * This is the part of a "pick your own theme" that usually goes wrong. Letting
 * someone choose the background AND the text is how you get grey on grey; deriving
 * the text from the background means the only thing they can do is change the
 * mood, never the readability.
 */
export function baseTokens(canvas: string): Record<string, string> {
  const dark = isDark(canvas)
  const away = dark ? '#ffffff' : '#000000'
  const step = (amount: number) => {
    const rgb = parseHex(canvas)
    return rgb ? toHex(mix(rgb, parseHex(away)!, amount)) : canvas
  }
  // Cards lift off the page. Light themes need a slightly bigger step than dark
  // ones to read as raised, because white has nowhere further to go.
  const surface = step(dark ? 0.06 : 0.055)
  // One direction for the whole text scale, decided by the PAGE.
  const textWay = dark ? 'lighter' : 'darker'
  return {
    '--ct-canvas': canvas,
    '--ct-surface': surface,
    '--ct-surface-2': step(dark ? 0.12 : 0.09),
    '--ct-border': step(dark ? 0.16 : 0.14),
    '--ct-border-strong': step(dark ? 0.28 : 0.26),
    // Text is MEASURED against the card it sits on, not stepped by a fixed
    // amount. A proportional step looked right on the default near-black and
    // quietly dropped `subtle` to 4.1:1 on a mid-tone background — under AA,
    // which is the one thing a custom theme must not be allowed to do. Each
    // level starts where the proportional step put it and is pushed further
    // only if it has to be.
    '--ct-fg': ensureContrast(step(dark ? 0.94 : 0.9), surface, 11, textWay),
    '--ct-muted': ensureContrast(step(0.68), surface, 6, textWay),
    '--ct-subtle': ensureContrast(step(dark ? 0.52 : 0.55), surface, 4.5, textWay),
  }
}
