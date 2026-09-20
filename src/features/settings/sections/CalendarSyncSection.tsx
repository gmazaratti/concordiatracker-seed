import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  Check,
  Copy,
  Loader2,
  RefreshCw,
  Unplug,
} from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { useSettings } from '@/app/providers/settings'
import { Switch } from '@/features/settings/controls'
import { AppleGlyph } from '@/components/AppleGlyph'
import { relative } from '@/features/moodle/moodle-ui'
import {
  disableFeed,
  enableFeed,
  feedUrls,
  myCalendarFeed,
  rotateFeed,
  setFeedLayers,
  type CalendarFeed,
} from '@/lib/calendar-sync'

/**
 * Settings → Calendar sync.
 *
 * WHAT THIS SCREEN HAS TO BE HONEST ABOUT, because the previous version of
 * this feature was a button that set a flag and said "Sync set up":
 *
 *   1. It is ONE WAY. Your deadlines appear in Google or Apple. Anything you
 *      add over there does not come back. Saying "sync" without saying that
 *      is how someone ends up trusting a calendar we never read.
 *   2. WE DO NOT CONTROL THE REFRESH. Google re-reads a subscribed calendar on
 *      its own schedule, typically every few hours and sometimes a day. Apple
 *      lets you choose. If the panel does not say this, the first moved
 *      deadline reads as the sync being broken.
 *   3. THE LINK IS A KEY. Anyone who has it can read these dates without
 *      signing in. That is what makes it work at all, and it is why Rotate
 *      sits right next to it rather than three screens away.
 */
