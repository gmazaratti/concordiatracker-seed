import { CalendarRange } from 'lucide-react'
import type { Course } from '@/data/types'
import type { CalendarPrefs } from '@/app/providers/app-data'
import { Card } from '@/components/ui/Card'
import { activeLang, startOfToday } from '@/lib/date'
import { cn } from '@/lib/cn'
import { agendaDays, sameDay, type CalendarSource } from './calendar'
import { ItemRow } from './ItemRow'
import { useT } from '@/i18n/i18n'

const AGENDA_WINDOW = 60

/** The agenda: the upcoming days that have something on them, each with a date
 * tile beside its card. The phone-first default: one column. */
export function AgendaView({
  source,
  prefs,
  courseById,
}: {
  source: CalendarSource
  prefs: CalendarPrefs
  courseById: (id: string) => Course | undefined
}) {
  const t = useT()
  const from = startOfToday()
  const today = new Date()
  const groups = agendaDays(from, AGENDA_WINDOW, source, prefs)

  if (groups.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 rounded-3xl px-6 py-16 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
          <CalendarRange size={26} aria-hidden />
        </span>
        <h3 className="font-display text-xl font-medium text-fg">{t('calendar.nothingAhead')}</h3>
        <p className="max-w-xs text-sm text-muted">
          {t('calendar.nothingAheadSub')}
          {prefs.showConcordia && prefs.showMine ? '' : t('calendar.onActiveLayers')}.
        </p>
      </Card>
    )
  }

  const locale = activeLang() === 'fr' ? 'fr-CA' : 'en-US'
  const rel = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const month = new Intl.DateTimeFormat(locale, { month: 'short' })
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long' })

  return (
    <ol className="flex flex-col gap-3">
      {groups.map(({ day, items }, i) => {
        const isToday = sameDay(day, today)
        const away = Math.round((day.getTime() - from.getTime()) / 86_400_000)
        const label = rel.format(away, 'day')
        return (
          // A date tile beside each day's card: the eye runs down the tiles to
          // find a day, then across to read it.
          <li
            key={day.toDateString()}
            className="ct-res-in flex items-start gap-3 sm:gap-4"
            style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}
          >
            <div
              className={cn(
                'flex w-[58px] shrink-0 flex-col items-center rounded-2xl border py-2.5 text-center sm:w-[72px] sm:py-3',
                isToday ? 'border-transparent bg-accent text-accent-contrast' : 'border-border bg-surface text-fg',
              )}
            >
              <span className={cn('text-[10.5px] font-bold tracking-[0.12em] uppercase', !isToday && 'text-muted')}>
                {month.format(day)}
              </span>
              <span className="font-display text-[26px] leading-none font-bold tabular-nums sm:text-[30px]">
                {day.getDate()}
              </span>
            </div>
            <section className="min-w-0 flex-1">
              <h3 className="mb-1.5 flex flex-wrap items-baseline gap-x-2 px-1">
                <span className="font-display text-[17px] font-semibold text-fg first-letter:uppercase">
                  {weekday.format(day)}
                </span>
                <span className={cn('text-[12.5px] font-medium first-letter:uppercase', isToday ? 'text-accent' : 'text-muted')}>
                  {label}
                </span>
                <span className="ml-auto text-[12px] text-subtle tabular-nums">
                  {items.length} {items.length === 1 ? 'item' : 'items'}
                </span>
              </h3>
              <div
                className={cn(
                  'divide-y divide-border/70 overflow-hidden rounded-2xl border bg-surface',
                  isToday ? 'border-accent/50' : 'border-border',
                )}
              >
                {items.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    course={item.kind === 'assessment' ? courseById(item.assessment.courseId) : undefined}
                  />
                ))}
              </div>
            </section>
          </li>
        )
      })}
    </ol>
  )
}
