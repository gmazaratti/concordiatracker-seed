import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { useQuickActions } from '@/app/providers/quick-actions'
import { ACADEMIC_CALENDAR } from '@/data/academic-calendar'
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
  const { assessments, personalTasks, courseById, calendarPrefs, updateCalendarPrefs } = useAppData()
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

  const source: CalendarSource = useMemo(
    () => ({ assessments, tasks: personalTasks, academic: ACADEMIC_CALENDAR }),
    [assessments, personalTasks],
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
    <div className="mx-auto w-full max-w-5xl px-5 py-5 sm:px-6">
      <header className="mb-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[12px] text-subtle">{term.name}</p>
            <h1 className="mt-0.5 font-display text-[26px] leading-tight font-medium text-fg">
              {t('calendar.title')}
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
          <div className="mt-3 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label={view === 'month' ? t('calendar.prevMonth') : t('calendar.prevWeek')}
              className="grid size-7 place-items-center rounded-md text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
            >
              <ChevronLeft size={17} aria-hidden />
            </button>
            <span className="min-w-[7.5rem] text-center text-[14px] font-medium text-fg">
              {periodLabel}
            </span>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label={view === 'month' ? t('calendar.nextMonth') : t('calendar.nextWeek')}
              className="grid size-7 place-items-center rounded-md text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
            >
              <ChevronRight size={17} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setCursor(new Date())}
              className="ml-1 rounded-md border border-border px-2.5 py-1 text-[12px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
            >
              {t('calendar.today')}
            </button>
          </div>
        )}
      </header>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
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

        <aside className="order-1 lg:order-2 lg:w-[272px] lg:shrink-0">
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
