import { useState } from 'react'
import { CalendarPlus, Check, Share } from 'lucide-react'
import type { Assessment, Course } from '@/data/types'
import { addToAppleCalendar, nativeIOS } from '@/lib/native-extras'
import { canShare, shareLink } from '@/lib/share'
import { formatDueDateTime } from '@/lib/date'
import { siteOrigin } from '@/lib/site-origin'
import { haptic } from '@/lib/haptics'

/**
 * "Add to Calendar" and "Share" for one assignment.
 *
 * Add to Calendar is iPhone-only: it writes a real event through EventKit, and
 * the calendar permission is asked for THE FIRST TIME THIS IS PRESSED, never at
 * launch. Share uses the system sheet (AirDrop, Messages, Mail, Copy) wherever
 * one exists and is simply absent where none does.
 */
export function AssessmentNativeActions({ assessment, course }: { assessment: Assessment; course: Course }) {
  const [cal, setCal] = useState<'idle' | 'saved' | 'denied' | 'error'>('idle')
  const path = `/app/courses/${course.id}?focus=${assessment.id}`
  const showCalendar = nativeIOS() && !!assessment.due
  const showShare = canShare()
  if (!showCalendar && !showShare) return null

  async function addCalendar() {
    if (!assessment.due) return
    const r = await addToAppleCalendar({
      title: assessment.title,
      course: course.code,
      dueISO: assessment.due,
      path,
      notes: assessment.notes,
    })
    if (r === 'saved') haptic('success')
    else if (r !== 'unavailable') haptic('error')
    setCal(r === 'unavailable' ? 'error' : r)
  }

  function share() {
    const when = assessment.due ? `due ${formatDueDateTime(assessment.due)}` : 'no date yet'
    void shareLink({
      title: `${course.code} · ${assessment.title}`,
      text: `${course.code} · ${assessment.title}, ${when}.`,
      url: `${siteOrigin()}${path}`,
    })
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        {showCalendar && (
          <button
            type="button"
            onClick={() => void addCalendar()}
            disabled={cal === 'saved'}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-[13px] font-medium text-fg hover:bg-surface-2 disabled:opacity-70"
          >
            {cal === 'saved' ? <Check size={15} aria-hidden /> : <CalendarPlus size={15} aria-hidden />}
            {cal === 'saved' ? 'Added to Calendar' : 'Add to Calendar'}
          </button>
        )}
        {showShare && (
          <button
            type="button"
            onClick={share}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-[13px] font-medium text-fg hover:bg-surface-2"
          >
            <Share size={15} aria-hidden />
            Share
          </button>
        )}
      </div>
      {cal === 'denied' && (
        <p className="mt-1.5 text-[12px] text-warning">
          Calendar access is off for ConcordiaTracker. Turn it on in Settings › Privacy & Security › Calendars.
        </p>
      )}
      {cal === 'error' && <p className="mt-1.5 text-[12px] text-danger">That did not save to Calendar. Try again.</p>}
    </div>
  )
}
