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
