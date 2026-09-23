import { Link } from 'react-router-dom'
import { ArrowUp, Lightbulb, Plus, Wrench, type LucideIcon } from 'lucide-react'
import { useUpdates } from '@/app/providers/updates'
import { RELEASES, type Release, type ReleaseChangeKind } from '@/data/releases'
import { ModalShell } from '@/command/ModalShell'
import { cn } from '@/lib/cn'

const KIND_ORDER: ReleaseChangeKind[] = ['new', 'improved', 'fixed']

const KIND_META: Record<
  ReleaseChangeKind,
  { label: string; icon: LucideIcon; chip: string }
> = {
  new: { label: 'New', icon: Plus, chip: 'bg-success/15 text-success' },
  improved: { label: 'Improved', icon: ArrowUp, chip: 'bg-info/15 text-info' },
  fixed: { label: 'Fixed', icon: Wrench, chip: 'bg-surface-2 text-subtle' },
}

const DATE_FMT = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

function formatDate(d: string): string {
  const [y, m, day] = d.split('-').map(Number)
  return DATE_FMT.format(new Date(y, m - 1, day))
}

/** The on-demand version history — a vertical changelog timeline, newest first,
 * changes grouped New / Improved / Fixed. Opening it (via the provider) marks
 * the latest release seen. */
export function WhatsNewModal() {
  const { closeHistory } = useUpdates()
  return (
    <ModalShell label="What's new" onClose={closeHistory} widthClass="sm:max-w-2xl" scroll={false}>
      {/* Pinned header + footer, only the list scrolls: so the scrollbar never
          reaches the rounded corners and the list opens at the top. */}
      <div className="flex max-h-[85vh] flex-col">
        <div className="shrink-0 border-b border-border px-6 pt-6 pb-5">
          <p className="text-[11px] font-medium tracking-[0.18em] text-subtle uppercase">Version history</p>
          <h2 className="mt-1.5 font-display text-[26px] leading-tight font-medium text-fg">What&rsquo;s new</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">Everything we&rsquo;ve shipped, newest first.</p>
        </div>

        <ol className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          {RELEASES.map((release, i) => (
            <ReleaseEntry
              key={release.version}
              release={release}
              latest={i === 0}
              last={i === RELEASES.length - 1}
            />
          ))}
        </ol>

        {/* Cross-link → the requests board (the listen → build → proof loop). */}
        <div className="shrink-0 border-t border-border bg-surface-2/40 px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">
          <Link
            to="/app/requests?tab=requests"
            onClick={closeHistory}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:underline"
          >
            <Lightbulb size={14} aria-hidden />
            Got an idea? Request a feature &rarr;
          </Link>
          <p className="mt-1 text-[12px] text-subtle">Many of these shipped from community requests.</p>
        </div>
      </div>
    </ModalShell>
  )
}

function ReleaseEntry({
  release,
  latest,
  last,
}: {
  release: Release
  latest: boolean
  last: boolean
}) {
  const groups = KIND_ORDER.map((kind) => ({
    kind,
    items: release.changes.filter((c) => c.kind === kind),
  })).filter((g) => g.items.length > 0)

  return (
    <li className="flex gap-4">
      {/* Timeline rail: a node over a connecting line. */}
      <div className="flex w-3 shrink-0 flex-col items-center">
        <span
          className={cn(
            'mt-1 size-3 shrink-0 rounded-full ring-4 ring-surface',
            latest ? 'bg-accent' : 'border-2 border-border-strong bg-surface',
          )}
          aria-hidden
        />
        {!last && <span className="mt-1 w-px flex-1 bg-border" aria-hidden />}
      </div>

      {/* Release content */}
      <div className={cn('min-w-0 flex-1', last ? 'pb-0' : 'pb-8')}>
        {release.hero && <HeroPanel release={release} />}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <h3 className={cn('font-display text-[18px] leading-tight font-medium text-fg', release.hero && 'sr-only')}>
            {release.name}
          </h3>
          <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted">
            v{release.version}
          </span>
          {latest && (
            <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-accent uppercase">
              Latest
            </span>
          )}
          <span className="ml-auto text-[12px] text-subtle">{formatDate(release.date)}</span>
        </div>

        <div className="mt-3.5 space-y-3.5">
          {groups.map(({ kind, items }) => {
            const meta = KIND_META[kind]
            const Icon = meta.icon
            return (
              <div key={kind}>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold tracking-wide uppercase',
                    meta.chip,
                  )}
                >
                  <Icon size={11} aria-hidden />
                  {meta.label}
                </span>
                <ul className="mt-2 space-y-1.5">
                  {items.map((c, idx) => (
                    <li key={idx} className="flex gap-2.5 text-[13px] leading-relaxed text-muted">
                      <span className="mt-[7px] size-1 shrink-0 rounded-full bg-border-strong" aria-hidden />
                      {c.text}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </div>
    </li>
  )
}

/**
 * The shape a MAJOR release gets.
 *
 * Deliberately different in kind, not just louder: a version number set large
 * enough to be the headline, a tagline in place of a list, and four
 * highlights in a grid. The counts are derived from the change list below it,
 * so the panel can never claim more than the release contains.
 */
function HeroPanel({ release }: { release: Release }) {
  const hero = release.hero!
  const count = (k: ReleaseChangeKind) => release.changes.filter((c) => c.kind === k).length
  const stats = [
    { n: count('new'), label: 'new' },
    { n: count('improved'), label: 'improved' },
    { n: count('fixed'), label: 'fixed' },
  ].filter((x) => x.n > 0)
  return (
    <div className="relative mb-5 overflow-hidden rounded-2xl border border-accent/40 bg-gradient-to-br from-accent/20 via-accent-soft to-surface p-5 sm:p-6">
      <div className="ct-grid-plain pointer-events-none absolute inset-0 opacity-30" aria-hidden />
      <div className="relative">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">Major release</p>
        <div className="mt-1 flex flex-wrap items-end gap-x-3 gap-y-1">
          <span className="font-display text-[44px] leading-none font-semibold tracking-tight text-fg tabular-nums sm:text-[56px]">
            {release.version.replace(/\.0$/, '')}
          </span>
          <span className="pb-1.5 font-display text-[19px] leading-tight font-medium text-fg sm:text-[22px]">
            {release.name}
          </span>
        </div>
        <p className="mt-3 max-w-prose text-[13.5px] leading-relaxed text-muted">{hero.tagline}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {stats.map((s) => (
            <span key={s.label} className="rounded-full bg-surface/70 px-2.5 py-1 text-[12px] text-muted backdrop-blur">
              <span className="font-semibold text-fg tabular-nums">{s.n}</span> {s.label}
            </span>
          ))}
        </div>
        <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
          {hero.highlights.map((h) => (
            <li key={h.title} className="rounded-xl border border-border/70 bg-surface/80 p-3 backdrop-blur">
              <p className="text-[13px] font-semibold text-fg">{h.title}</p>
              <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{h.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
