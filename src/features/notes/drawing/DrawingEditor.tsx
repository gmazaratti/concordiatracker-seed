import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Circle, Eraser, Highlighter, Minus, PenLine, Plus, RectangleHorizontal, Trash2, Undo2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  addPoint, hits, MAX_HEIGHT, MAX_POINTS, MAX_STROKES, pointCount, strokePath, WIDTH,
  type Stroke, type Tool,
} from './drawing-model'

const COLORS = ['#111111', '#e5484d', '#f76b15', '#d6a100', '#30a46c', '#0090ff', '#3e63dd', '#8e4ec6']
const WIDTHS = [2, 4, 8]
const TOOLS: { id: Tool; label: string; icon: typeof PenLine }[] = [
  { id: 'pen', label: 'Pen', icon: PenLine },
  { id: 'hl', label: 'Highlighter', icon: Highlighter },
  { id: 'eraser', label: 'Eraser', icon: Eraser },
  { id: 'line', label: 'Line', icon: Minus },
  { id: 'rect', label: 'Rectangle', icon: RectangleHorizontal },
  { id: 'ellipse', label: 'Ellipse', icon: Circle },
]

/**
 * Drawing on a page: pen, highlighter, stroke eraser and three shapes.
 *
 * PALM REJECTION: once a stylus has touched the board, touches from fingers
 * and palms are ignored for the rest of the session, so a hand resting on an
 * iPad screen does not draw. Before any stylus is seen a finger can draw,
 * which is what someone without a pen needs.
 */
