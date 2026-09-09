/**
 * The week-image layout maths.
 *
 *   node src/features/profile/schedule-image.test.mjs
 *
 * Drawn on a canvas rather than screenshotted, so the geometry is ours to get
 * wrong — and a schedule image that clips someone's 8am or their Friday is
 * worse than no image at all.
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..', '..', '..')
const out = path.join(here, '.schedimg.tmp.mjs')
execSync(
  `npx esbuild "${path.join(root, 'src/features/profile/schedule-image.ts')}" --bundle --format=esm --alias:@=./src --outfile="${out}"`,
  { stdio: 'pipe', cwd: root },
)
const { weekBounds, imageSize, colorForCodes } = await import(pathToFileURL(out).href)
fs.rmSync(out, { force: true })

let failed = 0
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  ok    ${name}`)
  else {
    failed++
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

console.log('\nthe window it draws')
{
  const b = weekBounds([])
  check('an empty week still draws a teaching day', b.start === 480 && b.end === 1080)
}
{
  // An 8:45 start must not be cut in half by a grid that begins at 9.
  const b = weekBounds([{ code: 'FINA 210', meets: 'Tue 08:45–11:30' }])
  check('a normal day needs no extra room', b.start === 480 && b.end === 1080)
}
{
  const b = weekBounds([{ code: 'X', meets: 'Mon 07:15–08:30' }])
  check('an early class extends the top', b.start === 420, String(b.start))
}
{
  const b = weekBounds([{ code: 'X', meets: 'Thu 19:00–21:45' }])
  check('a late class extends the bottom', b.end === 1320, String(b.end))
}
{
  const b = weekBounds([
    { code: 'A', meets: 'Mon 07:30–09:00' },
    { code: 'B', meets: 'Fri 20:00–22:00' },
  ])
  check('both ends at once', b.start === 420 && b.end === 1320)
}
{
  // Unreadable times must not silently produce a zero-height image.
  const b = weekBounds([{ code: 'ONLINE', meets: '' }])
  check('a class with no time changes nothing', b.start === 480 && b.end === 1080)
}

console.log('\nimage size')
{
  const a = imageSize([])
  const b = imageSize([{ code: 'X', meets: 'Mon 07:00–08:00' }])
  check('a fixed width', a.width === 900 && b.width === 900)
  check('an earlier start makes a taller image', b.height > a.height, `${a.height} vs ${b.height}`)
  check('never zero height', a.height > 100, String(a.height))
}

console.log('\ncolours')
{
  const of = colorForCodes(['COMM 225', 'FINA 210', 'COMM 225'])
  check('the same code is the same colour', of('COMM 225') === of('COMM 225'))
  check('different codes differ', of('COMM 225') !== of('FINA 210'))
  check('an unknown code still gets one', typeof of('ZZZZ 999') === 'string')
}

console.log(
  failed === 0 ? '\nschedule-image: all checks passed' : `\nschedule-image: ${failed} FAILED`,
)
process.exit(failed === 0 ? 0 : 1)
