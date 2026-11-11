/**
 * The moving outline that says "this is the thing to touch". It replaces the
 * written hint: a light circles the border of the one control that matters on
 * the step, and stops the moment it has been used. The element needs
 * `relative` and its own border radius.
 */
export function beam(on: boolean): string {
  return on ? 'relative ct-ob-beam' : 'relative'
}
