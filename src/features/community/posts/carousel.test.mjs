/**
 * Where a dragged carousel lands. Pure arithmetic, so it is tested as such —
 * a scroller in a headless pane cannot answer these questions (a frozen
 * timeline never runs a smooth scroll, and scroll offsets read across a timer
 * do not agree with the ones written inside the gesture).
 */
import { landingFrame, project, springSettled, springStep } from './carousel.ts'

let failed = 0
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok    ${name}`)
  else {
    failed++
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const W = 390
/**
 * `over` is how far the STRIP travelled, not the pointer: dragging the
 * pointer LEFT scrolls the strip RIGHT, so advancing a frame is a positive
 * `over` with a negative pointer velocity.
 */
const at = (frame, over, velocity, count = 3) =>
  landingFrame({
    startLeft: frame * W,
    scrollLeft: frame * W + over,
    width: W,
    velocity,
    count,
  })

console.log('\nProjection')
check('a still pointer projects nothing', project(0) === 0)
check('rightward projects forward', project(1000) > 0)
check('faster goes further', project(2000) > project(1000))
check(
  'a 1500px/s flick projects about 150px',
  Math.abs(project(1500) - 148.5) < 0.01,
  String(project(1500)),
)

console.log('\nA drag that has barely moved')
// 20px is 5% of a frame, and the pointer was slow: this is a hesitation.
check('20px at 100px/s stays put', at(0, 20, -100) === 0)
check('4px stays put', at(1, 4, 0) === 1)
check('exactly 12% of a frame is not enough', at(0, W * 0.12, 0) === 0)

console.log('\nA short but decisive flick')
// The whole point: Instagram turns the page on a flick a third of the way.
check('a third of a frame, flicked left, advances', at(0, 130, -900) === 1)
check('a third of a frame, flicked right, goes back', at(2, -130, 900) === 1)
check('13% with no velocity still advances', at(0, W * 0.13, 0) === 1)

console.log('\nA long drag')
check('past the midpoint advances even when released still', at(0, 220, 0) === 1)
check('dragging back past the midpoint returns', at(1, -220, 0) === 0)

console.log('\nOne frame per gesture')
// A hard flick projects ~1,500px, which is four frames. It must not.
check('a violent flick still moves exactly one', at(0, 60, -15000) === 1)
check('a violent flick backwards moves exactly one', at(2, -60, 15000) === 1)
check(
  'the clamp is relative to where the drag STARTED',
  at(1, 300, -9000) === 2,
  String(at(1, 300, -9000)),
)

console.log('\nThe ends')
check('cannot go before the first frame', at(0, -80, 4000) === 0)
check('cannot go past the last frame', at(2, 80, -4000, 3) === 2)
check('a single-image post has nowhere to go', at(0, 300, -4000, 1) === 0)

console.log('\nThe spring')
// Run it the way a browser would: 60fps until it settles or gives up.
function run(from, to, v0, opts = {}) {
  let s = { x: from, v: v0 }
  const path = [s.x]
  for (let i = 0; i < 600; i++) {
    s = springStep(s, to, 1 / 60, opts.response, opts.damping)
    path.push(s.x)
    if (springSettled(s, to)) break
  }
  return { s, path, frames: path.length }
}

const still = run(0, 390, 0)
check('a spring at rest reaches its target', Math.abs(still.s.x - 390) < 0.5)
check(
  'and gets there in about a third of a second',
  still.frames > 8 && still.frames < 45,
  `${still.frames} frames`,
)
check(
  'it OVERSHOOTS on the way — the point of the whole thing',
  Math.max(...still.path) > 390,
  `max ${Math.max(...still.path).toFixed(1)}`,
)
check('and comes back rather than staying past it', still.s.x <= 390.5)

// The handover: a flick already moving toward the target must not slow down
// first, which is exactly what a from-zero ease does.
const flicked = run(0, 390, 900)
check('a flick toward the target starts fast', flicked.path[1] > still.path[1])
check('and still lands on it', Math.abs(flicked.s.x - 390) < 0.5)

const critical = run(0, 390, 0, { damping: 1 })
check('damping 1 does not overshoot', Math.max(...critical.path) <= 390.5)

check(
  'a dropped frame does not blow it up',
  Number.isFinite(springStep({ x: 0, v: 0 }, 390, 0.032).x),
)
check('settled is false while it is still moving', !springSettled({ x: 390, v: 400 }, 390))
check('settled is false while it is still far away', !springSettled({ x: 100, v: 0 }, 390))
check('settled is true when it is there and stopped', springSettled({ x: 390.2, v: 3 }, 390))


console.log(failed === 0 ? '\ncarousel: all checks passed' : `\ncarousel: ${failed} FAILED`)
process.exit(failed === 0 ? 0 : 1)
