import { useRef, useState } from 'react'
import { hexToHsv, hsvToHex, type Hsv } from '@/lib/hsv'

const SIZE = 180

/**
 * A colour wheel: angle is hue, distance from the centre is saturation, and a
 * slider underneath sets brightness. Drag anywhere on the wheel.
 *
 * Hue and saturation are held locally while you drag: converting through hex
 * on every move loses the hue at the grey centre (a grey has no hue), so the
 * marker would jump back to red when you drag through it.
 *
 * Keyboard: arrow keys turn the hue (left/right) and move towards or away from
 * the centre (up/down); Shift makes the steps bigger.
 */
export function ColorWheel({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value))
  const [seen, setSeen] = useState(value)
  // A new value from outside (the hex field, a swatch) re-seeds the wheel.
  if (value !== seen && value.toLowerCase() !== hsvToHex(hsv)) {
    setSeen(value)
    setHsv(hexToHsv(value))
  }
  const wheel = useRef<HTMLDivElement>(null)

  const commit = (next: Hsv) => {
    setHsv(next)
    const hex = hsvToHex(next)
    setSeen(hex)
    onChange(hex)
  }

  const fromPointer = (x: number, y: number) => {
    const el = wheel.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const dx = x - (r.left + r.width / 2)
    const dy = y - (r.top + r.height / 2)
    // 0° at the top, clockwise — the same origin the conic gradient uses.
    const h = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360
    const s = Math.min(1, Math.hypot(dx, dy) / (r.width / 2))
    commit({ h, s, v: hsv.v || 1 })
  }

  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 2
    let { h, s } = hsv
    if (e.key === 'ArrowLeft') h = (h - step + 360) % 360
    else if (e.key === 'ArrowRight') h = (h + step) % 360
    else if (e.key === 'ArrowUp') s = Math.min(1, s + step / 100)
    else if (e.key === 'ArrowDown') s = Math.max(0, s - step / 100)
    else return
    e.preventDefault()
    e.stopPropagation()
    commit({ ...hsv, h, s })
  }

  const rad = ((hsv.h - 90) * Math.PI) / 180
  const mx = SIZE / 2 + Math.cos(rad) * hsv.s * (SIZE / 2)
  const my = SIZE / 2 + Math.sin(rad) * hsv.s * (SIZE / 2)
  const pure = hsvToHex({ h: hsv.h, s: hsv.s, v: 1 })

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        ref={wheel}
        role="slider"
        tabIndex={0}
        aria-label="Colour wheel: hue and saturation"
        aria-valuetext={`Hue ${Math.round(hsv.h)} degrees, saturation ${Math.round(hsv.s * 100)} percent`}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          try {
            e.currentTarget.setPointerCapture(e.pointerId)
          } catch {
            /* an unknown pointer: still pick the colour */
          }
          fromPointer(e.clientX, e.clientY)
        }}
        onPointerMove={(e) => e.buttons === 1 && fromPointer(e.clientX, e.clientY)}
        className="relative cursor-crosshair touch-none rounded-full"
        style={{
          width: SIZE,
          height: SIZE,
          background:
            'radial-gradient(circle closest-side, #fff, rgba(255,255,255,0)), conic-gradient(#f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
          filter: `brightness(${Math.max(0.15, hsv.v)})`,
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.45)]"
          style={{ left: mx, top: my, backgroundColor: hsvToHex(hsv) }}
        />
      </div>
      <input
        type="range"
        min={5}
        max={100}
        value={Math.round(hsv.v * 100)}
        onChange={(e) => commit({ ...hsv, v: Number(e.target.value) / 100 })}
        onKeyDown={(e) => e.stopPropagation()}
        aria-label="Brightness"
        className="ct-range w-full"
        style={{ background: `linear-gradient(to right, #000, ${pure})` }}
      />
    </div>
  )
}
