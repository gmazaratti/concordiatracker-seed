import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { useQuickActions } from '@/app/providers/quick-actions'
import { coveredTaskIds, pairMoodleToAssessments } from '@/lib/moodle-match'
import { ACADEMIC_CALENDAR } from '@/data/academic-calendar'
import { sectionDeadlineEvents } from '@/lib/section-deadlines'
import { useDeadlineRows } from '@/lib/section-deadlines-data'
import { term } from '@/data/mock'
import { Segmented } from '@/features/settings/controls'
import { useT } from '@/i18n/i18n'
import { MONTHS, addDays, weekDays, type CalendarSource } from './calendar'
import { formatMonthDay } from '@/lib/date'
import { MonthView } from './MonthView'
import { WeekView } from './WeekView'
import { AgendaView } from './AgendaView'
import { DayDetailModal } from './DayDetailModal'
import { CalendarRail } from './CalendarRail'
import { UpNext } from './UpNext'



/** Phones lead with the agenda — set once per session so it never fights a
 * deliberate desktop choice that's sticky across nav. */
let mobileInitDone = false

const monthDay = (d: Date) => formatMonthDay(d)

function weekLabel(cursor: Date): string {
  const days = weekDays(cursor)
  const a = days[0]
  const b = days[6]
  const right = a.getMonth() === b.getMonth() ? String(b.getDate()) : monthDay(b)
  return `${monthDay(a)} – ${right}, ${b.getFullYear()}`
}

/** Calendar — personal deadlines + the official Concordia academic calendar as
 * two toggleable layers, across Month / Week / Agenda views. */
export function CalendarPage() {
  const t = useT()
  const { assessments, personalTasks, courses, courseById, calendarPrefs, updateCalendarPrefs } =
    useAppData()
  const { openAssessment } = useQuickActions()
  const [cursor, setCursor] = useState(() => new Date())
  const [openDay, setOpenDay] = useState<Date | null>(null)

  const view = calendarPrefs.view

  useEffect(() => {
    if (mobileInitDone) return
    mobileInitDone = true
    if (window.matchMedia('(max-width: 1023px)').matches && calendarPrefs.view === 'month') {
      setTimeout(() => updateCalendarPrefs({ view: 'agenda' }), 0)
    }
  }, [calendarPrefs.view, updateCalendarPrefs])

  /**
   * A Moodle deadline that is ALREADY on the calendar as an assessment is
   * dropped, so one piece of coursework is one entry. The assessment is the
   * one kept: it carries the weight, the grade and the provenance badge, and
   * the synced copy carries none of those. `MoodleMismatchCard` still speaks
   * up on the course when the two disagree about the date.
   */
  const visibleTasks = useMemo(() => {
    const covered = coveredTaskIds(pairMoodleToAssessments(personalTasks, assessments, courses))
    return personalTasks.filter((tk) => !covered.has(tk.id))
  }, [personalTasks, assessments, courses])

  // The registrar's own dates for any section that does not follow the
  // standard ones, filed with the rest of the university's calendar.
  const deadlineRows = useDeadlineRows()
  const academic = useMemo(
    () => [...ACADEMIC_CALENDAR, ...sectionDeadlineEvents(courses, deadlineRows)],
    [courses, deadlineRows],
  )
  const source: CalendarSource = useMemo(
    () => ({ assessments, tasks: visibleTasks, academic }),
    [assessments, visibleTasks, academic],
  )

  function step(delta: number) {
    setCursor((c) =>
      view === 'month'
        ? new Date(c.getFullYear(), c.getMonth() + delta, 1)
        : addDays(c, delta * 7),
    )
  }

  const periodLabel =
    view === 'month' ? `${MONTHS()[cursor.getMonth()]} ${cursor.getFullYear()}` : weekLabel(cursor)

  return (
    <div className="mx-auto w-full max-w-[1600px] px-5 py-5 sm:px-6">
      <header className="mb-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[12px] font-semibold tracking-[0.14em] text-accent uppercase">
              {t('calendar.title')} · {term.name}
            </p>
            {/* The period is the page's title: on a calendar, "November 2026" is the thing you are looking at. */}
            <h1 className="mt-1 font-display text-[30px] leading-tight font-bold tracking-tight text-fg sm:text-[38px]">
              {view === 'agenda' ? t('calendar.agenda') : periodLabel}
            </h1>
          </div>
          <Segmented
            ariaLabel={t('calendar.viewAria')}
            value={view}
            onChange={(v) => updateCalendarPrefs({ view: v })}
            options={[
              { value: 'month', label: t('calendar.month') },
              { value: 'week', label: t('calendar.week') },
              { value: 'agenda', label: t('calendar.agenda') },
            ]}
          />
        </div>

        {view !== 'agenda' && (
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label={view === 'month' ? t('calendar.prevMonth') : t('calendar.prevWeek')}
              className="grid size-10 place-items-center rounded-full border border-border text-muted transition-colors duration-150 hover:border-border-strong hover:bg-surface-2 hover:text-fg"
            >
              <ChevronLeft size={18} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label={view === 'month' ? t('calendar.nextMonth') : t('calendar.nextWeek')}
              className="grid size-10 place-items-center rounded-full border border-border text-muted transition-colors duration-150 hover:border-border-strong hover:bg-surface-2 hover:text-fg"
            >
              <ChevronRight size={18} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setCursor(new Date())}
              className="rounded-full bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
            >
              {t('calendar.today')}
            </button>
          </div>
        )}
      </header>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <main className="order-2 min-w-0 flex-1 lg:order-1">
          {view === 'month' && (
            <MonthView
              view={cursor}
              source={source}
              prefs={calendarPrefs}
              courseById={courseById}
              onOpenDay={setOpenDay}
            />
          )}
          {view === 'week' && (
            <WeekView
              view={cursor}
              source={source}
              prefs={calendarPrefs}
              courseById={courseById}
              onOpenDay={setOpenDay}
              onOpenAssessment={openAssessment}
            />
          )}
          {view === 'agenda' && (
            <AgendaView source={source} prefs={calendarPrefs} courseById={courseById} />
          )}
        </main>

        <aside className="order-1 space-y-4 lg:order-2 lg:w-[320px] lg:shrink-0">
          {/* Not on the agenda view: that view already IS the list of what is next. */}
          {view !== 'agenda' && (
            <UpNext source={source} prefs={calendarPrefs} courseById={courseById} onOpenDay={setOpenDay} />
          )}
          <CalendarRail />
        </aside>
      </div>

      {openDay && (
        <DayDetailModal
          day={openDay}
          source={source}
          prefs={calendarPrefs}
          courseById={courseById}
          onClose={() => setOpenDay(null)}
        />
      )}
    </div>
  )
}
