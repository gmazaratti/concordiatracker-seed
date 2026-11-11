import { MousePointerClick } from 'lucide-react'
import { cn } from '@/lib/cn'

/** The words for a step: a small label, one big line, one sentence. */
export function StepCopy({
  label,
  title,
  sub,
  hint,
  done,
}: {
  label: string
  title: React.ReactNode
  sub: string
  /** What to do on the right-hand demo. Fades once they have done it. */
  hint?: string
  done?: boolean
}) {
  return (
    <div>
      <p className="ct-ob-rise text-[12px] font-semibold tracking-[0.16em] text-accent uppercase">{label}</p>
      <h1
        className="ct-ob-rise mt-2 font-display text-[clamp(1.7rem,4.6vw,3.2rem)] sm:mt-3 leading-[1.08] font-semibold tracking-tight text-balance text-fg"
        style={{ '--d': '60ms' } as React.CSSProperties}
      >
        {title}
      </h1>
      <p
        className="ct-ob-rise mt-2.5 max-w-md text-[15px] leading-relaxed text-muted sm:mt-4 sm:text-[16px]"
        style={{ '--d': '120ms' } as React.CSSProperties}
      >
        {sub}
      </p>
      {hint && (
        <p
          className={cn(
            'ct-ob-rise mt-3.5 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] sm:mt-5 font-medium transition-colors duration-300',
            done ? 'border-success/40 bg-success/10 text-success' : 'border-accent/40 bg-accent-soft text-accent',
          )}
          style={{ '--d': '180ms' } as React.CSSProperties}
        >
          <MousePointerClick size={14} aria-hidden />
          {done ? 'Nice. That is the real thing.' : hint}
        </p>
      )}
    </div>
  )
}

/** The demo surface: looks like a slice of the app, not an illustration. */
export function Stage({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'ct-ob-rise relative w-full rounded-3xl border border-border bg-surface p-4 shadow-2xl sm:p-5',
        className,
      )}
      style={{ '--d': '140ms' } as React.CSSProperties}
    >
      {children}
    </div>
  )
}

/** A row label inside a stage ("COMM 305", "Due this week"). */
export function StageLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <p className="text-[11px] font-semibold tracking-[0.12em] text-subtle uppercase">{children}</p>
      {right && <div className="text-[12px] text-subtle">{right}</div>}
    </div>
  )
}
