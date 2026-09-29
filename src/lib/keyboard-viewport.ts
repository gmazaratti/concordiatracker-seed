/**
 * Is an on-screen keyboard up, and what is left of the screen if so?
 *
 * PURE and import-free, so it is Node-tested (keyboard-viewport.test.mjs).
 * lib/native.ts feeds it `window.visualViewport` and writes the answer as the
 * CSS variables index.css documents (--ct-app-h, --ct-app-top, --ct-kb).
 *
 * THE NATIVE APP always engages: the web view has nothing else that shrinks
 * the visual viewport, and a zero keyboard simply writes the full height.
 *
 * A BROWSER ENGAGES ONLY ON EVIDENCE OF A VIRTUAL KEYBOARD, because the same
 * signal has innocent causes there:
 *   - a desktop PINCH-ZOOM shrinks visualViewport.height by the zoom factor,
 *     which reads exactly like a keyboard. A keyboard never changes `scale`,
 *     so any scale other than 1 is a zoom and is left alone.
 *   - a mouse-and-keyboard computer has no on-screen keyboard at all, so a
 *     fine pointer never engages.
 *   - the URL bar collapsing changes the height by a little; the floor keeps
 *     that out.
 *   - a keyboard only exists while you are typing, so focus must be in a text
 *     field. This is what makes it disengage the moment the field blurs, even
 *     if a resize event arrives late.
 * When it does not engage, the caller REMOVES the variables, so every screen
 * falls back to its CSS (100dvh and the plain safe-area inset) exactly as
 * before this existed.
 */

/** A URL bar or a toolbar is not a keyboard; below this it is not counted. */
export const KEYBOARD_FLOOR = 80

export interface ViewportReading {
  native: boolean
  /** window.innerHeight: the layout viewport. */
  innerHeight: number
  /** visualViewport.height / offsetTop / scale, or null without the API. */
  vvHeight: number | null
  vvTop: number | null
  vvScale: number | null
  /** matchMedia('(pointer: coarse)'): a finger, not a mouse. */
  coarse: boolean
  /** Focus is in something that raises a keyboard. */
  typing: boolean
}

export type KeyboardState =
  | { engaged: false }
  | { engaged: true; height: number; top: number; keyboard: number }

export function keyboardState(r: ViewportReading): KeyboardState {
  const height = r.vvHeight ?? r.innerHeight
  const top = Math.max(0, r.vvTop ?? 0)
  const covered = Math.max(0, r.innerHeight - (height + top))
  const keyboard = covered > KEYBOARD_FLOOR ? covered : 0

  if (r.native) {
    return { engaged: true, height: Math.round(height), top: Math.round(top), keyboard: Math.round(keyboard) }
  }
  if (r.vvHeight == null) return { engaged: false }
  if (!r.coarse || !r.typing) return { engaged: false }
  if (r.vvScale != null && Math.abs(r.vvScale - 1) > 0.01) return { engaged: false }
  if (keyboard === 0) return { engaged: false }
  return { engaged: true, height: Math.round(height), top: Math.round(top), keyboard: Math.round(keyboard) }
}

/** Does this element raise an on-screen keyboard? */
export function raisesKeyboard(el: { tagName?: string; type?: string; isContentEditable?: boolean; readOnly?: boolean } | null): boolean {
  if (!el) return false
  if (el.isContentEditable) return true
  if (el.readOnly) return false
  const tag = (el.tagName ?? '').toUpperCase()
  if (tag === 'TEXTAREA') return true
  if (tag !== 'INPUT') return false
  const type = (el.type ?? 'text').toLowerCase()
  return !['button', 'checkbox', 'radio', 'range', 'color', 'file', 'submit', 'reset', 'image', 'hidden'].includes(type)
}