export function CalendarSyncSection() {
  const { plan } = useAppData()
  const { setSection } = useSettings()
  const [feed, setFeed] = useState<CalendarFeed | null | undefined>(undefined)
  const [busy, setBusy] = useState<'' | 'enable' | 'rotate' | 'disable'>('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')
  const [confirmRotate, setConfirmRotate] = useState(false)

  const [reloads, setReloads] = useState(0)
  const reload = useCallback(() => setReloads((n) => n + 1), [])

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const row = await myCalendarFeed()
        if (alive) setFeed(row)
      } catch {
        // A pending migration reads as "not set up", never as a broken screen.
        if (alive) setFeed(null)
      }
    })()
    return () => {
      alive = false
    }
  }, [reloads])

  async function run(what: 'enable' | 'rotate' | 'disable') {
    setBusy(what)
    setError('')
    try {
      if (what === 'enable') await enableFeed()
      if (what === 'rotate') await rotateFeed()
      if (what === 'disable') await disableFeed()
      setConfirmRotate(false)
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy('')
    }
  }

  async function toggleLayer(which: 'assessments' | 'tasks', on: boolean) {
    if (!feed) return
    // Optimistic, then re-read: a switch that waits for a round trip before it
    // moves feels broken on a phone.
    setFeed({
      ...feed,
      [which === 'assessments' ? 'include_assessments' : 'include_tasks']: on,
    })
    try {
      await setFeedLayers({ [which]: on })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that.')
    }
    reload()
  }

  function copy(text: string, label: string) {
    void navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(label)
        window.setTimeout(() => setCopied(''), 1800)
      },
      () => setError('Your browser would not let us copy. Select the link and copy it by hand.'),
    )
  }

  const pro = plan === 'semester'
  const urls = feed ? feedUrls(feed.token) : null

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border bg-surface p-4">
        <h3 className="text-[13px] font-semibold text-fg">Google &amp; Apple Calendar</h3>
        <p className="mt-0.5 mb-3 text-[12.5px] leading-relaxed text-muted">
          Put your ConcordiaTracker deadlines in the calendar you already check. One link, and it
          keeps itself up to date — move a date here and it moves there.
        </p>

        {feed === undefined ? (
          <p className="flex items-center gap-2 py-4 text-[12.5px] text-subtle">
            <Loader2 size={14} className="animate-spin" aria-hidden />
            Loading
          </p>
        ) : !feed ? (
          <NotYet pro={pro} busy={busy === 'enable'} onEnable={() => void run('enable')} onBilling={() => setSection('billing')} />
        ) : (
          <div className="space-y-4">
            {/* The three doors. Google and Apple are one tap; the link covers
                Outlook, Thunderbird, and everything else that speaks iCal. */}
            <div className="grid gap-2 sm:grid-cols-2">
              <a
                href={urls!.google}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface-2 px-3 py-2.5 text-[13px] font-medium text-fg transition-colors hover:border-accent"
              >
                <GoogleGlyph />
                Add to Google Calendar
                <ArrowUpRight size={13} className="text-subtle" aria-hidden />
              </a>
              <a
                href={urls!.webcal}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface-2 px-3 py-2.5 text-[13px] font-medium text-fg transition-colors hover:border-accent"
              >
                <AppleGlyph className="size-4" />
                Add to Apple Calendar
              </a>
            </div>

            <div>
              <label htmlFor="feed-url" className="mb-1.5 block text-[12.5px] font-medium text-fg">
                Or paste this link into any calendar
              </label>
              <div className="flex gap-2">
                <input
                  id="feed-url"
                  readOnly
                  value={urls!.https}
                  onFocus={(e) => e.currentTarget.select()}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-canvas px-3 py-2 font-mono text-[11.5px] text-muted outline-none focus:border-border-strong"
                />
                <button
                  type="button"
                  onClick={() => copy(urls!.https, 'link')}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[12.5px] font-medium text-fg transition-colors hover:bg-surface-2"
                >
                  {copied === 'link' ? (
                    <Check size={13} className="text-success" aria-hidden />
                  ) : (
                    <Copy size={13} aria-hidden />
                  )}
                  {copied === 'link' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-subtle">
                Treat it like a password. Anyone with this link can read these dates without
                signing in — that is exactly how Google reads it, and why Rotate is below.
              </p>
            </div>

            <div className="space-y-0.5 border-t border-border pt-3">
              <LayerRow
                label="Course deadlines"
                hint="Assignments, quizzes and exams from your courses."
                checked={feed.include_assessments}
                onChange={(v) => void toggleLayer('assessments', v)}
              />
              <LayerRow
                label="Tasks and Moodle deadlines"
                hint="Anything you added yourself, plus whatever Moodle sends."
                checked={feed.include_tasks}
                onChange={(v) => void toggleLayer('tasks', v)}
              />
            </div>

            <Freshness feed={feed} />

            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              {confirmRotate ? (
                <>
                  <button
                    type="button"
                    disabled={busy !== ''}
                    onClick={() => void run('rotate')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-danger px-3 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {busy === 'rotate' && <Loader2 size={14} className="animate-spin" aria-hidden />}
                    Yes, break the old link
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRotate(false)}
                    className="rounded-lg px-3 py-2 text-[13px] text-muted transition-colors hover:text-fg"
                  >
                    Keep it
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={busy !== ''}
                  onClick={() => setConfirmRotate(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px] font-medium text-fg transition-colors hover:bg-surface-2 disabled:opacity-50"
                >
                  <RefreshCw size={14} aria-hidden />
                  Rotate link
                </button>
              )}
              <button
                type="button"
                disabled={busy !== ''}
                onClick={() => void run('disable')}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
              >
                {busy === 'disable' ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden />
                ) : (
                  <Unplug size={14} aria-hidden />
                )}
                Turn off
              </button>
            </div>
            {confirmRotate && (
              <p className="text-[11.5px] leading-relaxed text-subtle">
                Rotating makes a new link and kills the old one everywhere it has been pasted.
                You will have to re-add the calendar in Google or Apple afterwards.
              </p>
            )}
          </div>
        )}

        {error && (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-[12.5px] leading-relaxed text-fg">
            <AlertTriangle size={14} className="mt-px shrink-0 text-danger" aria-hidden />
            <span>{error}</span>
          </p>
        )}
      </section>

      <HowItBehaves />
    </div>
  )
}

/* ── Pieces ───────────────────────────────────────────────────────────────── */

