import { useEffect, useRef, useState } from 'react'
import { Play } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Scene1, Scene2, Scene4, Scene5, Scene6 } from './DemoScenes'
import { Scene3 } from './DemoParseScene'

/** Per-scene dwell before auto-advancing (ms). Scene 3 (the parse cascade) holds
 * longest so the dates finish landing and the pillars read. */
const DWELL = [4200, 4200, 7800, 3400, 5600, 6000]
const SCENES = DWELL.length
const IDLE_MS = 2600

/** A throwaway, full-bleed promo reel at /demo — six timed scenes that auto-advance
 * for screen recording, with manual stepping (arrows / click) and a Play-from-start
 * control. No app chrome; the cursor and controls fade out while idle. */
export function DemoReel() {
  const [current, setCurrent] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [runKey, setRunKey] = useState(0)
  const [idle, setIdle] = useState(false)
  const idleTimer = useRef<number | undefined>(undefined)

  // Auto-advance the timeline (holds on the final scene). `runKey` re-arms it
  // after a Play-from-start even when already on scene 0.
  useEffect(() => {
    if (!playing || current >= SCENES - 1) return
    const id = window.setTimeout(
      () => setCurrent((c) => Math.min(c + 1, SCENES - 1)),
      DWELL[current],
    )
    return () => window.clearTimeout(id)
  }, [playing, current, runKey])

  // Hide the cursor + controls after a moment of no mouse movement.
  useEffect(() => {
    idleTimer.current = window.setTimeout(() => setIdle(true), IDLE_MS)
    return () => {
      if (idleTimer.current) window.clearTimeout(idleTimer.current)
    }
  }, [])

  function poke() {
    setIdle(false)
    if (idleTimer.current) window.clearTimeout(idleTimer.current)
    idleTimer.current = window.setTimeout(() => setIdle(true), IDLE_MS)
  }

  // Keyboard: ← → step, Space play/pause, R restart from the top.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') setCurrent((c) => Math.min(c + 1, SCENES - 1))
      else if (e.key === 'ArrowLeft') setCurrent((c) => Math.max(c - 1, 0))
      else if (e.key === ' ') {
        e.preventDefault()
        setPlaying((p) => !p)
      } else if (e.key.toLowerCase() === 'r') restart()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function restart() {
    setCurrent(0)
    setPlaying(true)
    setRunKey((k) => k + 1)
  }

  return (
    <div
      onMouseMove={poke}
      onClick={() => setCurrent((c) => Math.min(c + 1, SCENES - 1))}
      className={cn(
        'fixed inset-0 z-50 overflow-hidden bg-canvas text-fg select-none',
        idle && 'cursor-none',
      )}
    >
      <div className="ct-grid-bg pointer-events-none absolute inset-0 opacity-50" aria-hidden />

      <div key={runKey} className="absolute inset-0">
        <Scene1 active={current === 0} />
        <Scene2 active={current === 1} />
        <Scene3 active={current === 2} />
        <Scene4 active={current === 3} />
        <Scene5 active={current === 4} />
        <Scene6 active={current === 5} />
      </div>

      <Controls
        current={current}
        total={SCENES}
        visible={!idle}
        onRestart={restart}
        onJump={setCurrent}
      />
    </div>
  )
}

function Controls({
  current,
  total,
  visible,
  onRestart,
  onJump,
}: {
  current: number
  total: number
  visible: boolean
  onRestart: () => void
  onJump: (i: number) => void
}) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 p-6 transition-opacity duration-300',
        visible ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
    >
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onRestart}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/80 px-4 py-2 text-[13px] font-medium text-fg shadow-lg backdrop-blur transition-colors duration-150 hover:bg-surface-2"
        >
          <Play size={14} aria-hidden /> Play from start
        </button>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: total }).map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to scene ${i + 1}`}
              aria-current={i === current}
              onClick={() => onJump(i)}
              className={cn(
                'h-1.5 rounded-full transition-[width,background-color] duration-300',
                i === current ? 'w-7 bg-accent' : 'w-1.5 bg-border-strong hover:bg-subtle',
              )}
            />
          ))}
        </div>
      </div>
      <p className="text-[11px] text-subtle">← → step · Space play/pause · R restart</p>
    </div>
  )
}
