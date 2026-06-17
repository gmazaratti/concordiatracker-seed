import { useEffect, useState } from 'react'
import { FileText, FlaskConical, Globe, GraduationCap, Mail, type LucideIcon } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { AppPreview } from '@/features/landing/AppPreview'
import { Stage, Reveal } from './DemoPrimitives'

/* ── Scene 1 — Hook ─────────────────────────────────────────────── */
export function Scene1({ active }: { active: boolean }) {
  return (
    <Stage active={active}>
      <Reveal active={active} delay={150} from="down" className="max-w-4xl">
        <h2 className="font-display text-[clamp(2rem,6vw,4.5rem)] leading-[1.05] font-medium tracking-tight text-fg">
          Your deadlines live in five different places.
        </h2>
      </Reveal>
      <Reveal active={active} delay={1900} from="down" className="mt-8">
        <p className="font-display text-[clamp(1.5rem,4vw,3rem)] font-semibold text-accent">
          Until now.
        </p>
      </Reveal>
    </Stage>
  )
}

/* ── Scene 2 — Problem ──────────────────────────────────────────── */
// Anchors cluster around the centre (translate(-50%,-50%) centres each card on
// its point); the cards POP in fast + overlapping to feel overwhelming.
const SOURCES: { label: string; icon: LucideIcon; left: string; top: string; rot: number }[] = [
  { label: 'Moodle', icon: GraduationCap, left: '39%', top: '30%', rot: -9 },
  { label: 'eConcordia', icon: Globe, left: '63%', top: '37%', rot: 7 },
  { label: 'MyLab', icon: FlaskConical, left: '35%', top: '57%', rot: 6 },
  { label: 'Syllabus PDF', icon: FileText, left: '65%', top: '61%', rot: -6 },
  { label: "Prof's email", icon: Mail, left: '50%', top: '46%', rot: 2 },
]

export function Scene2({ active }: { active: boolean }) {
  return (
    <Stage active={active}>
      <div className="relative h-[42vh] w-full max-w-2xl">
        {SOURCES.map((s, i) => {
          const Icon = s.icon
          return (
            <span
              key={s.label}
              style={{
                left: s.left,
                top: s.top,
                transform: `translate(-50%, -50%) rotate(${s.rot}deg) scale(${active ? 1 : 0.3})`,
                opacity: active ? 1 : 0,
                transitionDelay: active ? `${i * 110}ms` : '0ms',
                transitionTimingFunction: active ? 'cubic-bezier(0.34, 1.56, 0.64, 1)' : 'ease-out',
              }}
              className="absolute flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[13px] font-medium whitespace-nowrap text-muted shadow-xl transition-[opacity,transform] duration-[430ms] will-change-[opacity,transform]"
            >
              <Icon size={15} className="shrink-0 text-subtle" aria-hidden />
              {s.label}
            </span>
          )
        })}
      </div>
      <Reveal active={active} delay={780} from="down" className="mt-2 max-w-3xl">
        <p className="font-display text-[clamp(1.6rem,4.5vw,3.2rem)] leading-tight font-medium text-fg">
          Five syllabi. <span className="text-accent">One overwhelmed student.</span>
        </p>
      </Reveal>
    </Stage>
  )
}

/* ── Scene 4 — Claim ────────────────────────────────────────────── */
export function Scene4({ active }: { active: boolean }) {
  return (
    <Stage active={active}>
      <Reveal active={active} delay={150} from="down" className="max-w-4xl">
        <h2 className="font-display text-[clamp(2.2rem,6.5vw,5rem)] leading-[1.04] font-medium tracking-tight text-fg">
          The <span className="text-accent">calmest</span> way
          <br />
          to run a semester.
        </h2>
      </Reveal>
    </Stage>
  )
}

/* ── Scene 5 — Proof (the real Today screen) ────────────────────── */
export function Scene5({ active }: { active: boolean }) {
  // Remount the real Today preview on entry so its greeting types in on cue.
  const [mountKey, setMountKey] = useState(0)
  useEffect(() => {
    if (!active) return
    const id = window.setTimeout(() => setMountKey((k) => k + 1), 0)
    return () => window.clearTimeout(id)
  }, [active])

  return (
    <Stage active={active}>
      <Reveal active={active} delay={120} from="down" className="w-full max-w-4xl">
        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_40px_120px_-40px_rgba(0,0,0,0.8)]">
          <div className="flex items-center gap-2 border-b border-border bg-surface-2/60 px-4 py-2.5">
            <span className="flex gap-1.5">
              <span className="size-2.5 rounded-full bg-danger/70" />
              <span className="size-2.5 rounded-full bg-warning/70" />
              <span className="size-2.5 rounded-full bg-success/70" />
            </span>
            <span className="ml-3 rounded-md border border-border bg-canvas/60 px-3 py-1 text-[11px] text-subtle">
              concordiatracker.com/today
            </span>
          </div>
          <div className="h-[400px] overflow-hidden sm:h-[470px]">
            <div className="pointer-events-none h-full select-none">
              {mountKey > 0 && <AppPreview key={mountKey} />}
            </div>
          </div>
        </div>
      </Reveal>
      <Reveal active={active} delay={650} from="down" className="mt-7 max-w-2xl">
        <p className="text-[clamp(1rem,2.4vw,1.5rem)] text-muted">
          See what's due, what's next, and where your grade is going.
        </p>
      </Reveal>
    </Stage>
  )
}

/* ── Scene 6 — Outro ────────────────────────────────────────────── */
export function Scene6({ active }: { active: boolean }) {
  return (
    <Stage active={active}>
      {/* One flex column with a single gap → the logo, the line, and the small
       * line are evenly spaced (the logo renders at real size, no transform, so
       * the spacing reads true). */}
      <div className="flex flex-col items-center gap-8">
        <Reveal active={active} delay={150} from="down" className="flex">
          <Logo size="lg" />
        </Reveal>
        <Reveal active={active} delay={950} from="down">
          <p className="font-display text-[clamp(1.8rem,5vw,3.5rem)] leading-tight font-medium text-fg">
            Stop guessing what's <span className="text-accent">due</span>.
          </p>
        </Reveal>
        <Reveal active={active} delay={1750} from="down">
          <p className="text-[12px] font-medium tracking-[0.2em] text-subtle uppercase">
            Built for Concordia students
          </p>
        </Reveal>
      </div>
    </Stage>
  )
}
