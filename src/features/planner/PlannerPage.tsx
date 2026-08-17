import { Fragment, useState } from 'react'
import { Bell, BookOpen, Bookmark, GitBranch, CalendarRange, GraduationCap } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useI18n } from '@/i18n/i18n'
import type { Key } from '@/i18n/en'
import { CourseDirectory } from './CourseDirectory'
import { SeatWatchPanel } from './SeatWatchPanel'
import { MyRecordPanel } from './MyRecordPanel'
import { SavedCoursesPanel } from './SavedCoursesPanel'
import { ScheduleBuilder } from './ScheduleBuilder'
import { PrereqTree } from './PrereqTree'
import { useBuilderLayout } from './builder-layout'

/**
 * Planner: the pre-term half of the product.
 *
 * This is a fifth top-level destination, which the four-tab rule spent a long
 * time resisting. The rule survives intact, because the test it enforces is
 * "is this a PLACE you go and stay", not "is this important". Today, Courses
 * and Calendar are all the term you are running. Choosing next term's classes
 * is a different activity, done at a different time of year, and it does not
 * belong stapled onto any of them.
 *
 * Its four sections are one job, not four. That is exactly why they sit behind
 * one tab instead of four, and why the shuttle, weather and study timer are
 * still widgets rather than neighbours of this.
 */

type Tab = 'record' | 'seats' | 'directory' | 'saved' | 'tree' | 'schedule'

/**
 * Ordered by the sequence someone actually does this in, and grouped into the
 * three phases of it, rather than by the order the tabs were built.
 *
 * You start from what you have done, go looking at what exists, then commit to
 * a week and chase the seats. Six flat tabs in build order made the reader
 * work that out for themselves every time; a divider between the phases costs
 * one pixel and does the explaining.
 */
type Phase = 'know' | 'explore' | 'commit'

const TABS: { id: Tab; labelKey: Key; icon: typeof Bell; phase: Phase }[] = [
  { id: 'record', labelKey: 'planner.tab.record', icon: GraduationCap, phase: 'know' },

  { id: 'directory', labelKey: 'planner.tab.directory', icon: BookOpen, phase: 'explore' },
  { id: 'tree', labelKey: 'planner.tab.tree', icon: GitBranch, phase: 'explore' },
  { id: 'saved', labelKey: 'planner.tab.saved', icon: Bookmark, phase: 'explore' },

  { id: 'schedule', labelKey: 'planner.tab.schedule', icon: CalendarRange, phase: 'commit' },
  { id: 'seats', labelKey: 'planner.tab.seats', icon: Bell, phase: 'commit' },
]

export function PlannerPage() {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('record')
  const builderLayout = useBuilderLayout()
  // The schedule builder is the only section that wants more than a reading
  // column, so it is the only one allowed to take it.
  const wideBuilder = tab === 'schedule' && builderLayout === 'wide'

  return (
    <div
      className={cn(
        'mx-auto w-full px-5 py-5 sm:px-6',
        wideBuilder ? 'max-w-[1600px]' : 'max-w-5xl',
      )}
    >
      <header className="mb-4 print:hidden">
        <h1 className="font-display text-[26px] leading-tight font-medium text-fg">
          {t('planner.title')}
        </h1>
        <p className="mt-0.5 text-[13px] text-subtle">{t('planner.subtitle')}</p>
      </header>

      <div
        role="tablist"
        aria-label={t('planner.sections')}
        // All five visible at once. A horizontally scrolled strip hid two of
        // them behind an edge with nothing to indicate they were there, so on a
        // phone the page looked like it had three sections.
        className="mb-5 grid grid-cols-3 gap-1 border-b border-border sm:flex sm:gap-1 print:hidden"
      >
        {TABS.map((item, i) => {
          const Icon = item.icon
          const active = tab === item.id
          const startsPhase = i > 0 && TABS[i - 1].phase !== item.phase
          return (
            <Fragment key={item.id}>
              {/* A hairline where the phase changes. Desktop only: on a phone
                  the strip is a 3x2 grid and a vertical rule between cells
                  would land in the wrong place. */}
              {startsPhase && (
                <span className="mx-1.5 hidden self-center sm:block sm:h-4 sm:w-px sm:bg-border" aria-hidden />
              )}
              <button
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(item.id)}
                className={cn(
                  'inline-flex items-center justify-center gap-1.5 border-b-2 px-2 py-2.5 text-[12px] font-medium transition-colors duration-150 sm:shrink-0 sm:justify-start sm:px-3 sm:text-[13px] sm:whitespace-nowrap',
                  active ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg',
                )}
              >
                <Icon size={14} aria-hidden className="shrink-0" />
                <span className="truncate">{t(item.labelKey)}</span>
              </button>
            </Fragment>
          )
        })}
      </div>

      {tab === 'record' && <MyRecordPanel />}
      {tab === 'seats' && <SeatWatchPanel />}
      {tab === 'directory' && <CourseDirectory />}
      {tab === 'saved' && <SavedCoursesPanel />}
      {tab === 'tree' && <PrereqTree />}
      {tab === 'schedule' && <ScheduleBuilder />}
    </div>
  )
}
