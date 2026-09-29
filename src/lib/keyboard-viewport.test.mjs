// Node-run checks for lib/keyboard-viewport.ts (`npm run test:keyboard`).
import { keyboardState, raisesKeyboard } from './keyboard-viewport.ts'

let failed = 0
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok   ${name}`)
  else {
    failed++
    console.log(`  FAIL ${name} ${detail}`)
  }
}

// A 390x844 phone with a 336px keyboard, as Safari reports it.
const phone = { native: false, innerHeight: 844, vvHeight: 508, vvTop: 0, vvScale: 1, coarse: true, typing: true }

const s = keyboardState(phone)
check('phone + keyboard + typing engages', s.engaged)
check('height is the visible area', s.engaged && s.height === 508, JSON.stringify(s))
check('keyboard is what it covers', s.engaged && s.keyboard === 336, JSON.stringify(s))

// Safari pans the visual viewport instead of shrinking the layout one.
const panned = keyboardState({ ...phone, vvTop: 120 })
check('a pan is carried as top', panned.engaged && panned.top === 120 && panned.keyboard === 216, JSON.stringify(panned))

check('not typing: disengaged', !keyboardState({ ...phone, typing: false }).engaged)
check('mouse pointer (desktop): disengaged', !keyboardState({ ...phone, coarse: false }).engaged)
check('desktop pinch-zoom (scale 2): disengaged', !keyboardState({ ...phone, vvHeight: 422, vvScale: 2 }).engaged)
check('phone pinch-zoom while typing: disengaged', !keyboardState({ ...phone, vvScale: 1.6 }).engaged)
check('URL bar collapse (small change): disengaged', !keyboardState({ ...phone, vvHeight: 790 }).engaged)
check('no visualViewport API: disengaged', !keyboardState({ ...phone, vvHeight: null, vvTop: null, vvScale: null }).engaged)

// Native always engages, even with no keyboard, and writes the full height.
const nat = keyboardState({ ...phone, native: true, vvHeight: 844, typing: false, coarse: false })
check('native with no keyboard still engages', nat.engaged && nat.height === 844 && nat.keyboard === 0, JSON.stringify(nat))
const natKb = keyboardState({ ...phone, native: true })
check('native with keyboard', natKb.engaged && natKb.height === 508 && natKb.keyboard === 336)

check('textarea raises a keyboard', raisesKeyboard({ tagName: 'TEXTAREA' }))
check('text input raises a keyboard', raisesKeyboard({ tagName: 'INPUT', type: 'text' }))
check('search input raises a keyboard', raisesKeyboard({ tagName: 'input', type: 'search' }))
check('checkbox does not', !raisesKeyboard({ tagName: 'INPUT', type: 'checkbox' }))
check('button does not', !raisesKeyboard({ tagName: 'BUTTON' }))
check('read-only input does not', !raisesKeyboard({ tagName: 'INPUT', type: 'text', readOnly: true }))
check('contenteditable does', raisesKeyboard({ tagName: 'DIV', isContentEditable: true }))
check('nothing focused does not', !raisesKeyboard(null))

if (failed) {
  console.log(`\n${failed} failed`)
  process.exit(1)
}
console.log('\nkeyboard-viewport: all checks passed')
