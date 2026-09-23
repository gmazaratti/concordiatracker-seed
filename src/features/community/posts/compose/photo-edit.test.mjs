// Node checks for the photo maths. Run: node src/features/community/posts/compose/photo-edit.test.mjs
// photo-edit.ts has no imports, so Node 24 runs it directly (type stripping).
import {
  FILTERS,
  NO_ADJUST,
  applyAdjust,
  applyMatrix,
  colorMatrix,
  combine,
  coverRect,
  cssFilter,
  isIdentity,
  outputSize,
  presetAdjust,
  ratioFor,
  wrapText,
} from './photo-edit.ts'

let fails = 0
const ok = (label, cond, detail = '') => {
  if (cond) console.log('  ok   ', label)
  else {
    fails++
    console.log('  FAIL ', label, detail)
  }
}
const close = (a, b, eps = 1.5) => Math.abs(a - b) <= eps
const px = (r, g, b) => new Uint8ClampedArray([r, g, b, 255])

console.log('filters')
ok('Normal is the identity', isIdentity(presetAdjust('none')) && cssFilter(presetAdjust('none')) === 'none')
ok('an unknown preset falls back to Normal', isIdentity(presetAdjust('nope')))
ok('every preset has a label', FILTERS.every((f) => f.label && f.id))
ok('css lists only what changed, in matrix order',
  cssFilter({ ...NO_ADJUST, contrast: 1.2, brightness: 1.1 }) === 'brightness(1.1) contrast(1.2)')

console.log('matrix = the CSS formulas')
{
  // brightness(2) then contrast(0.5): 0.5 → 1.0 → 0.5*1 + 0.25 = 0.75
  const p = px(128, 128, 128)
  applyMatrix(p, colorMatrix({ ...NO_ADJUST, brightness: 2, contrast: 0.5 }))
  ok('brightness is applied before contrast', close(p[0], 0.75 * 255 + 0.25, 2), `got ${p[0]}`)
}
{
  const p = px(200, 40, 90)
  applyMatrix(p, colorMatrix({ ...NO_ADJUST, grayscale: 1 }))
  ok('grayscale(1) gives equal channels', p[0] === p[1] && p[1] === p[2], `${p[0]} ${p[1]} ${p[2]}`)
  const lum = 0.2126 * 200 + 0.7152 * 40 + 0.0722 * 90
  ok('grayscale uses the spec luminance weights', close(p[0], lum), `got ${p[0]} want ${lum.toFixed(1)}`)
}
{
  const p = px(200, 40, 90)
  applyMatrix(p, colorMatrix({ ...NO_ADJUST, saturate: 0 }))
  ok('saturate(0) is grey', close(p[0], p[1]) && close(p[1], p[2]), `${p[0]} ${p[1]} ${p[2]}`)
}
{
  // 0.8 * 2 = 1.6 → the browser clamps to 1 BEFORE contrast → 0.75.
  // One composed matrix would give 1.05 → 255 instead.
  const p = px(204, 204, 204)
  applyAdjust(p, { ...NO_ADJUST, brightness: 2, contrast: 0.5 })
  ok('each step clamps before the next, as CSS does', close(p[0], 0.75 * 255, 2), `got ${p[0]}`)
}
{
  const p = px(255, 255, 255)
  applyMatrix(p, colorMatrix({ ...NO_ADJUST, brightness: 1.5 }))
  ok('channels clamp at 255', p[0] === 255 && p[1] === 255)
}
{
  const p = px(10, 200, 30)
  const before = [...p]
  applyMatrix(p, colorMatrix(NO_ADJUST))
  ok('the identity matrix changes nothing', p.every((v, i) => v === before[i]))
  ok('alpha is untouched', p[3] === 255)
}
{
  const a = combine(presetAdjust('vivid'), { ...NO_ADJUST, brightness: 1.2 })
  ok('a slider stacks on a preset', close(a.brightness, 1.2, 1e-9) && close(a.saturate, 1.35, 1e-9))
  const g = combine(presetAdjust('mono'), { ...NO_ADJUST, grayscale: 0.5 })
  ok('additive parts clamp at 1', g.grayscale === 1)
}

console.log('shape')
ok('square is 1', ratioFor('square', null) === 1)
ok('portrait is 4:5', ratioFor('portrait', { w: 100, h: 50 }) === 0.8)
ok('original follows the first photo', close(ratioFor('original', { w: 1600, h: 1200 }), 4 / 3, 1e-9))
ok('original clamps a tall photo to 4:5', ratioFor('original', { w: 1000, h: 3000 }) === 0.8)
ok('original clamps a panorama to 1.91:1', ratioFor('original', { w: 4000, h: 1000 }) === 1.91)
{
  const r = coverRect(2000, 1000, 1)
  ok('a wide photo is cropped at the sides, centred', r.sw === 1000 && r.sh === 1000 && r.sx === 500 && r.sy === 0)
  const l = coverRect(2000, 1000, 1, 0, 0.5)
  ok('pan 0 keeps the left edge', l.sx === 0)
  const t = coverRect(1000, 2000, 1, 0.5, 1)
  ok('a tall photo pans vertically', t.sy === 1000 && t.sh === 1000)
  const c = coverRect(1000, 1000, 1, 3, -2)
  ok('pan is clamped to the photo', c.sx === 0 && c.sy === 0)
}
ok('output keeps the ratio with the long edge capped',
  JSON.stringify(outputSize(0.8, 1440)) === JSON.stringify({ w: 1152, h: 1440 }) &&
  JSON.stringify(outputSize(1.5, 1440)) === JSON.stringify({ w: 1440, h: 960 }))

console.log('text')
{
  const measure = (s) => s.length * 10
  const lines = wrapText('build night starts at eight', 120, measure)
  ok('wraps on words', lines.length === 3 && lines[0] === 'build night', JSON.stringify(lines))
  ok('keeps explicit line breaks', wrapText('a\nb', 1000, measure).length === 2)
  ok('a long word is not split', wrapText('supercalifragilistic', 50, measure)[0] === 'supercalifragilistic')
}

console.log(fails ? `photo-edit: ${fails} FAILED` : 'photo-edit: all checks passed')
process.exit(fails ? 1 : 0)
