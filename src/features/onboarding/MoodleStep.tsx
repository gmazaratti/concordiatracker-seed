import { useState } from 'react'
import { AlertTriangle, ArrowUpRight, Check, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { HowTo } from '@/features/moodle/MoodleGuide'
import { GraduationCap } from 'lucide-react'
import { Slide } from './OnboardingSlides'

/**
 * Connect Moodle, during setup.
 *
 * WHY HERE. This is the one step that makes the app useful before the student
 * has typed anything: one pasted link and Today has their real deadlines and
 * their real classes. Every other route in — a syllabus, a blueprint, typing a
 * course — costs more effort for less. It is recommended, and it is skippable,
 * because an onboarding step nobody can get past is a wall.
 *
 * It reuses `HowTo` rather than restating the instructions, so the drawing of
 * Moodle's export page cannot say one thing here and another in Settings.
 *
 * Deliberately NOT doing the course import here: this step's job is to get the
 * link in. Offering "and add these five classes?" in the same breath is two
 * decisions in one screen, and the offer is waiting in Settings → Moodle (and
 * on the next sync) either way.
 */
export function MoodleStep({ onConnected }: { onConnected: () => void }) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ imported: number; found: number } | null>(null)

  async function connect() {
    if (busy || url.trim().length < 20) return
    setBusy(true)
    setError('')
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) throw new Error('Sign in again to connect Moodle.')
      const res = await fetch('/api/moodle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: 'connect', url: url.trim() }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        error?: string
        imported?: number
        found?: number
      }
      if (!res.ok) throw new Error(json.error || `That didn’t work (${res.status}).`)
      setDone({ imported: json.imported ?? 0, found: json.found ?? 0 })
      onConnected()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <Slide
        visual={
          <span className="grid size-16 place-items-center rounded-2xl bg-success/15 text-success">
            <Check size={32} aria-hidden />
          </span>
        }
        headline="Moodle connected"
        sub={
          done.imported > 0
            ? `${done.imported} upcoming ${done.imported === 1 ? 'deadline is' : 'deadlines are'} already in your calendar. We check again every night.`
            : 'Nothing upcoming in Moodle yet — we check again every night and add deadlines as your professors post them.'
        }
        extra={
          <p className="mt-5 text-[12.5px] text-subtle">
            You can disconnect any time in Settings → Moodle.
          </p>
        }
      />
    )
  }

  return (
    <Slide
      visual={
        <span className="grid size-16 place-items-center rounded-2xl bg-accent-soft text-accent">
          <GraduationCap size={32} aria-hidden />
        </span>
      }
      headline="Bring your deadlines with you"
      sub="Paste one link from Moodle and every deadline your professors have posted shows up here, re-checked every night. Read-only, and never your password."
      extra={
        <div className="mt-6 w-full space-y-3 text-left">
        <HowTo />

        <div className="space-y-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://moodle.concordia.ca/moodle/calendar/export_execute.php?..."
            spellCheck={false}
            autoComplete="off"
            aria-label="Your Moodle calendar link"
            className="w-full rounded-lg border border-border bg-canvas px-3 py-2 font-mono text-[12px] text-fg placeholder:text-subtle outline-none focus:border-border-strong"
          />
          <button
            type="button"
            disabled={busy || url.trim().length < 20}
            onClick={() => void connect()}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-[13px] font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy && <Loader2 size={14} className="animate-spin" aria-hidden />}
            Connect Moodle
          </button>
        </div>

        {error && (
          <p className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-[12.5px] leading-relaxed text-fg">
            <AlertTriangle size={14} className="mt-px shrink-0 text-danger" aria-hidden />
            <span>{error}</span>
          </p>
        )}

          <p className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-subtle">
            <ArrowUpRight size={12} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              Skip it if you like — Settings → Moodle has the same thing whenever you want it.
            </span>
          </p>
        </div>
      }
    />
  )
}