function NotYet({
  pro,
  busy,
  onEnable,
  onBilling,
}: {
  pro: boolean
  busy: boolean
  onEnable: () => void
  onBilling: () => void
}) {
  if (!pro) {
    return (
      <div className="rounded-lg border border-accent/30 bg-accent-soft/40 px-3.5 py-3">
        <p className="text-[12.5px] leading-relaxed text-fg">
          Calendar sync comes with the <span className="font-medium">Semester pass</span>.
        </p>
        <button
          type="button"
          onClick={onBilling}
          className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-medium text-accent-contrast transition-opacity hover:opacity-90"
        >
          See the pass
        </button>
      </div>
    )
  }
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onEnable}
      className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {busy ? (
        <Loader2 size={14} className="animate-spin" aria-hidden />
      ) : (
        <Calendar size={14} aria-hidden />
      )}
      Turn on calendar sync
    </button>
  )
}

/**
 * Has anything actually read the link?
 *
 * This is the whole answer to the only support question this feature will
 * produce. "Nothing has read it yet" and "Google read it two hours ago" send
 * someone to two completely different fixes, and neither is guessable from
 * their end.
 */
function Freshness({ feed }: { feed: CalendarFeed }) {
  if (!feed.last_fetched_at) {
    return (
      <p className="rounded-lg border border-border bg-canvas/60 px-3 py-2 text-[12px] leading-relaxed text-subtle">
        Nothing has read this link yet. Google usually fetches it within a few minutes of you
        adding it; Apple fetches it straight away.
      </p>
    )
  }
  const who = /google/i.test(feed.last_fetch_agent ?? '')
    ? 'Google'
    : /(apple|CalendarAgent|dataaccessd|iOS)/i.test(feed.last_fetch_agent ?? '')
      ? 'Apple Calendar'
      : 'A calendar'
  return (
    <p className="rounded-lg border border-border bg-canvas/60 px-3 py-2 text-[12px] leading-relaxed text-subtle">
      {who} last read this {relative(feed.last_fetched_at)} · {feed.fetch_count}{' '}
      {feed.fetch_count === 1 ? 'fetch' : 'fetches'} so far.
    </p>
  )
}

function HowItBehaves() {
  return (
    <section className="rounded-xl border border-border bg-surface/60 p-4">
      <h3 className="text-[13px] font-semibold text-fg">What this does and does not do</h3>
      <ul className="mt-2 space-y-2.5 text-[12.5px] leading-relaxed text-muted">
        <li className="flex gap-2">
          <Check size={14} className="mt-0.5 shrink-0 text-success" aria-hidden />
          <span>
            <span className="font-medium text-fg">It goes one way.</span> Your deadlines show up in
            Google or Apple. Events you create over there stay over there — we never read your
            calendar, and we never ask for access to it.
          </span>
        </li>
        <li className="flex gap-2">
          <Check size={14} className="mt-0.5 shrink-0 text-success" aria-hidden />
          <span>
            <span className="font-medium text-fg">Your calendar decides how often it refreshes.</span>{' '}
            Apple checks as often as you tell it to, down to every five minutes. Google uses its
            own schedule and can take several hours — that is Google&rsquo;s behaviour for every
            subscribed calendar, not something we can speed up. If a date changed and you need it
            now, open ConcordiaTracker.
          </span>
        </li>
        <li className="flex gap-2">
          <Check size={14} className="mt-0.5 shrink-0 text-success" aria-hidden />
          <span>
            <span className="font-medium text-fg">Nothing is written to your account.</span> Turning
            it off removes the link; the calendar entries disappear the next time your calendar
            looks.
          </span>
        </li>
      </ul>
    </section>
  )
}

function LayerRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-fg">{label}</p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-subtle">{hint}</p>
      </div>
      <div className="shrink-0 pt-0.5">
        <Switch checked={checked} onChange={onChange} label={`Include ${label}`} />
      </div>
    </div>
  )
}

/** Google's mark, inline — lucide dropped brand icons, same as the social
 *  links elsewhere in the app. */
function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.45a5.5 5.5 0 0 1-2.4 3.6v3h3.88c2.27-2.1 3.57-5.18 3.57-8.63Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.9l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.73-4.95H1.26v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.26a12 12 0 0 0 0 10.8l4.01-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.26 6.6l4.01 3.1C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  )
}
