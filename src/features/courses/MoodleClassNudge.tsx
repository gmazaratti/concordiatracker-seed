import { useState } from 'react'
import { GraduationCap, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAppData } from '@/app/providers/app-data'
import { useSettings } from '@/app/providers/settings'
import { coursesFromMoodle } from '@/lib/moodle-match'
import { normalizeCode } from '@/lib/prereq'
import { MoodleCourses } from '@/features/moodle/MoodleCourses'

/** Dismissals last the session only — see the note in the component. */
const DISMISS_KEY = 'ct_moodle_nudge_dismissed'

/**
 * "A class in Moodle is not on your Courses page."
 *
 * The offer to import existed only in Settings, which nobody opens looking for
 * something they do not know is there. This puts it where the gap actually
 * shows: the page listing the classes, missing one.
 *
 * IT ONLY APPEARS WHEN THERE IS A REAL GAP — a course Moodle named that is not
 * here — so it is not an advert, it is a discrepancy report. Connect Moodle
 * and add everything and it never appears again.
 *
 * DISMISSAL IS PER SESSION, not forever. A permanent dismissal on a
 * discrepancy is how you end up with a student who dropped a course in
 * September being told nothing in January when they add it back. If they
 * dismiss it, they have decided about THIS visit; the gap is still real
 * tomorrow, and Settings shows it any time.
 */
export function MoodleClassNudge() {
  const { courses, personalTasks } = useAppData()
  const { openSettings } = useSettings()
  const [open, setOpen] = useState(false)
  const [gone, setGone] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })

  const have = new Set(courses.map((c) => normalizeCode(c.code)))
  const missing = coursesFromMoodle(
    personalTasks.map((t) => ({
      id: t.id,
      title: t.title,
      due: t.due,
      note: t.note,
      source: t.source,
    })),
  ).filter((h) => !have.has(normalizeCode(h.code)))

  if (gone || missing.length === 0) return null

  function dismiss() {
    setGone(true)
    try {
      sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* a dismissal that does not persist is a small cost */
    }
  }

  const n = missing.length
  const names = missing.slice(0, 3).map((m) => m.code).join(', ')

  return (
    <div className="mb-4 rounded-xl border border-accent/40 bg-accent-soft/25 p-3.5">
      <div className="flex items-start gap-2.5">
        <GraduationCap size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-fg">
            {n === 1
              ? `${names} is in your Moodle calendar but not here`
              : `${n} classes are in your Moodle calendar but not here`}
          </p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
            {n > 1 && <span className="text-fg">{names}{n > 3 ? ` and ${n - 3} more` : ''}. </span>}
            Adding them takes the code, title and credits from Concordia&rsquo;s calendar.
          </p>

          {open ? (
            <div className="mt-2.5">
              <MoodleCourses tasks={personalTasks} />
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-medium text-accent-contrast transition-opacity hover:opacity-90"
              >
                Review and add
              </button>
              <button
                type="button"
                onClick={() => openSettings('moodle')}
                className="text-[12px] text-muted transition-colors hover:text-fg"
              >
                Moodle settings
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss for now"
          className="shrink-0 rounded-md p-1 text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <X size={14} aria-hidden />
        </button>
      </div>
    </div>
  )
}

/**
 * The other half: an offer to connect, for someone who never has.
 *
 * Separate from the nudge above because they are different statements — one
 * says "we found a gap", the other says "this feature exists" — and only one
 * of them should ever be on screen. Shown only when Moodle is not connected
 * AND there is at least one course, so it never lands on an empty page where
 * the student has bigger problems.
 */
export function MoodleConnectCard() {
  const { courses, personalTasks } = useAppData()
  const { openSettings } = useSettings()
  const connected = personalTasks.some((t) => t.source === 'moodle')
  if (connected || courses.length === 0) return null

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-surface/60 px-3.5 py-3">
      <GraduationCap size={16} className="shrink-0 text-subtle" aria-hidden />
      <p className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-muted">
        <span className="font-medium text-fg">Connect Moodle</span> and your professors&rsquo;
        deadlines arrive on their own, re-checked nightly.
      </p>
      <button
        type="button"
        onClick={() => openSettings('moodle')}
        className="shrink-0 rounded-lg border border-border-strong px-3 py-1.5 text-[12.5px] font-medium text-fg transition-colors hover:bg-surface-2"
      >
        Connect
      </button>
      <Link
        to="/docs/moodle-sync"
        target="_blank"
        className="shrink-0 text-[12px] text-subtle transition-colors hover:text-fg"
      >
        How it works
      </Link>
    </div>
  )
}
