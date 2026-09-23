/**
 * Where a dragged carousel lands. Pure arithmetic, so it is tested as such —
 * a scroller in a headless pane cannot answer these questions (a frozen
 * timeline never runs a smooth scroll, and scroll offsets read across a timer
 * do not agree with the ones written inside the gesture).
 */
import { landingFrame, project } from './carousel.ts'

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

console.log(failed === 0 ? '\ncarousel: all checks passed' : `\ncarousel: ${failed} FAILED`)
process.exit(failed === 0 ? 0 : 1)
