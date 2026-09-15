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
        setDone(
          json.imported
            ? `Connected. ${json.imported} upcoming ${json.imported === 1 ? 'deadline' : 'deadlines'} added to your calendar.`
            : 'Connected — but Moodle had no upcoming deadlines to import yet.',
        )
      } else if (action === 'sync') {
        setDone(`Up to date. ${json.imported ?? 0} ${json.imported === 1 ? 'deadline' : 'deadlines'} checked.`)
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

            <StatRow
              label="Deadlines imported"
              hint="Only items still ahead of you are added — finished work is left behind."
            >
              <span className="text-[13px] tabular-nums text-fg">
                {status?.upcoming ?? 0} upcoming
              </span>
            </StatRow>

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
