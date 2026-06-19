import { Link } from 'react-router-dom'
import { Lightbulb } from 'lucide-react'
import { useUpdates } from '@/app/providers/updates'
import {
  RELEASES,
  type Release,
  type ReleaseChangeKind,
} from '@/data/releases'
import { ModalShell } from '@/command/ModalShell'
import { cn } from '@/lib/cn'

const KIND_ORDER: ReleaseChangeKind[] = ['new', 'improved', 'fixed']

const KIND_META: Record<ReleaseChangeKind, { label: string; dot: string; text: string }> = {
  new: { label: 'New', dot: 'bg-success', text: 'text-success' },
  improved: { label: 'Improved', dot: 'bg-info', text: 'text-info' },
  fixed: { label: 'Fixed', dot: 'bg-subtle', text: 'text-subtle' },
}

const DATE_FMT = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

function formatDate(d: string): string {
  const [y, m, day] = d.split('-').map(Number)
  return DATE_FMT.format(new Date(y, m - 1, day))
}

/** The on-demand version history — every release newest-first, changes grouped
 * New / Improved / Fixed. Opening it (via the provider) marks the latest seen. */
export function WhatsNewModal() {
  const { closeHistory } = useUpdates()
  return (
    <ModalShell label="What's new" onClose={closeHistory}>
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <p className="text-[11px] font-medium tracking-wide text-subtle uppercase">
            Version history
          </p>
          <h2 className="mt-0.5 font-display text-[20px] leading-tight font-medium text-fg">
            What's new
          </h2>
        </div>
      </div>

      <div className="divide-y divide-border">
        {RELEASES.map((release, i) => (
          <ReleaseEntry key={release.version} release={release} latest={i === 0} />
        ))}
      </div>

      {/* Cross-link → the requests board (the listen → build → proof loop). */}
      <div className="border-t border-border bg-surface-2/40 px-5 py-4">
        <Link
          to="/feedback?tab=requests"
          onClick={closeHistory}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:underline"
        >
          <Lightbulb size={14} aria-hidden />
          Got an idea? Request a feature →
        </Link>
        <p className="mt-1 text-[12px] text-subtle">Many of these shipped from community requests.</p>
      </div>
    </ModalShell>
  )
}

function ReleaseEntry({ release, latest }: { release: Release; latest: boolean }) {
  const groups = KIND_ORDER.map((kind) => ({
    kind,
    items: release.changes.filter((c) => c.kind === kind),
  })).filter((g) => g.items.length > 0)

  return (
    <section className="px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="rounded-md bg-surface-2 px-2 py-0.5 text-[12px] font-semibold tabular-nums text-fg">
          v{release.version}
        </span>
        <h3 className="text-[14px] font-medium text-fg">{release.name}</h3>
        {latest && (
          <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-accent uppercase">
            Latest
          </span>
        )}
        <span className="ml-auto text-[12px] text-subtle">{formatDate(release.date)}</span>
      </div>

      <div className="mt-3 space-y-3">
        {groups.map(({ kind, items }) => {
          const meta = KIND_META[kind]
          return (
            <div key={kind}>
              <p className={cn('mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase', meta.text)}>
                <span className={cn('size-1.5 rounded-full', meta.dot)} aria-hidden />
                {meta.label}
              </p>
              <ul className="space-y-1">
                {items.map((c, idx) => (
                  <li key={idx} className="flex gap-2 text-[13px] leading-snug text-muted">
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-border-strong" aria-hidden />
                    {c.text}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </section>
  )
}
