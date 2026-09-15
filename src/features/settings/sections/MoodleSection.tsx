import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ExternalLink,
  Loader2,
  Lock,
  RefreshCw,
  Unplug,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatDueDateTime } from '@/lib/date'
import { cn } from '@/lib/cn'

/**
 * Settings → Moodle.
 *
 * THE COPY IS THE FEATURE HERE. A student is being asked to paste a link that
 * carries a private token into a third-party site, which is exactly the shape
 * of a phishing request — so the screen has to earn it: what the link is, what
 * we do with it, what we cannot do with it, and how to take it back. Vague
 * reassurance ("we take security seriously") is worse than nothing, because
 * the specific claims are the checkable ones.
 */

/** One synced deadline, as the panel shows it. */
interface SyncedItem {
  id: string
  title: string
  due: string
  note: string | null
  moved_from: string | null
}

interface MoodleStatus {
  connected: boolean
  status?: 'active' | 'error' | 'paused'
  last_sync_at?: string | null
  last_error?: string | null
  event_count?: number
  upcoming?: number
}

const HELP_URL = 'https://moodle.concordia.ca/moodle/calendar/export.php'

export function MoodleSection() {
  const [status, setStatus] = useState<MoodleStatus | null>(null)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState<'' | 'connect' | 'sync' | 'disconnect'>('')
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const [items, setItems] = useState<SyncedItem[]>([])
  const [showAll, setShowAll] = useState(false)

  // `reload` only bumps a counter; the fetch and the setState both happen
  // inside the effect, after an await. Calling a loader that setStates
  // synchronously from an effect trips react-hooks/set-state-in-effect - the
  // same restructure the support-ticket lists needed.
  const [reloads, setReloads] = useState(0)
  const reload = useCallback(() => setReloads((n) => n + 1), [])

  useEffect(() => {
    let alive = true
    void (async () => {
      const { data, error: e } = await supabase.rpc('my_moodle_status')
      if (!alive) return
      // A missing migration must read as "not connected", not a broken screen.
      setStatus(e || !data ? { connected: false } : (data as MoodleStatus))

      /**
       * The rows themselves, read straight from the student's own todos.
       *
       * Not taken from the API response: this way the list is what is actually
       * IN the database right now, including whatever last night's cron wrote
       * while nobody was looking. A count the panel computed from its own last
       * reply would agree with itself forever and prove nothing.
       */
      const { data: rows } = await supabase
        .from('todos')
        .select('id,title,due,note,moved_from')
        .eq('source', 'moodle')
        .order('due', { ascending: true })
      if (alive) setItems((rows as SyncedItem[] | null) ?? [])
    })()
    return () => {
      alive = false
    }
  }, [reloads])

  async function call(action: 'connect' | 'sync' | 'disconnect', body: object = {}) {
    setBusy(action)
    setError('')
    setDone('')
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) throw new Error('Sign in again to change this.')
      const res = await fetch('/api/moodle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action, ...body }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        error?: string
        imported?: number
        found?: number
        removed?: number
      }
      if (!res.ok) throw new Error(json.error || `That didn’t work (${res.status}).`)

      if (action === 'connect') {
        setUrl('')
        setDone(summarise('Connected.', json))
      } else if (action === 'sync') {
        setDone(summarise('Up to date.', json))
      } else {
        setDone(`Disconnected. ${json.removed ?? 0} synced ${json.removed === 1 ? 'item' : 'items'} removed.`)
      }
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy('')
    }
  }

  const connected = status?.connected === true

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border bg-surface p-4">
        <h3 className="text-[13px] font-semibold text-fg">Moodle calendar</h3>
        <p className="mt-0.5 mb-3 text-[12.5px] leading-relaxed text-muted">
          Bring your Moodle assignment deadlines into ConcordiaTracker, checked again every night.
        </p>
        <div className="space-y-3">
          {!connected && <HowTo />}

        {connected ? (
          <>
            <StatRow
              label="Status"
              hint={
                status?.last_sync_at
                  ? `Last checked ${relative(status.last_sync_at)}`
                  : 'Waiting for the first check'
              }
            >
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium',
                  status?.status === 'error'
                    ? 'bg-danger/10 text-danger'
                    : 'bg-success/10 text-success',
                )}
              >
                {status?.status === 'error' ? (
                  <AlertTriangle size={13} aria-hidden />
                ) : (
                  <Check size={13} aria-hidden />
                )}
                {status?.status === 'error' ? 'Needs attention' : 'Connected'}
              </span>
            </StatRow>

            {status?.last_error && (
              <p className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-[12.5px] leading-relaxed text-fg">
                <AlertTriangle size={14} className="mt-px shrink-0 text-danger" aria-hidden />
                <span>{status.last_error}</span>
              </p>
            )}

            <SyncedList items={items} showAll={showAll} onShowAll={() => setShowAll(true)} />

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                disabled={busy !== ''}
                onClick={() => void call('sync')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px] font-medium text-fg transition-colors hover:bg-surface-2 disabled:opacity-50"
              >
                {busy === 'sync' ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden />
                ) : (
                  <RefreshCw size={14} aria-hidden />
                )}
                Sync now
              </button>
              <button
                type="button"
                disabled={busy !== ''}
                onClick={() => void call('disconnect')}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
              >
                {busy === 'disconnect' ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden />
                ) : (
                  <Unplug size={14} aria-hidden />
                )}
                Disconnect
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <label htmlFor="moodle-url" className="block text-[13px] font-medium text-fg">
              Paste your calendar link
            </label>
            <input
              id="moodle-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://moodle.concordia.ca/moodle/calendar/export_execute.php?..."
              spellCheck={false}
              autoComplete="off"
              className="w-full rounded-lg border border-border bg-canvas px-3 py-2 font-mono text-[12px] text-fg placeholder:text-subtle outline-none focus:border-border-strong"
            />
            <button
              type="button"
              disabled={busy !== '' || url.trim().length < 20}
              onClick={() => void call('connect', { url: url.trim() })}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy === 'connect' && <Loader2 size={14} className="animate-spin" aria-hidden />}
              Connect Moodle
            </button>
          </div>
        )}

        {error && (
          <p className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-[12.5px] leading-relaxed text-fg">
            <AlertTriangle size={14} className="mt-px shrink-0 text-danger" aria-hidden />
            <span>{error}</span>
          </p>
        )}
          {done && (
            <p className="flex items-start gap-2 rounded-lg border border-success/40 bg-success/5 px-3 py-2 text-[12.5px] leading-relaxed text-fg">
              <Check size={14} className="mt-px shrink-0 text-success" aria-hidden />
              <span>{done}</span>
            </p>
          )}
        </div>
      </section>

      <WhatWeDoWithIt />
    </div>
  )
}

