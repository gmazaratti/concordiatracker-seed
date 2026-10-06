import { useRef, useState } from 'react'

/** hex ↔ HSV, enough for a picker. */
function hexToHsv(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return [0, 0, 0]
  const n = parseInt(m[1], 16)
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  let h = 0
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [((h * 60) + 360) % 360, max ? d / max : 0, max]
}

function hsvToHex(h: number, s: number, v: number): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6
    return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))))
  }
  return `#${[f(5), f(3), f(1)].map((x) => x.toString(16).padStart(2, '0')).join('')}`
}

/**
 * A real colour picker: a saturation/brightness square, a hue strip and a hex
 * field, all driven by pointer drag (mouse, pen or finger). No native <input
 * type=color> — it looks different on every OS and cannot be themed.
 */
export function HsvPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [hsv, setHsv] = useState(() => hexToHsv(value))
  const [hexText, setHexText] = useState(value)
  const square = useRef<HTMLDivElement>(null)
  const strip = useRef<HTMLDivElement>(null)

  const emit = (next: [number, number, number]) => {
    setHsv(next)
    const hex = hsvToHex(...next)
    setHexText(hex)
    onChange(hex)
  }

  const drag = (e: React.PointerEvent, el: HTMLDivElement | null, apply: (x: number, y: number) => void) => {
    if (!el) return
    e.preventDefault()
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      /* a pointer the browser no longer tracks */
    }
    const move = (ev: PointerEvent | React.PointerEvent) => {
      const r = el.getBoundingClientRect()
      apply(Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)))
    }
    move(e)
    const up = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
  }

  const [h, s, v] = hsv
  return (
    <div className="flex w-56 flex-col gap-2.5">
      <div
        ref={square}
        onPointerDown={(e) => drag(e, square.current, (x, y) => emit([h, x, 1 - y]))}
        className="relative h-36 w-full cursor-crosshair touch-none rounded-lg"
        style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${h} 100% 50%))` }}
      >
        <span className="pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow" style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%` }} />
      </div>
      <div
        ref={strip}
        onPointerDown={(e) => drag(e, strip.current, (x) => emit([x * 359.9, s, v]))}
        className="relative h-3 w-full cursor-pointer touch-none rounded-full"
        style={{ background: 'linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)' }}
      >
        <span className="pointer-events-none absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow" style={{ left: `${(h / 360) * 100}%` }} />
      </div>
      <div className="flex items-center gap-2">
        <span className="size-7 shrink-0 rounded-md border border-border" style={{ background: hsvToHex(h, s, v) }} />
        <input
          value={hexText}
          onChange={(e) => {
            const t = e.target.value
            setHexText(t)
            const full = t.startsWith('#') ? t : `#${t}`
            if (/^#[0-9a-f]{6}$/i.test(full)) {
              setHsv(hexToHsv(full))
              onChange(full.toLowerCase())
            }
          }}
          aria-label="Hex colour"
          spellCheck={false}
          maxLength={7}
          className="h-8 min-w-0 flex-1 rounded-md border border-border bg-surface-2 px-2 font-mono text-[12.5px] text-fg uppercase outline-none focus:border-accent"
        />
      </div>
    </div>
  )
}
