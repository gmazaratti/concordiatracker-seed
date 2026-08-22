import { useEffect, useMemo, useState } from 'react'
import { Check, Loader2, MapPin } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { Select } from '@/components/ui/Select'
import { cn } from '@/lib/cn'
import { findSections, termLabel, type SectionOption } from '@/lib/seats'
import {
  newestTerm,
  parseCourseCode,
  sectionPatch,
  sortSections,
  termCodeFor,
} from '@/lib/course-sections'
import type { Course } from '@/data/types'

/**
 * Fill a course's schedule from Concordia's published section data.
 *
 * The student picks. We know the course code, not which section they registered
 * for, and picking one for them would be the exact species of confident wrong
 * answer this app spends its effort avoiding. What we can do is stop making
 * them retype something the university already published.
 *
 * Lecture, tutorial and lab are separate registrations with separate times, so
 * one of each can be selected and both patterns are written.
 *
 * It opens on the course's OWN term. Defaulting to whichever term sorted highest
 * meant picking Fall and then being shown Winter, which is the app arguing with
 * a choice the student had just made.
 */
export function SectionAutofillModal({
  course,
  onClose,
  onApply,
}: {
  course: Course
  onClose: () => void
  onApply: (patch: Partial<Course>) => void
}) {
  const parsed = parseCourseCode(course.code)
  const [sections, setSections] = useState<SectionOption[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [term, setTerm] = useState<string>('')
  // One choice per component type, keyed by LEC / TUT / LAB.
  const [picked, setPicked] = useState<Record<string, SectionOption>>({})

  useEffect(() => {
    if (!parsed) return
    let alive = true
    void findSections(parsed.subject, parsed.catalog)
      .then((rows) => {
        if (!alive) return
        setSections(rows)
        // The term the student said this course is in, when Concordia publishes
        // sections for it. Otherwise the furthest-ahead one, which is the best
        // guess available for a course with no term set.
        const want = termCodeFor(course.term)
        const has = want && rows.some((r) => r.termCode === want)
        setTerm(has ? want : (newestTerm(rows) ?? ''))
      })
      .catch((e: unknown) => {
        if (!alive) return
        setSections([])
        setError(e instanceof Error ? e.message : 'Could not reach Concordia.')
      })
    return () => {
      alive = false
    }
  }, [parsed?.subject, parsed?.catalog, course.term]) // eslint-disable-line react-hooks/exhaustive-deps

  const terms = useMemo(() => {
    const seen = [...new Set((sections ?? []).map((s) => s.termCode))]
    return seen.sort((a, b) => b.localeCompare(a))
  }, [sections])

  const visible = useMemo(
    () => sortSections((sections ?? []).filter((s) => s.termCode === term)),
    [sections, term],
  )

  const chosen = Object.values(picked)
  const preview = chosen.length ? sectionPatch(chosen) : null

  function toggle(s: SectionOption) {
    setPicked((prev) => {
      const key = s.component || 'OTHER'
      const next = { ...prev }
      // Clicking the already-selected one clears it, so a mis-tap is one tap
      // to undo rather than a trip back to the field.
      if (next[key]?.classNumber === s.classNumber) delete next[key]
      else next[key] = s
      return next
    })
  }

  function apply() {
    if (!preview) return
    // Blanks never overwrite. A section listed as TBA should not wipe a
    // schedule the student typed themselves; the section name still updates,
    // and the preview says plainly which fields are being left alone.
    onApply({
      section: preview.section,
      ...(preview.meetingTimes ? { meetingTimes: preview.meetingTimes } : {}),
      ...(preview.location ? { location: preview.location } : {}),
      // Only when there is nothing there. A student who renamed a class to
      // something they recognise should not have it renamed back.
      ...(preview.title && !course.title.trim() ? { title: preview.title } : {}),
    })
    onClose()
  }

  return (
    <ModalShell label={`Find sections for ${course.code}`} onClose={onClose} widthClass="sm:max-w-lg">
      <div className="p-4 sm:p-5">
        <h2 className="font-display text-[17px] font-medium text-fg">
          Fill the schedule from Concordia
        </h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-subtle">
          Pick the section you registered for. Lectures, tutorials and labs are separate, so choose
          one of each you attend.
        </p>

        {!parsed ? (
          <p className="mt-5 rounded-lg border border-border bg-surface-2 px-3.5 py-3 text-[12.5px] text-muted">
            This course needs a code like <span className="font-medium text-fg">COMP 248</span>{' '}
            before we can look it up. Add one in Class details and try again.
          </p>
        ) : sections === null ? (
          <div className="grid place-items-center py-12">
            <Loader2 className="size-5 animate-spin text-accent" aria-hidden />
          </div>
        ) : error ? (
          <p className="mt-5 rounded-lg border border-danger/40 bg-danger/10 px-3.5 py-3 text-[12.5px] text-fg">
            {error}
          </p>
        ) : visible.length === 0 && terms.length === 0 ? (
          <p className="mt-5 rounded-lg border border-border bg-surface-2 px-3.5 py-3 text-[12.5px] text-muted">
            Concordia lists no scheduled sections for {parsed.subject} {parsed.catalog}. It may not
            be offered this year.
          </p>
        ) : (
          <>
            {terms.length > 1 && (
              <div className="mt-4">
                <Select
                  value={term}
                  onChange={setTerm}
                  ariaLabel="Term"
                  options={terms.map((code) => ({ value: code, label: termLabel(code) }))}
                />
              </div>
            )}

            <ul className="mt-4 max-h-[46vh] divide-y divide-border overflow-y-auto rounded-xl border border-border">
              {visible.map((s) => {
                const active = picked[s.component || 'OTHER']?.classNumber === s.classNumber
                return (
                  <li key={s.classNumber}>
                    <button
                      type="button"
                      onClick={() => toggle(s)}
                      aria-pressed={active}
                      className={cn(
                        'flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors duration-150',
                        active ? 'bg-accent-soft' : 'hover:bg-surface-2',
                      )}
                    >
                      <span
                        className={cn(
                          'grid size-5 shrink-0 place-items-center rounded-full border',
                          active ? 'border-accent bg-accent text-accent-contrast' : 'border-border',
                        )}
                      >
                        {active && <Check size={12} aria-hidden />}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2">
                          <span className="text-[13px] font-medium text-fg">
                            {s.section} {s.component}
                          </span>
                          {s.meetingTimes ? (
                            <span className="text-[12px] text-muted">{s.meetingTimes}</span>
                          ) : (
                            <span className="text-[12px] text-subtle">No time listed</span>
                          )}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-subtle">
                          <span className="flex items-center gap-1">
                            <MapPin size={11} aria-hidden />
                            {[s.building && s.room ? `${s.building} ${s.room}` : null, s.location]
                              .filter(Boolean)
                              .join(' · ') || s.instructionMode}
                          </span>
                          <Seats section={s} />
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}

        {preview && (
          <div className="mt-4 rounded-lg border border-border bg-surface-2 px-3.5 py-2.5">
            <p className="text-[11px] font-semibold tracking-wide text-subtle uppercase">
              Will be saved
            </p>
            <p className="mt-1 text-[12.5px] text-fg">{preview.section}</p>
            <p className="text-[12px] text-muted">
              {preview.meetingTimes ||
                (course.meetingTimes
                  ? 'No times published, keeping your current schedule'
                  : 'No times published')}
            </p>
            {preview.location && <p className="text-[12px] text-muted">{preview.location}</p>}
          </div>
        )}

        {/* Concordia publishes no teaching staff in the schedule feed, so the
            one field a student expects here and will not get is named, rather
            than left as a silent gap they assume is a bug. */}
        {sections !== null && !error && visible.length > 0 && (
          <p className="mt-3 text-[11.5px] leading-relaxed text-subtle">
            Concordia&rsquo;s schedule does not publish the instructor, so that one stays yours to
            fill in.
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-1.5 text-[13px] text-muted transition-colors duration-150 hover:text-fg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={!preview}
            className="rounded-lg bg-accent px-3 py-1.5 text-[13px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Use this section
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

/** Open / full / waiting, from the same counts the seat watcher reads. Shown
 *  because "which section" and "can I still get into it" are one question. */
function Seats({ section: s }: { section: SectionOption }) {
  if (s.capacity === null || s.enrolled === null) return null
  const left = s.capacity - s.enrolled
  if (left > 0)
    return (
      <span className="text-success">
        {left} seat{left === 1 ? '' : 's'} open
      </span>
    )
  const wl = s.waitlisted ?? 0
  return <span className="text-warning">Full{wl > 0 ? ` · ${wl} waiting` : ''}</span>
}