/**
 * "Connected. 5 of 23 imported — the other 18 have already passed."
 *
 * The gap between what the feed HELD and what we KEPT is the interesting
 * number, and the one a bare "5 deadlines checked" hides. Without it, a
 * student with a full year in Moodle sees 5 and reasonably wonders what
 * happened to the rest.
 */
function summarise(lead: string, json: { imported?: number; found?: number }): string {
  const kept = json.imported ?? 0
  const found = json.found ?? kept
  if (found === 0) return `${lead} Moodle's calendar is empty — nothing to import yet.`
  if (kept === 0) return `${lead} All ${found} events in your Moodle calendar have already passed.`
  const noun = kept === 1 ? 'deadline' : 'deadlines'
  if (found > kept) {
    const past = found - kept
    return `${lead} ${kept} upcoming ${noun} imported. The other ${past} ${past === 1 ? 'has' : 'have'} already passed.`
  }
  return `${lead} ${kept} ${noun} imported.`
}

/** One "label / value" line, with the explanation under the label. */
function StatRow({
  label,
  hint,
  children,
}: {
  label: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-border pt-3">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-fg">{label}</p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-subtle">{hint}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

/** Ahead of you vs behind you. Module-level so reading the clock is allowed
 *  (`react-hooks/purity` forbids it inside a component body). */
function splitByTime(items: SyncedItem[]): { upcoming: SyncedItem[]; past: number } {
  const now = Date.now()
  const upcoming = items.filter((i) => new Date(i.due).getTime() >= now)
  return { upcoming, past: items.length - upcoming.length }
}

/**
 * What it actually found.
 *
 * The panel used to say "5 upcoming" and stop, which is a claim the student
 * has no way to check — and this feature already asks them to trust a link
 * they cannot read. Showing the rows is the cheapest honesty available: if
 * something is missing or wrong, they can see it here rather than discovering
 * it in week ten.
 *
 * Past items are counted but not listed. They are real (the sync keeps what it
 * already imported, because you may have ticked it off) and they are not what
 * anyone opens this panel to check.
 */
function SyncedList({
  items,
  showAll,
  onShowAll,
}: {
  items: SyncedItem[]
  showAll: boolean
  onShowAll: () => void
}) {
  const { upcoming, past } = splitByTime(items)
  const shown = showAll ? upcoming : upcoming.slice(0, 6)

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-[12.5px] text-subtle">
        Nothing imported yet. If Moodle has deadlines you expect to see here, press Sync now.
      </p>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <p className="flex items-center justify-between gap-2 border-b border-border bg-surface-2/40 px-3 py-2 text-[11px] font-medium tracking-wide text-subtle uppercase">
        <span>From your Moodle calendar</span>
        <span className="tabular-nums normal-case">
          {upcoming.length} upcoming{past > 0 && ` · ${past} past`}
        </span>
      </p>

      {upcoming.length === 0 ? (
        <p className="px-3 py-4 text-center text-[12.5px] text-subtle">
          Everything Moodle knows about has already passed.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {shown.map((i) => (
            <li key={i.id} className="flex items-start justify-between gap-3 px-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] text-fg" title={i.title}>
                  {i.title}
                </span>
                {/* The course short name is the single most useful thing Moodle
                    sends, because it is what tells you which class this is. */}
                {i.note && (
                  <span className="block truncate text-[11px] text-subtle" title={i.note}>
                    {i.note}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-right text-[11.5px] text-muted tabular-nums">
                {formatDueDateTime(i.due)}
                {i.moved_from && (
                  <span className="block text-[10.5px] text-warning">moved by Moodle</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!showAll && upcoming.length > shown.length && (
        <button
          type="button"
          onClick={onShowAll}
          className="w-full border-t border-border px-3 py-2 text-[12px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
          Show all {upcoming.length}
        </button>
      )}
    </div>
  )
}

/**
 * The instructions, in the four clicks it actually takes.
 *
 * Written against the real Moodle UI rather than described in the abstract:
 * someone following this should never have to work out what we meant.
 */
function HowTo() {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface-2/40 p-4">
      <ol className="space-y-2">
        <Step n={1}>
          Open{' '}
          <a
            href={HELP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
          >
            Moodle → Calendar → Export
            <ExternalLink size={11} aria-hidden />
          </a>{' '}
          and sign in if it asks. You will land on the page below.
        </Step>
        <Step n={2}>
          Pick the two highlighted options, then press{' '}
          <strong className="font-medium text-fg">Get calendar URL</strong>.
        </Step>
        <Step n={3}>A long link appears under the buttons. Copy all of it and paste it below.</Step>
      </ol>

      <ExportPagePreview />
    </div>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5 text-[13px] leading-relaxed text-muted">
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">
        {n}
      </span>
      <span>{children}</span>
    </li>
  )
}

/**
 * A replica of Moodle's Export page, with the two answers marked.
 *
 * Written as markup rather than a screenshot on purpose: a screenshot of
 * someone else's product goes stale the moment they restyle it, weighs more
 * than this does, and cannot be read by a screen reader. This also lets the
 * one genuinely confusing thing be shown rather than described — the page has
 * TWO buttons side by side, and **Export** downloads a file that does nothing
 * for us while **Get calendar URL** produces the link. That is the mistake
 * people actually make.
 *
 * Deliberately not pixel-faithful: it is a diagram of the choices, and dressing
 * it up as Concordia's own page would be a small lie about what you are
 * looking at.
 */
function ExportPagePreview() {
  return (
    <figure className="overflow-hidden rounded-lg border border-border bg-canvas">
      <figcaption className="border-b border-border px-3 py-1.5 text-[11px] text-subtle">
        What you will see on Moodle
      </figcaption>
      <div className="space-y-3 p-3">
        <Field label="Events to export">
          <Choice picked>All events</Choice>
          <Choice>Events related to categories</Choice>
          <Choice>Events related to courses</Choice>
          <Choice>Events related to groups</Choice>
          <Choice>My personal events</Choice>
        </Field>

        <Field label="Time period">
          <Choice>This week</Choice>
          <Choice>This month</Choice>
          <Choice picked>Recent and next 60 days</Choice>
          <Choice>Custom range</Choice>
        </Field>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <span className="rounded-md bg-accent px-2.5 py-1 text-[11.5px] font-medium text-accent-contrast">
            Get calendar URL
          </span>
          <span className="rounded-md border border-border px-2.5 py-1 text-[11.5px] text-subtle line-through">
            Export
          </span>
          <span className="text-[11px] text-subtle">
            ← downloads a file instead, and will not work here
          </span>
        </div>
      </div>
      <p className="border-t border-border px-3 py-2 text-[11px] leading-relaxed text-subtle">
        <strong className="font-medium text-fg">Custom range</strong> works too, and is the better
        pick if you want the whole term rather than the next 60 days.
      </p>
    </figure>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium tracking-wide text-subtle uppercase">{label}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

/** One radio line. `picked` is the answer, and it says so in text too — colour
 *  and a filled dot alone would leave a colourblind reader guessing. */
function Choice({ picked = false, children }: { picked?: boolean; children: React.ReactNode }) {
  return (
    <p
      className={cn(
        'flex items-center gap-2 rounded px-1.5 py-0.5 text-[12px]',
        picked ? 'bg-accent-soft font-medium text-fg' : 'text-subtle',
      )}
    >
      <span
        className={cn(
          'grid size-3 shrink-0 place-items-center rounded-full border',
          picked ? 'border-accent' : 'border-border-strong',
        )}
        aria-hidden
      >
        {picked && <span className="size-1.5 rounded-full bg-accent" />}
      </span>
      {children}
      {picked && <span className="ml-auto text-[10.5px] font-semibold text-accent">PICK THIS</span>}
    </p>
  )
}

/**
 * The honest part.
 *
 * Both columns matter. "What this gives you" without "what we can see" reads
 * like marketing; the limits are what make the first column believable.
 */
function WhatWeDoWithIt() {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-fg">
        <Lock size={14} className="text-subtle" aria-hidden />
        What that link is, and what we do with it
      </h3>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold tracking-wide text-subtle uppercase">
            What it gets you
          </p>
          {/* THE TEXT MUST BE ONE <span>. In a flex container every child —
              including each bare text node and each inline <strong> — becomes
              its own flex ITEM, so a sentence with bold words in it was laid
              out as three boxes side by side and wrapped to one word a line.
              The right-hand list never had the bug because its items are not
              flex. Wrapping the prose puts it back in normal inline flow with
              only the icon as a sibling. */}
          <ul className="mt-1.5 space-y-2 text-[12.5px] leading-relaxed text-muted">
            <li className="flex gap-2">
              <CalendarClock size={13} className="mt-[3px] shrink-0 text-accent" aria-hidden />
              <span>
                Every Moodle deadline lands in your{' '}
                <strong className="font-medium text-fg">Calendar</strong>, on the &ldquo;My
                calendar&rdquo; layer, beside your own deadlines.
              </span>
            </li>
            <li className="flex gap-2">
              <RefreshCw size={13} className="mt-[3px] shrink-0 text-accent" aria-hidden />
              <span>
                Re-checked nightly. If a professor moves a date,{' '}
                <strong className="font-medium text-fg">the item says so</strong> &mdash; old date
                and new, so you can see what changed rather than finding it moved.
              </span>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-[11px] font-semibold tracking-wide text-subtle uppercase">
            The limits
          </p>
          <ul className="mt-1.5 space-y-2 text-[12.5px] leading-relaxed text-muted">
            <li>
              The link is <strong className="font-medium text-fg">read-only</strong> and covers your
              calendar only. It cannot see your grades, your submissions or your messages, and
              nothing can be changed in Moodle through it.
            </li>
            <li>
              It is <strong className="font-medium text-fg">not your password</strong>, and we never
              ask for one.
            </li>
            <li>
              We store it where{' '}
              <strong className="font-medium text-fg">our own app cannot read it back</strong> — only
              the sync job can use it.
            </li>
            <li>
              Take it back any time: <strong className="font-medium text-fg">Disconnect</strong>{' '}
              here, or reset the token in Moodle, which kills every copy of the link at once.
            </li>
          </ul>
        </div>
      </div>
      <p className="mt-3 border-t border-border pt-3 text-[11.5px] leading-relaxed text-subtle">
        Moodle does not tell us what an assignment is worth, so synced items arrive as calendar
        deadlines, not graded assessments — they will not change your GPA or your grade breakdown.
      </p>
    </div>
  )
}

/** "3 hours ago" without pulling a date library in for one string. */
function relative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return 'just now'
  const min = Math.round(ms / 60_000)
  if (min < 2) return 'just now'
  if (min < 60) return `${min} minutes ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr} ${hr === 1 ? 'hour' : 'hours'} ago`
  const d = Math.round(hr / 24)
  return `${d} ${d === 1 ? 'day' : 'days'} ago`
}
