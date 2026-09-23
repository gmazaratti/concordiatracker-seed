/**
 * Where a dragged carousel lands.
 *
 * PURE, AND SEPARATE FROM THE COMPONENT, because this is the part with the
 * judgement in it — whether a nudge counts as turning the page, and how far a
 * flick is allowed to throw you — and none of that is observable by looking
 * at a scroller. It is arithmetic, so it is tested as arithmetic.
 */

/**
 * Where a flick is going, not where it stopped: the exponential-decay
 * projection a scroller decelerates on, rather than the physics-textbook
 * v²/2a. A rate of 0.99 settles quickly, which is what a carousel wants — a
 * photo still gliding after the mouse is up reads as a page that did not stop
 * when it was told to.
 */
export function project(velocity: number, decelerationRate = 0.99): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate)
}

export interface DragEnd {
  /** Where the strip was when the drag started, in pixels. */
  startLeft: number
  /** Where it is now. */
  scrollLeft: number
  /** One frame. */
  width: number
  /** The pointer's velocity at release, px/s. Rightward is positive, which is
   *  the opposite direction to the scroll it produces. */
  velocity: number
  count: number
}

/** The frame a drag should settle on. */
export function landingFrame({ startLeft, scrollLeft, width, velocity, count }: DragEnd): number {
  const w = Math.max(1, width)
  const from = Math.round(startLeft / w)
  const travelled = scrollLeft - startLeft
  let i = Math.round((scrollLeft + project(-velocity)) / w)

  // A SHORT, DECISIVE FLICK STILL TURNS THE PAGE. Rounding alone asks for
  // half a frame of travel, which reads as the drag not having taken.
  if (i === from && Math.abs(travelled) > w * 0.12) i += travelled > 0 ? 1 : -1

  // ONE FRAME PER GESTURE. A hard flick projects hundreds of pixels, and
  // landing three photos along loses your place in a set you were looking
  // through — the projection decides WHETHER to turn the page, not how far.
  i = Math.max(from - 1, Math.min(from + 1, i))
  return Math.max(0, Math.min(count - 1, i))
}

/* ── Settling ─────────────────────────────────────────────────────────────── */

/**
 * A spring, stepped one frame at a time.
 *
 * `behavior: 'smooth'` eases to a stop and reads as a snap: the strip arrives
 * at exactly the target and halts, which is the one thing a physical object
 * does not do. A spring carries the velocity of the flick through the landing
 * and overshoots slightly before settling, which is what makes a carousel feel
 * thrown rather than assigned.
 *
 * APPLE'S TWO PARAMETERS, not mass/stiffness/damping. `response` is roughly
 * how long it takes to get there; `damping` below 1 is how much it overshoots
 * (1.0 is critically damped, no bounce). 0.4s / 0.78 is the "move something
 * the user threw" pair from the fluid-interfaces talk.
 */
export interface SpringState {
  x: number
  v: number
}

export const SPRING_RESPONSE = 0.4
export const SPRING_DAMPING = 0.78

/**
 * Semi-implicit Euler, which is stable at the step sizes a browser produces
 * where the explicit form diverges on a dropped frame. `dt` is seconds and is
 * clamped by the caller for the same reason.
 */
export function springStep(
  s: SpringState,
  target: number,
  dt: number,
  response = SPRING_RESPONSE,
  damping = SPRING_DAMPING,
): SpringState {
  const w = (2 * Math.PI) / response
  const a = -(w * w) * (s.x - target) - 2 * damping * w * s.v
  const v = s.v + a * dt
  return { x: s.x + v * dt, v }
}

/** Near enough, and slow enough, that another frame would not be visible. */
export function springSettled(s: SpringState, target: number): boolean {
  return Math.abs(s.x - target) < 0.5 && Math.abs(s.v) < 25
}
