import { useEffect, useState } from 'react'
import { Ban, Loader2, Rss, UserRoundCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'

/**
 * Who blocked whom, and who follows whom.
 *
 * WHY BLOCKS ARE READABLE HERE AT ALL. A block is a statement one student made
 * about another, and it is the most sensitive row in this product — so the
 * bar for showing it is that moderating harassment is impossible without it.
 * One block between two people is usually nothing; the same person collecting
 * several is the signal, which is why "blocked by more than one" gets its own
 * panel instead of being left for someone to spot by reading the list.
 *
 * It is never shown to the blocked person, and there is no action on it here:
 * this is for noticing, not for intervening in somebody's contact list.
 */
interface Counts {
  blocks: number
  follows: number
  friendships: number
  pending: number
}
interface BlockRow {
  blocker_handle: string
  blocker_name: string | null
  blocked_handle: string
  blocked_name: string | null
  created_at: string
}
interface FollowRow {
  follower_handle: string
  follower_name: string | null
  following_handle: string
  following_name: string | null
  created_at: string | null
}
interface MostBlocked {
  handle: string
  name: string | null
  blocked_by: number
}
interface Graph {
  counts?: Counts
  blocks?: BlockRow[]
  follows?: FollowRow[]
  most_blocked?: MostBlocked[]
}

const when = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function SocialTab() {
  const [graph, setGraph] = useState<Graph | null>(null)
  // Loading and failed are different states. Collapsing them is how the
  // support queue told people their ticket was never filed.
  const [failed, setFailed] = useState(false)
  const [reloads, setReloads] = useState(0)

  useEffect(() => {
    let alive = true
    void (async () => {
      const { data, error } = await supabase.rpc('admin_social_graph', { p_limit: 100 })
      if (!alive) return
      if (error) {
        setFailed(true)
        return
      }
      setFailed(false)
      setGraph((data as Graph | null) ?? {})
    })()
    return () => {
      alive = false
    }
  }, [reloads])

  if (failed) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-center">
        <p className="text-[13px] text-fg">Could not load the social graph.</p>
        <p className="mt-1 text-[12px] text-subtle">
          If this is a fresh deploy, <code className="rounded bg-surface-2 px-1">db/blocks.sql</code>{' '}
          may not have been run yet.
        </p>
        <button
          type="button"
          onClick={() => setReloads((n) => n + 1)}
          className="mt-3 rounded-lg bg-accent-soft px-3 py-1.5 text-[12.5px] font-medium text-accent"
        >
          Try again
        </button>
      </div>
    )
  }

  if (!graph) {
    return (
      <p className="flex items-center gap-2 px-1 py-10 text-[13px] text-subtle">
        <Loader2 size={14} className="animate-spin" aria-hidden /> Loading…
      </p>
    )
  }

  const c = graph.counts
  const blocks = graph.blocks ?? []
  const follows = graph.follows ?? []
  const most = graph.most_blocked ?? []

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Blocks" value={c?.blocks ?? 0} icon={Ban} />
        <Stat label="Follows" value={c?.follows ?? 0} icon={Rss} />
        <Stat label="Connections" value={c?.friendships ?? 0} icon={UserRoundCheck} />
        <Stat label="Pending requests" value={c?.pending ?? 0} icon={UserRoundCheck} />
      </div>

      {most.length > 0 && (
        <Panel title="Blocked by more than one person">
          <ul className="divide-y divide-border">
            {most.map((m) => (
              <li key={m.handle} className="flex items-center justify-between px-3.5 py-2.5">
                <span className="text-[13px] text-fg">
                  {m.name ?? `@${m.handle}`}{' '}
                  <span className="text-[12px] text-subtle">@{m.handle}</span>
                </span>
                <span className="text-[12.5px] font-medium text-warning">
                  {m.blocked_by} blocks
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title={`Blocks (${blocks.length})`}>
        {blocks.length === 0 ? (
          <p className="px-3.5 py-6 text-center text-[12.5px] text-subtle">
            Nobody has blocked anybody.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {blocks.map((b) => (
              <li
                key={`${b.blocker_handle}-${b.blocked_handle}`}
                className="flex items-center justify-between gap-3 px-3.5 py-2.5"
              >
                <span className="min-w-0 text-[12.5px] text-fg">
                  <span className="font-medium">@{b.blocker_handle}</span>
                  <span className="text-subtle"> blocked </span>
                  <span className="font-medium">@{b.blocked_handle}</span>
                </span>
                <span className="shrink-0 text-[11.5px] text-subtle">{when(b.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title={`Follows (${follows.length})`}>
        {follows.length === 0 ? (
          <p className="px-3.5 py-6 text-center text-[12.5px] text-subtle">No follows yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {follows.map((f, i) => (
              <li
                key={`${f.follower_handle}-${f.following_handle}-${i}`}
                className="flex items-center justify-between gap-3 px-3.5 py-2.5"
              >
                <span className="min-w-0 text-[12.5px] text-fg">
                  <span className="font-medium">@{f.follower_handle}</span>
                  <span className="text-subtle"> follows </span>
                  <span className="font-medium">@{f.following_handle}</span>
                </span>
                <span className="shrink-0 text-[11.5px] text-subtle">{when(f.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <p className="px-1 text-[11.5px] leading-relaxed text-subtle">
        A blocked person is never told, and blocking also removes the connection and the follow in
        both directions. Shown here so a pattern of complaints about one account can be seen, not
        as a list to act on row by row.
      </p>
    </div>
  )
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number
  icon: typeof Ban
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3.5 py-3">
      <p className="flex items-center gap-1.5 text-[11.5px] text-subtle">
        <Icon size={12} aria-hidden />
        {label}
      </p>
      <p className="mt-1 font-display text-[22px] leading-none font-semibold text-fg tabular-nums">
        {value}
      </p>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <h3 className="border-b border-border px-3.5 py-2 text-[12px] font-semibold text-fg">
        {title}
      </h3>
      {children}
    </section>
  )
}
