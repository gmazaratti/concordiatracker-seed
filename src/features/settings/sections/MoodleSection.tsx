import { useCallback, useEffect, useState } from 'react'
import {
  Eye,
  EyeOff,
  AlertTriangle,
  Check,
  Loader2,
  RefreshCw,
  Unplug,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAppData } from '@/app/providers/app-data'
import { HowTo } from '@/features/moodle/MoodleGuide'
import { WhatThatLinkIs } from '@/features/moodle/WhatThatLinkIs'
import { SyncedList, type SyncedItem } from '@/features/moodle/SyncedList'
import { MoodleCourses } from '@/features/moodle/MoodleCourses'
import { relative } from '@/features/moodle/moodle-ui'
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


/**
 * A hint, deliberately NOT validation — the server is what decides whether a
 * link is usable (`validateMoodleIcsUrl` pins the host and the path). This
 * exists only so a masked field can still tell you the paste landed.
 */
function looksLikeMoodleLink(value: string): boolean {
  const v = value.trim().toLowerCase()
  return v.includes('export_execute.php') && v.includes('authtoken=')
}

export function MoodleSection() {
  const [status, setStatus] = useState<MoodleStatus | null>(null)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState<'' | 'connect' | 'sync' | 'disconnect'>('')
  const [reveal, setReveal] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const [items, setItems] = useState<SyncedItem[]>([])
  const { personalTasks: tasks } = useAppData()
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

            {/* The feed named these classes; offer them rather than making
                the student type codes they just handed us. */}
            <MoodleCourses tasks={tasks} />

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
            {/*
              MASKED BY DEFAULT, and this is a safety feature rather than a
              nicety. The link carries `authtoken=…`, which reads your Moodle
              calendar forever with no login — so the one moment it is ever on
              screen is the moment it can be screen-shared, shoulder-surfed or
              filmed. A recording of this flow leaked a live token exactly
              that way, and the answer is not to ask people to blur video.
              The eye is there because you still need to be able to check a
              paste that went wrong.
            */}
            <div className="relative">
              <input
                id="moodle-url"
                type={reveal ? 'url' : 'password'}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://moodle.concordia.ca/moodle/calendar/export_execute.php?..."
                spellCheck={false}
                autoComplete="off"
                // Password managers offer to save anything shaped like this.
                data-1p-ignore
                data-lpignore="true"
                className="w-full rounded-lg border border-border bg-canvas py-2 pr-10 pl-3 font-mono text-[12px] text-fg outline-none placeholder:text-subtle focus:border-border-strong"
              />
              <button
                type="button"
                onClick={() => setReveal((v) => !v)}
                aria-label={reveal ? 'Hide the link' : 'Show the link'}
                title={reveal ? 'Hide the link' : 'Show the link'}
                className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-lg text-subtle transition-colors duration-150 hover:text-fg"
              >
                {reveal ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />}
              </button>
            </div>
            {/* Confirmation without exposure: while it is hidden you still
                need to know the paste landed and landed right. */}
            {url.trim() !== '' && (
              <p className="text-[11.5px] text-subtle">
                {looksLikeMoodleLink(url)
                  ? 'Looks like a Moodle calendar link.'
                  : 'That does not look like the calendar link yet — it should contain export_execute.php and authtoken.'}
              </p>
            )}
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

      <WhatThatLinkIs />
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
