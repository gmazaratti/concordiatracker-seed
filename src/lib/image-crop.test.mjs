/**
 * Crop geometry. The point of testing it away from the DOM is the invariant:
 * whatever anybody drags, the image still covers the frame. A gap at an edge
 * only shows up on the published profile, which is far too late to find it.
 */
import {
  IDENTITY_VIEW,
  MAX_ZOOM,
  clampOffset,
  coverScale,
  displaySize,
  normalizeView,
  offsetBounds,
  outputSize,
  rotatedSize,
  transformSteps,
  turn,
  zoomAbout,
} from './image-crop.ts'

let failed = 0
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok    ${name}`)
  else {
    failed++
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps

const SQUARE = { w: 1000, h: 1000 }
const WIDE = { w: 2000, h: 500 }
const TALL = { w: 400, h: 1600 }
const FRAME = { w: 300, h: 300 }
const BANNER_FRAME = { w: 400, h: 100 }

console.log('\nCover, not fit')
{
  // A wide image in a square frame must scale on its HEIGHT, or there are
  // transparent bars at the sides.
  check('wide into square scales by height', near(coverScale(WIDE, FRAME), 300 / 500))
  check('tall into square scales by width', near(coverScale(TALL, FRAME), 300 / 400))
  check('square into square is exact', near(coverScale(SQUARE, FRAME), 0.3))
  const d = displaySize(WIDE, FRAME, IDENTITY_VIEW)
  check('at zoom 1 the display covers the frame', d.w >= FRAME.w - 1e-9 && d.h >= FRAME.h - 1e-9,
    `${d.w}x${d.h}`)
  check('and the tight axis is EXACTLY the frame', near(d.h, FRAME.h), String(d.h))
}

console.log('\nRotation swaps the axes')
{
  check('90° swaps', rotatedSize(WIDE, 90).w === 500 && rotatedSize(WIDE, 90).h === 2000)
  check('180° does not', rotatedSize(WIDE, 180).w === 2000)
  // Rotated upright, a 2000x500 becomes 500x2000 — now the WIDTH is tight.
  check('cover follows the rotation', near(coverScale(WIDE, FRAME, 90), 300 / 500))
  check('turn wraps forward', turn(270, 1) === 0)
  check('turn wraps backward', turn(0, -1) === 270)
  check('turn takes many quarters', turn(90, 6) === 270)
}

console.log('\nThe image can never be dragged off the frame')
{
  // Square in square at zoom 1: nothing spare on either axis.
  const b0 = offsetBounds(SQUARE, FRAME, IDENTITY_VIEW)
  check('no slack at zoom 1 when the aspects match', b0.w === 0 && b0.h === 0)
  const pinned = clampOffset(SQUARE, FRAME, { ...IDENTITY_VIEW, x: 999, y: -999 })
  check('so a huge drag resolves to dead centre', pinned.x === 0 && pinned.y === 0)

  // Wide in square at zoom 1: slack horizontally, none vertically.
  const b1 = offsetBounds(WIDE, FRAME, IDENTITY_VIEW)
  check('a wide image pans sideways only', b1.w > 0 && b1.h === 0, `${b1.w}/${b1.h}`)
  const c1 = clampOffset(WIDE, FRAME, { ...IDENTITY_VIEW, x: 10_000, y: 10_000 })
  check('x clamps to the bound', near(c1.x, b1.w))
  check('y is pinned', c1.y === 0)

  // Zooming in creates slack on both axes.
  const b2 = offsetBounds(SQUARE, FRAME, { ...IDENTITY_VIEW, zoom: 2 })
  check('zooming creates slack', near(b2.w, 150) && near(b2.h, 150), `${b2.w}/${b2.h}`)
}

console.log('\nnormalizeView is the one gate')
{
  const n = normalizeView(SQUARE, FRAME, { ...IDENTITY_VIEW, zoom: 0.2, x: 500, y: 500 })
  check('zoom can never go under cover', n.zoom === 1)
  check('and the offset comes back legal', n.x === 0 && n.y === 0)
  check('zoom is capped', normalizeView(SQUARE, FRAME, { ...IDENTITY_VIEW, zoom: 99 }).zoom === MAX_ZOOM)
  // Idempotent: running it twice must not move anything, or the preview and
  // the stored state disagree by a frame.
  const once = normalizeView(WIDE, FRAME, { ...IDENTITY_VIEW, zoom: 1.7, x: 40, y: -12 })
  const twice = normalizeView(WIDE, FRAME, once)
  check('idempotent', near(once.x, twice.x) && near(once.y, twice.y) && once.zoom === twice.zoom)
}

console.log('\nZoom keeps the point under the cursor')
{
  // Zoom 1 -> 2 about a point 50px right of centre. That image point sat at
  // (50 - x)/s from the centre; after doubling it must still land on 50.
  const start = { ...IDENTITY_VIEW, zoom: 1 }
  const z = zoomAbout(SQUARE, FRAME, start, 2, 50, 0)
  // Where does the image point that WAS at +50 end up now?
  const imagePt = (50 - start.x) / start.zoom
  const after = z.x + imagePt * z.zoom
  check('the anchor point does not move', near(after, 50, 1e-9), String(after))
  check('and the result is still legal', Math.abs(z.x) <= offsetBounds(SQUARE, FRAME, z).w + 1e-9)

  // Zooming about the centre is the plain case.
  const zc = zoomAbout(SQUARE, FRAME, start, 2, 0, 0)
  check('centre zoom leaves the offset alone', near(zc.x, 0) && near(zc.y, 0))
  check('zoom out below 1 is refused here too', zoomAbout(SQUARE, FRAME, start, 0.1, 0, 0).zoom === 1)
}

console.log('\nThe transform the preview and the export share')
{
  const v = { ...IDENTITY_VIEW, zoom: 1.5, x: 12, y: -8, flipX: true }
  const t = transformSteps(SQUARE, FRAME, v)
  check('translate is the raw offset', t.translate.x === 12 && t.translate.y === -8)
  check('scale is cover × zoom', near(Math.abs(t.scale.x), 0.3 * 1.5))
  check('flipX negates only x', t.scale.x < 0 && t.scale.y > 0)
  check('rotation rides along', transformSteps(SQUARE, FRAME, { ...v, rotation: 90 }).rotate === 90)
}

console.log('\nOutput sizes match the aspects we quote')
{
  const logo = outputSize('logo')
  check('logo is square', logo.w === 512 && logo.h === 512)
  const banner = outputSize('banner')
  check('banner is 4:1', banner.w === 1600 && banner.h === 400)
  const ev = outputSize('eventBanner')
  check('event banner is 16:9', ev.w === 1280 && ev.h === 720)
}

console.log('\nAwkward input')
{
  check('a zero-sized image does not divide by zero', coverScale({ w: 0, h: 0 }, FRAME) === 1)
  const b = offsetBounds(WIDE, BANNER_FRAME, IDENTITY_VIEW)
  // 2000x500 into 400x100: both aspects are 4:1, so it fits exactly — no slack.
  check('a matching aspect has no slack on either axis', b.w === 0 && b.h === 0, `${b.w}/${b.h}`)
}

console.log(failed === 0 ? '\nimage-crop: all checks passed' : `\nimage-crop: ${failed} FAILED`)
process.exit(failed === 0 ? 0 : 1)