export function DrawingEditor({ initial, initialHeight, onDone, onCancel }: {
  initial: Stroke[]
  initialHeight: number
  onDone: (strokes: Stroke[], height: number) => void
  onCancel: () => void
}) {
  const [strokes, setStrokes] = useState<Stroke[]>(initial)
  const [height, setHeight] = useState(initialHeight)
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState(COLORS[0])
  const [width, setWidth] = useState(WIDTHS[0])
  const [live, setLive] = useState<Stroke | null>(null)
  const [history, setHistory] = useState<Stroke[][]>([])
  const svg = useRef<SVGSVGElement>(null)
  const penSeen = useRef(false)
  const active = useRef<number | null>(null)
  // The stroke being drawn lives in a ref as well as in state: a quick flick
  // can deliver its last move and its release in one task, before React has
  // re-rendered, and the release must commit what was actually drawn.
  const liveRef = useRef<Stroke | null>(null)
  const setStroke = (s: Stroke | null) => {
    liveRef.current = s
    setLive(s)
  }
  const full = pointCount(strokes) >= MAX_POINTS || strokes.length >= MAX_STROKES


  const point = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect()
    const scale = WIDTH / r.width
    return { x: (e.clientX - r.left) * scale, y: (e.clientY - r.top) * scale }
  }
  const accept = (e: React.PointerEvent) => {
    if (e.pointerType === 'pen') penSeen.current = true
    return !(e.pointerType === 'touch' && penSeen.current)
  }
  const snapshot = () => setHistory((h) => [...h.slice(-30), strokes])
  const eraseAt = (x: number, y: number) => setStrokes((list) => list.filter((s) => !hits(s, x, y)))

  const down = (e: React.PointerEvent) => {
    if (!accept(e) || active.current !== null) return
    e.preventDefault()
    try { svg.current?.setPointerCapture(e.pointerId) } catch { /* unknown pointer */ }
    active.current = e.pointerId
    const { x, y } = point(e)
    snapshot()
    if (tool === 'eraser') return eraseAt(x, y)
    if (full) return
    const w = tool === 'hl' ? width * 4 : width
    setStroke({ t: tool, c: color, w, p: [Math.round(x), Math.round(y)] })
  }
  const move = (e: React.PointerEvent) => {
    if (e.pointerId !== active.current) return
    const { x, y } = point(e)
    if (tool === 'eraser') return eraseAt(x, y)
    const s = liveRef.current
    if (!s) return
    setStroke(s.t === 'pen' || s.t === 'hl' ? { ...s, p: addPoint(s.p, x, y) } : { ...s, p: [s.p[0], s.p[1], Math.round(x), Math.round(y)] })
  }
  const up = (e: React.PointerEvent) => {
    if (e.pointerId !== active.current) return
    active.current = null
    const done = liveRef.current
    if (done) setStrokes((list) => [...list, done])
    setStroke(null)
  }
  const undo = () => {
    setHistory((h) => {
      if (!h.length) return h
      setStrokes(h[h.length - 1])
      return h.slice(0, -1)
    })
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })

  const render = (s: Stroke, i: number | string) => (
    <path key={i} d={strokePath(s)} fill="none" stroke={s.c} strokeWidth={s.w} strokeLinecap="round" strokeLinejoin="round"
      strokeOpacity={s.t === 'hl' ? 0.35 : 1} />
  )

  return createPortal(
    <div role="dialog" aria-label="Drawing" className="fixed inset-0 z-[110] flex flex-col bg-canvas">
      <div className="ct-tips flex shrink-0 flex-wrap items-center gap-1 border-b border-border px-3 py-2">
        {TOOLS.map((t) => (
          <button key={t.id} type="button" aria-label={t.label} aria-pressed={tool === t.id} onClick={() => setTool(t.id)}
            className={cn('grid size-9 place-items-center rounded-lg', tool === t.id ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2 hover:text-fg')}>
            <t.icon size={17} aria-hidden />
          </button>
        ))}
        <span className="mx-1.5 h-6 w-px bg-border" aria-hidden />
        {COLORS.map((c) => (
          <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={color === c} onClick={() => setColor(c)}
            className={cn('size-6 rounded-full border border-border', color === c && 'ring-2 ring-accent ring-offset-2 ring-offset-canvas')} style={{ background: c }} />
        ))}
        <span className="mx-1.5 h-6 w-px bg-border" aria-hidden />
        {WIDTHS.map((w) => (
          <button key={w} type="button" aria-label={`Thickness ${w}`} aria-pressed={width === w} onClick={() => setWidth(w)}
            className={cn('grid size-9 place-items-center rounded-lg', width === w ? 'bg-accent-soft' : 'hover:bg-surface-2')}>
            <span className="rounded-full bg-fg" style={{ width: w + 3, height: w + 3 }} />
          </button>
        ))}
        <span className="mx-1.5 h-6 w-px bg-border" aria-hidden />
        <button type="button" aria-label="Undo (Ctrl+Z)" onClick={undo} disabled={!history.length} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2 disabled:opacity-35"><Undo2 size={17} aria-hidden /></button>
        <button type="button" aria-label="Clear the drawing" onClick={() => { snapshot(); setStrokes([]) }} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2"><Trash2 size={17} aria-hidden /></button>
        <button type="button" aria-label="More room" onClick={() => setHeight((h) => Math.min(MAX_HEIGHT, h + 240))} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2"><Plus size={17} aria-hidden /></button>
        <span className="ml-auto flex gap-2">
          <button type="button" onClick={onCancel} className="h-9 rounded-lg px-3 text-[13px] text-muted hover:bg-surface-2 hover:text-fg">Cancel</button>
          <button type="button" onClick={() => onDone(strokes, height)} className="h-9 rounded-lg bg-accent px-4 text-[13px] font-semibold text-accent-contrast hover:bg-accent-hover">Done</button>
        </span>
      </div>
      {full && <p className="border-b border-border bg-warning/10 px-4 py-1.5 text-[12.5px] text-fg">This drawing is full. Start another one below it.</p>}
      <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-8">
        <svg ref={svg} viewBox={`0 0 ${WIDTH} ${height}`} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          className="mx-auto block w-full max-w-[1000px] touch-none rounded-xl bg-white shadow-lg" style={{ cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}>
          {strokes.map(render)}
          {live && render(live, 'live')}
        </svg>
        <p className="mt-3 text-center text-[12px] text-subtle">With a stylus, your palm is ignored. Ctrl+Z undoes.</p>
      </div>
    </div>,
    document.body,
  )
}

