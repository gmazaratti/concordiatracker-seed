import { ArrowLeft, ArrowUp, Plus, Wrench, type LucideIcon } from 'lucide-react'
import type { Release, ReleaseChangeKind } from '@/data/releases'
import { cn } from '@/lib/cn'
import { ReleaseCover } from './ReleaseCard'
import { ReleaseHero } from './ReleaseHero'
import { artFor, releaseCounts, releaseDate } from './release-art'

const KINDS: { kind: ReleaseChangeKind; label: string; icon: LucideIcon; tone: string }[] = [
  { kind: 'new', label: 'New', icon: Plus, tone: 'bg-success text-white' },
  { kind: 'improved', label: 'Improved', icon: ArrowUp, tone: 'bg-info text-white' },
  { kind: 'fixed', label: 'Fixed', icon: Wrench, tone: 'bg-surface-2 text-muted' },
]

/**
 * One release, opened from its card: the cover as a banner, then what is new
 * as tiles (those are the lines people came for) and the rest as plain lists.
 */
export function ReleaseDetail({
  release,
  index,
  onBack,
}: {
  release: Release
  index: number
  onBack: () => void
}) {
  const art = artFor(release, index)
  return (
    <div className="ct-res-in px-4 pt-4 pb-6 sm:px-6">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-[13px] font-medium text-muted transition-colors duration-150 hover:border-border-strong hover:text-fg"
      >
        <ArrowLeft size={15} aria-hidden />
        All updates
      </button>

      <ReleaseCover release={release} art={art} size="lg" className="aspect-[16/8] rounded-3xl sm:aspect-[16/5]" />
      <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="font-display text-[26px] leading-tight font-bold tracking-tight text-fg">{release.name}</h3>
        <p className="text-[13px] text-muted">
          {releaseDate(release.date)} · {releaseCounts(release)}
        </p>
      </div>

      {release.hero && (
        <div className="mt-5">
          <ReleaseHero release={release} />
        </div>
      )}

      <div className="mt-5 space-y-7">
        {KINDS.map(({ kind, label, icon: Icon, tone }) => {
          const items = release.changes.filter((c) => c.kind === kind)
          if (items.length === 0) return null
          return (
            <section key={kind}>
              <h4 className="flex items-center gap-2 font-display text-[18px] font-semibold text-fg">
                <span className={cn('grid size-6 place-items-center rounded-full', tone)}>
                  <Icon size={13} strokeWidth={3} aria-hidden />
                </span>
                {label}
                <span className="text-[13px] font-medium text-subtle tabular-nums">{items.length}</span>
              </h4>
              {kind === 'new' ? (
                <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
                  {items.map((c, i) => (
                    <li
                      key={i}
                      className="rounded-2xl border border-border bg-canvas/60 px-4 py-3.5 text-[14px] leading-relaxed text-fg/90"
                      style={{ boxShadow: `inset 3px 0 0 ${art.hex}` }}
                    >
                      {c.text}
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="mt-3 divide-y divide-border/70 overflow-hidden rounded-2xl border border-border">
                  {items.map((c, i) => (
                    <li key={i} className="px-4 py-3 text-[14px] leading-relaxed text-muted">
                      {c.text}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
