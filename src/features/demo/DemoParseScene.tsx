import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { ParseRevealDemo } from '@/features/landing/ParseRevealDemo'
import { COMM221_PARSED, type Phase } from '@/features/landing/parse-demo-data'
import { Stage, Reveal } from './DemoPrimitives'

const PILLARS = [
  'Every deadline, dated.',
  'Every weight, calculated.',
  'Your GPA, projected.',
]
const TOTAL = COMM221_PARSED.length
const CASCADE_START = 1500
const STEP = 470

/** Scene 3 — the magic moment. Reuses the REAL `ParseRevealDemo` (the same
 * scanner + cascade the landing uses), driven here by a JS phase machine that
 * starts when the scene becomes active: scan → dates cascade in → done, with the
 * three value pillars easing in as the plan lands. */
export function Scene3({ active }: { active: boolean }) {
  const [phase, setPhase] = useState<Phase>('armed')
  const [revealed, setRevealed] = useState(0)
  const noopRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!active) {
      const reset = window.setTimeout(() => {
        setPhase('armed')
        setRevealed(0)
      }, 0)
      return () => window.clearTimeout(reset)
    }
    const timers: number[] = []
    timers.push(window.setTimeout(() => setPhase('scanning'), 350))
    timers.push(
      window.setTimeout(() => {
        setPhase('revealing')
        setRevealed(1)
      }, CASCADE_START),
    )
    for (let i = 2; i <= TOTAL; i++) {
      timers.push(window.setTimeout(() => setRevealed(i), CASCADE_START + (i - 1) * STEP))
    }
    timers.push(window.setTimeout(() => setPhase('done'), CASCADE_START + TOTAL * STEP + 150))
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [active])

  return (
    <Stage active={active}>
      <Reveal active={active} delay={100} from="down">
        <p className="text-[12px] font-semibold tracking-[0.25em] text-accent uppercase">
          The magic moment
        </p>
      </Reveal>

      <Reveal active={active} delay={250} className="w-full max-w-5xl">
        <ParseRevealDemo phase={phase} revealed={revealed} scannerRef={noopRef} />
      </Reveal>

      <div className="mt-9 flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
        {PILLARS.map((p, i) => (
          <Reveal key={p} active={active} delay={CASCADE_START + TOTAL * STEP + 350 + i * 360} from="down">
            <p className="inline-flex items-center gap-2 font-display text-[clamp(1rem,2.1vw,1.55rem)] font-medium text-fg">
              <Check size={20} className="shrink-0 text-accent" aria-hidden />
              {p}
            </p>
          </Reveal>
        ))}
      </div>
    </Stage>
  )
}
