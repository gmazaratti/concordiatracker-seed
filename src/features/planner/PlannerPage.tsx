import { useState } from 'react'
import { Bell, BookOpen, Bookmark, GitBranch, CalendarRange, GraduationCap } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useI18n } from '@/i18n/i18n'
import type { Key } from '@/i18n/en'
import { useIsAdmin } from '@/features/admin/admin-data'
import { CourseDirectory } from './CourseDirectory'
import { SeatWatchPanel } from './SeatWatchPanel'
import { MyRecordPanel } from './MyRecordPanel'
import { SavedCoursesPanel } from './SavedCoursesPanel'
import { ScheduleBuilder } from './ScheduleBuilder'
import { PrereqTree } from './PrereqTree'
import { PlannerNavBar, type NavItem, type Phase } from './PlannerNav'
import { NAV_LAYOUTS, setPlannerNav, usePlannerNav } from './nav-layout'

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
 * Its sections are one job, not six. That is exactly why they sit behind one
 * tab instead of six, and why the shuttle, weather and study timer are still
 * widgets rather than neighbours of this.
 */

type Tab = 'record' | 'seats' | 'directory' | 'saved' | 'tree' | 'schedule'

/**
 * Ordered by the sequence someone actually does this in, and grouped into the
 * three phases of it, rather than by the order the sections were built.
 *
 * You start from what you have done, go looking at what exists, then commit to
 * a week and chase the seats.
 */
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
  const { isAdmin } = useIsAdmin()
  const [tab, setTab] = useState<Tab>('record')
  const nav = usePlannerNav()

  // The schedule builder and the prerequisite graph are the only sections that
  // want more than a reading column, so they are the only ones that get it.
  const wide = tab === 'schedule' || tab === 'tree'
  const items: NavItem<Tab>[] = TABS.map((item) => ({
    id: item.id,
    label: t(item.labelKey),
    icon: item.icon,
    phase: item.phase,
  }))

  const panel = (
    <>
      {tab === 'record' && <MyRecordPanel />}
      {tab === 'seats' && <SeatWatchPanel />}
      {tab === 'directory' && <CourseDirectory />}
      {tab === 'saved' && <SavedCoursesPanel />}
      {tab === 'tree' && <PrereqTree />}
      {tab === 'schedule' && <ScheduleBuilder />}
    </>
  )

  return (
    <div className={cn('mx-auto w-full px-5 py-5 sm:px-6', wide ? 'max-w-[1600px]' : 'max-w-5xl')}>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div className="min-w-0">
          <h1 className="font-display text-[26px] leading-tight font-medium text-fg">
            {t('planner.title')}
          </h1>
          <p className="mt-0.5 text-[13px] text-subtle">{t('planner.subtitle')}</p>
        </div>
        {isAdmin && <NavLayoutToggle current={nav} />}
      </header>

      {nav === 'rail' ? (
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-6">
          <PlannerNavBar layout="rail" items={items} active={tab} onChange={setTab} />
          <div className="min-w-0 flex-1">{panel}</div>
        </div>
      ) : (
        <>
          <PlannerNavBar layout={nav} items={items} active={tab} onChange={setTab} />
          {panel}
        </>
      )}
    </div>
  )
}

/** Temporary: four arrangements, compared on the real screens. Admin-only. */
function NavLayoutToggle({ current }: { current: string }) {
  return (
    <span className="hidden items-center gap-1 rounded-lg border border-border p-0.5 sm:inline-flex">
      <span className="px-1 text-[10px] font-semibold tracking-wide text-subtle uppercase">
        Nav
      </span>
      {NAV_LAYOUTS.map((l) => (
        <button
          key={l.id}
          type="button"
          onClick={() => setPlannerNav(l.id)}
          aria-pressed={current === l.id}
          title={l.hint}
          className={cn(
            'rounded-md px-2 py-1 text-[11px] font-medium transition-colors duration-150',
            current === l.id ? 'bg-surface-2 text-fg' : 'text-subtle hover:text-fg',
          )}
        >
          {l.label}
        </button>
      ))}
    </span>
  )
}
