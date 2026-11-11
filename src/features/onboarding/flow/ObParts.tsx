import { cn } from '@/lib/cn'

/** The words for a step: a small label, one big line, one sentence. */
export function StepCopy({
  label,
  title,
  sub,
  note,
}: {
  label: string
  title: React.ReactNode
  sub: string
  /** A quiet reassurance under the copy, e.g. "You can always do this later." */
  note?: string
}) {
  return (
    <div>
      <p className="ct-ob-rise text-[12px] font-semibold tracking-[0.16em] text-accent uppercase">{label}</p>
      <h1
        className="ct-ob-rise mt-2 font-display text-[clamp(1.7rem,4.6vw,3.2rem)] leading-[1.08] font-semibold tracking-tight text-balance text-fg sm:mt-3"
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
      {note && (
        <p className="ct-ob-rise mt-3 text-[13px] text-subtle" style={{ '--d': '180ms' } as React.CSSProperties}>
          {note}
        </p>
      )}
    </div>
  )
}

/** The demo surface: looks like a slice of the app, not an illustration. */
export function Stage({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn('ct-ob-rise relative w-full rounded-2xl border border-border bg-surface p-3.5 shadow-2xl sm:rounded-3xl sm:p-5', className)}
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
