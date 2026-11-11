import { Search, ShieldAlert, X } from 'lucide-react'

/**
 * The banner: what this page is for, the search, and the one number that
 * should never be more than a glance away. The skyline is drawn, not a photo
 * (we have no licensed campus photography), and takes its colours from the
 * theme so it sits in every palette.
 */
export function ResourcesHero({
  q,
  setQ,
  count,
  firstName,
}: {
  q: string
  setQ: (v: string) => void
  count: number
  firstName: string
}) {
  return (
    <header className="ct-res-in relative overflow-hidden rounded-3xl border border-border bg-surface">
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 140% at 100% 0%, color-mix(in srgb, var(--ct-accent) 26%, transparent), transparent 58%), radial-gradient(90% 120% at 0% 100%, color-mix(in srgb, var(--ct-info) 14%, transparent), transparent 60%)',
        }}
      />
      <Skyline />
      <div className="relative px-5 pt-6 pb-5 sm:px-8 sm:pt-9 sm:pb-7 lg:max-w-[62%]">
        <p className="text-[12px] font-semibold tracking-[0.14em] text-accent uppercase">Concordia, sorted</p>
        <h2 className="mt-2 font-display text-[28px] leading-[1.08] font-bold tracking-tight text-balance text-fg sm:text-[38px]">
          {firstName ? `${firstName}, who do you need to talk to?` : 'Who do you need to talk to?'}
        </h2>
        <p className="mt-2.5 max-w-md text-[14px] leading-relaxed text-muted">
          {count} offices and the people behind them. Pick what you need and get the right door, a real email and a way
          to book.
        </p>
        <label className="mt-5 flex max-w-md items-center gap-2.5 rounded-2xl border border-border-strong bg-canvas/80 px-3.5 py-2.5 shadow-sm backdrop-blur transition-colors duration-150 focus-within:border-accent">
          <Search size={17} className="shrink-0 text-subtle" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Try fees, writing, co-op, accommodations"
            aria-label="Search resources"
            className="min-w-0 flex-1 bg-transparent text-[16px] text-fg outline-none placeholder:text-subtle sm:text-[14px]"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ('')}
              aria-label="Clear search"
              className="grid size-6 shrink-0 place-items-center rounded-full text-subtle hover:bg-surface-2 hover:text-fg"
            >
              <X size={14} aria-hidden />
            </button>
          )}
        </label>
        <p className="mt-4 inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12.5px] text-muted">
          <ShieldAlert size={14} className="text-danger" aria-hidden />
          Campus emergency, any hour:
          <span className="font-semibold text-fg select-all">514-848-3717</span>
        </p>
      </div>
    </header>
  )
}

/** Lit windows on four buildings. Decorative; hidden on small screens. */
function Skyline() {
  const towers = [
    { x: 40, w: 88, h: 150, cols: 4, rows: 7 },
    { x: 142, w: 120, h: 214, cols: 5, rows: 10 },
    { x: 276, w: 76, h: 118, cols: 3, rows: 5 },
    { x: 366, w: 104, h: 178, cols: 4, rows: 8 },
  ]
  // A fixed pattern, so the same windows are lit on every render.
  const lit = (t: number, c: number, r: number) => (t * 7 + c * 3 + r * 5) % 4 === 0
  return (
    <svg
      aria-hidden
      viewBox="0 0 500 240"
      preserveAspectRatio="xMaxYMax meet"
      className="pointer-events-none absolute right-0 bottom-0 hidden h-[92%] w-[46%] lg:block"
    >
      {towers.map((t, ti) => {
        const top = 240 - t.h
        const gx = (t.w - 16) / t.cols
        const gy = (t.h - 22) / t.rows
        return (
          <g key={t.x}>
            <rect x={t.x} y={top} width={t.w} height={t.h} rx="6" fill="var(--ct-surface-2)" stroke="var(--ct-border-strong)" />
            {Array.from({ length: t.cols * t.rows }, (_, i) => {
              const c = i % t.cols
              const r = Math.floor(i / t.cols)
              const on = lit(ti, c, r)
              return (
                <rect
                  key={i}
                  x={t.x + 8 + c * gx + 2}
                  y={top + 12 + r * gy}
                  width={gx - 6}
                  height={gy - 7}
                  rx="2"
                  fill={on ? 'var(--ct-accent)' : 'var(--ct-border)'}
                  opacity={on ? 0.85 : 0.7}
                  className={on ? 'ct-res-window' : undefined}
                  style={on ? { animationDelay: `${((ti + c + r) % 5) * 0.7}s` } : undefined}
                />
              )
            })}
          </g>
        )
      })}
    </svg>
  )
}
