import { useState } from 'react'
import { CalendarClock, Copy } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import { uid, type OutlineItem, type TeacherCourse } from '@/data/teacher'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** Every date moved by whole weeks, so each item lands on the same weekday. */
function shiftOutline(items: OutlineItem[], weeks: number): OutlineItem[] {
  return items.map((it) =>
    it.due ? { ...it, due: new Date(new Date(it.due).getTime() + weeks * WEEK_MS).toISOString() } : it,
  )
}

/**
 * Reusing an outline instead of retyping it.
 *
 * SHIFT DATES is next term's outline: same assessments, every date moved by
 * whole weeks so each keeps its weekday (52 weeks = the same term next year).
 * It edits the draft; nothing reaches students until you publish.
 *
 * COPY TO MY OTHER SECTIONS is the professor with three sections of one
 * course: build it once, copy it across. It replaces those sections' DRAFTS
 * and says so first; each section is still published on its own, because
 * sections can genuinely differ and publishing is the moment that is checked.
 */
export function OutlineTools({ course, disabled }: { course: TeacherCourse; disabled?: boolean }) {
  const { currentTeacher, updateOutline } = useTeacher()
  const [weeks, setWeeks] = useState(52)
  const [armed, setArmed] = useState<'shift' | 'copy' | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [done, setDone] = useState<string | null>(null)

  const siblings = (currentTeacher?.courses ?? []).filter(
    (c) => c.courseId !== course.courseId && c.code === course.code && !c.ta,
  )
  const dated = course.outline.some((i) => i.due)

  function shift() {
    if (armed !== 'shift') return setArmed('shift')
    updateOutline(course.courseId, shiftOutline(course.outline, weeks))
    setArmed(null)
    setDone(`Every date moved ${weeks > 0 ? 'forward' : 'back'} ${Math.abs(weeks)} week${Math.abs(weeks) === 1 ? '' : 's'}. Publish when it looks right.`)
  }

  function copy() {
    if (armed !== 'copy') return setArmed('copy')
    for (const id of picked) updateOutline(id, course.outline.map((i) => ({ ...i, id: uid('oi') })))
    setArmed(null)
    setDone(`Copied to ${picked.length} section${picked.length === 1 ? '' : 's'}. Open each to publish it.`)
    setPicked([])
  }

  return (
    <div className="mt-5 rounded-xl border border-border bg-surface p-4">
      <p className="text-[13px] font-semibold text-fg">Reuse this outline</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <CalendarClock size={15} className="text-muted" aria-hidden />
        <span className="text-[13px] text-muted">Shift every date by</span>
        <input
          type="number"
          value={weeks}
          onChange={(e) => {
            setWeeks(Math.max(-104, Math.min(104, Math.round(Number(e.target.value) || 0))))
            setArmed(null)
          }}
          aria-label="Weeks to shift"
          className="w-16 rounded-md border border-border bg-surface-2 px-2 py-1 text-[13px] text-fg focus:border-accent focus:outline-none"
        />
        <span className="text-[13px] text-muted">weeks</span>
        <Button size="sm" variant={armed === 'shift' ? 'primary' : 'outline'} disabled={disabled || !dated || weeks === 0} onClick={shift}>
          {armed === 'shift' ? 'Confirm shift' : 'Shift dates'}
        </Button>
        <span className="text-[11.5px] text-subtle">52 = the same term next year</span>
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <p className="flex items-center gap-2 text-[13px] text-muted">
          <Copy size={15} aria-hidden />
          Copy to my other sections of {course.code}
        </p>
        {siblings.length === 0 ? (
          <p className="mt-1.5 text-[12px] text-subtle">
            Add your other sections of {course.code} from the dashboard, and you can copy this outline to them here.
          </p>
        ) : (
          <>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {siblings.map((s) => {
                const on = picked.includes(s.courseId)
                return (
                  <button
                    key={s.courseId}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      setPicked((p) => (on ? p.filter((x) => x !== s.courseId) : [...p, s.courseId]))
                      setArmed(null)
                    }}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors',
                      on ? 'border-accent bg-accent-soft text-accent' : 'border-border text-muted hover:text-fg',
                    )}
                  >
                    Section {s.section}
                  </button>
                )
              })}
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Button size="sm" variant={armed === 'copy' ? 'primary' : 'outline'} disabled={disabled || picked.length === 0 || course.outline.length === 0} onClick={copy}>
                {armed === 'copy' ? 'Confirm copy' : 'Copy outline'}
              </Button>
              {armed === 'copy' && (
                <span className="text-[11.5px] text-warning">This replaces those sections&rsquo; draft outlines.</span>
              )}
            </div>
          </>
        )}
      </div>

      {done && <p className="mt-3 text-[12px] text-success">{done}</p>}
    </div>
  )
}
