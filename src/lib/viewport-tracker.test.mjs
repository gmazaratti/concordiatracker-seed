// Node-run WIRING checks for lib/viewport-tracker.ts (`npm run test:keyboard`).
//
// keyboard-viewport.test.mjs proves the maths. This proves the plumbing: the
// real trackViewport, attached to fake window / document / visualViewport
// objects, receiving events in the order a phone sends them, writing (or
// removing) the CSS variables. Frames are flushed by hand, so the rAF
// coalescing is exercised exactly as shipped.
import { trackViewport } from './viewport-tracker.ts'

let failed = 0
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok   ${name}`)
  else {
    failed++
    console.log(`  FAIL ${name} ${detail}`)
  }
}

/** A fresh fake page. `ios` makes innerHeight AND clientHeight follow the
 *  keyboard, the worst case the WebKit bugs describe. */
function page({ coarse = true, ios = true } = {}) {
  let frames = []
  const vars = new Map()
  const classes = new Set()
  const vv = Object.assign(new EventTarget(), { height: 844, offsetTop: 0, scale: 1 })
  const docEl = {
    clientHeight: 844,
    style: {
      setProperty: (k, v) => vars.set(k, v),
      removeProperty: (k) => vars.delete(k),
    },
    classList: {
      toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)),
    },
  }
  const doc = Object.assign(new EventTarget(), { documentElement: docEl, activeElement: { tagName: 'BODY' } })
  const win = Object.assign(new EventTarget(), {
    innerWidth: 390,
    innerHeight: 844,
    scrollY: 0,
    scrollTo: () => {},
    visualViewport: vv,
    matchMedia: () => ({ matches: coarse }),
  })
  globalThis.window = win
  globalThis.document = doc
  globalThis.requestAnimationFrame = (cb) => frames.push(cb)
  return {
    vv,
    win,
    doc,
    vars,
    classes,
    frames: () => frames.length,
    flush() {
      const run = frames
      frames = []
      run.forEach((cb) => cb(0))
    },
    /** The keyboard sliding to `kb` px, as iOS reports it. */
    keyboard(kb) {
      vv.height = 844 - kb
      if (ios) {
        win.innerHeight = 844 - kb
        docEl.clientHeight = 844 - kb
      }
    },
  }
}

// ── The real sequence on a phone ────────────────────────────────────────────
{
  const p = page()
  trackViewport(false)
  check('load, keyboard closed: nothing written', p.vars.size === 0 && p.classes.size === 0)

  p.doc.activeElement = { tagName: 'TEXTAREA' }
  p.doc.dispatchEvent(new Event('focusin'))
  check('focusin schedules a frame', p.frames() === 1)
  p.flush()
  check('focused, keyboard not yet up: still nothing', p.vars.size === 0)

  p.keyboard(336)
  p.vv.dispatchEvent(new Event('resize'))
  p.vv.dispatchEvent(new Event('resize'))
  p.vv.dispatchEvent(new Event('scroll'))
  check('three events in one frame coalesce to one write', p.frames() === 1)
  p.flush()
  check('keyboard up: --ct-app-h is the visible height', p.vars.get('--ct-app-h') === '508px', String(p.vars.get('--ct-app-h')))
  check('keyboard up: --ct-kb is the keyboard, even with innerHeight shrunk', p.vars.get('--ct-kb') === '336px', String(p.vars.get('--ct-kb')))
  check('keyboard up: ct-kb-open is set', p.classes.has('ct-kb-open'))

  p.vv.offsetTop = 120
  p.vv.dispatchEvent(new Event('scroll'))
  p.flush()
  check('a Safari pan moves --ct-app-top', p.vars.get('--ct-app-top') === '120px', String(p.vars.get('--ct-app-top')))

  p.doc.activeElement = { tagName: 'BODY' }
  p.doc.dispatchEvent(new Event('focusout'))
  p.vv.offsetTop = 0
  p.keyboard(0)
  p.vv.dispatchEvent(new Event('resize'))
  p.flush()
  check('blur + keyboard down: variables removed', p.vars.size === 0, JSON.stringify([...p.vars]))
  check('blur + keyboard down: ct-kb-open cleared', !p.classes.has('ct-kb-open'))

  // A second open after the first must work the same (the baseline survives).
  p.doc.activeElement = { tagName: 'TEXTAREA' }
  p.doc.dispatchEvent(new Event('focusin'))
  p.keyboard(300)
  p.vv.dispatchEvent(new Event('resize'))
  p.flush()
  check('second open is detected too', p.vars.get('--ct-kb') === '300px', String(p.vars.get('--ct-kb')))
}

// ── Rotation resets the baseline rather than reading as a keyboard ──────────
{
  const p = page()
  trackViewport(false)
  p.win.innerWidth = 844
  p.win.innerHeight = 390
  p.doc.documentElement.clientHeight = 390
  p.vv.height = 390
  p.doc.activeElement = { tagName: 'INPUT', type: 'text' }
  p.win.dispatchEvent(new Event('resize'))
  p.flush()
  check('rotating to landscape with a field focused is not a keyboard', p.vars.size === 0, JSON.stringify([...p.vars]))
}

// ── Desktop: a fine pointer never engages ───────────────────────────────────
{
  const p = page({ coarse: false })
  trackViewport(false)
  p.doc.activeElement = { tagName: 'TEXTAREA' }
  p.doc.dispatchEvent(new Event('focusin'))
  p.keyboard(336)
  p.vv.dispatchEvent(new Event('resize'))
  p.flush()
  check('desktop with a keyboard-shaped viewport: nothing written', p.vars.size === 0)
}

// ── Native: always written, and the keyboard is still measured ─────────────
{
  const p = page()
  trackViewport(true)
  check('native at load: full height written', p.vars.get('--ct-app-h') === '844px' && p.vars.get('--ct-kb') === '0px')
  p.doc.activeElement = { tagName: 'TEXTAREA' }
  p.keyboard(336)
  p.vv.dispatchEvent(new Event('resize'))
  p.flush()
  check('native with keyboard: --ct-kb measured despite innerHeight shrinking', p.vars.get('--ct-kb') === '336px', String(p.vars.get('--ct-kb')))
  check('native with keyboard: ct-kb-open set', p.classes.has('ct-kb-open'))
}

if (failed) {
  console.log(`\n${failed} failed`)
  process.exit(1)
}
console.log('\nviewport-tracker wiring: all checks passed')
