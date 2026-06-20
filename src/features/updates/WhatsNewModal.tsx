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
    <ModalShell label="What's new" onClose={closeHistory} widthClass="sm:max-w-2xl">
      <div className="border-b border-border px-6 pt-6 pb-5">
        <p className="text-[11px] font-medium tracking-[0.18em] text-subtle uppercase">Version history</p>
        <h2 className="mt-1.5 font-display text-[26px] leading-tight font-medium text-fg">What&rsquo;s new</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">Everything we&rsquo;ve shipped, newest first.</p>
      </div>

      <ol className="px-6 py-6">
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
      <div className="border-t border-border bg-surface-2/40 px-6 py-4">
        <Link
          to="/feedback?tab=requests"
          onClick={closeHistory}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:underline"
        >
          <Lightbulb size={14} aria-hidden />
          Got an idea? Request a feature &rarr;
        </Link>
        <p className="mt-1 text-[12px] text-subtle">Many of these shipped from community requests.</p>
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
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <h3 className="font-display text-[18px] leading-tight font-medium text-fg">{release.name}</h3>
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
