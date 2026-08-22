import { useSearchParams } from 'react-router-dom'
import {
  Bell,
  BookOpen,
  Bookmark,
  GitBranch,
  CalendarRange,
  GraduationCap,
  Radar as RadarIcon,
  Target,
  Wallet,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { useI18n } from '@/i18n/i18n'
import type { Key } from '@/i18n/en'
import { CourseDirectory } from './CourseDirectory'
import { SeatWatchPanel } from './SeatWatchPanel'
import { MyRecordPanel } from './MyRecordPanel'
import { SavedCoursesPanel } from './SavedCoursesPanel'
import { ScheduleBuilder } from './ScheduleBuilder'
import { PrereqTree } from './PrereqTree'
import { ProgramProgress } from './ProgramProgress'
import { RadarPage } from '@/features/radar/RadarPage'
import { MoneyPage } from '@/features/money/MoneyPage'
import { PlannerNavBar, type NavItem, type Phase } from './PlannerNav'

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

type Tab =
  | 'record'
  | 'program'
  | 'radar'
  | 'seats'
  | 'directory'
  | 'saved'
  | 'tree'
  | 'schedule'
  | 'money'

/**
 * Ordered by the sequence someone actually does this in, and grouped into the
 * three phases of it, rather than by the order the sections were built.
 *
 * You start from what you have done, go looking at what exists, then commit to
 * a week and chase the seats.
 */
const TABS: { id: Tab; labelKey: Key; icon: typeof Bell; phase: Phase }[] = [
  { id: 'record', labelKey: 'planner.tab.record', icon: GraduationCap, phase: 'know' },
  { id: 'program', labelKey: 'planner.tab.program', icon: Target, phase: 'know' },
  // Radar is about the term you are RUNNING, not the one you are choosing,
  // which argued for a tab of its own. But it is a sit-down-and-review surface
  // used occasionally and deliberately, and that is Planner's mode rather than
  // Today's. Folding it in also settles the mobile bar, full at six slots.
  { id: 'radar', labelKey: 'planner.tab.radar', icon: RadarIcon, phase: 'know' },

  { id: 'directory', labelKey: 'planner.tab.directory', icon: BookOpen, phase: 'explore' },
  { id: 'tree', labelKey: 'planner.tab.tree', icon: GitBranch, phase: 'explore' },
  { id: 'saved', labelKey: 'planner.tab.saved', icon: Bookmark, phase: 'explore' },

  { id: 'schedule', labelKey: 'planner.tab.schedule', icon: CalendarRange, phase: 'commit' },
  { id: 'seats', labelKey: 'planner.tab.seats', icon: Bell, phase: 'commit' },
  { id: 'money', labelKey: 'planner.tab.money', icon: Wallet, phase: 'commit' },
]

const TAB_IDS = new Set<string>(TABS.map((x) => x.id))

export function PlannerPage() {
  const { t } = useI18n()

  /**
   * The open section lives in the URL.
   *
   * Which makes every part of the planner linkable — from a Today widget, from
   * a signal's action, from a message to a friend — and makes the back button
   * do what it looks like it does. It was component state, so `/app/planner`
   * always landed on My record however you arrived.
   */
  const [params, setParams] = useSearchParams()
  const fromUrl = params.get('tab')
  const tab: Tab = fromUrl && TAB_IDS.has(fromUrl) ? (fromUrl as Tab) : 'record'
  const setTab = (next: Tab) => setParams(next === 'record' ? {} : { tab: next })

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
      {tab === 'program' && <ProgramProgress />}
      {tab === 'radar' && <RadarPage />}
      {tab === 'money' && <MoneyPage />}
      {tab === 'seats' && <SeatWatchPanel />}
      {tab === 'directory' && <CourseDirectory />}
      {tab === 'saved' && <SavedCoursesPanel />}
      {tab === 'tree' && <PrereqTree />}
      {tab === 'schedule' && <ScheduleBuilder />}
    </>
  )

  // The PAGE never changes width — only the content column inside it does.
  // Letting the page resize per section moved the rail itself every time you
  // switched, which reads as the navigation running away from you.
  return (
    <div className="mx-auto w-full max-w-[1600px] px-5 py-5 sm:px-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div className="min-w-0">
          <h1 className="font-display text-[26px] leading-tight font-medium text-fg">
            {t('planner.title')}
          </h1>
          <p className="mt-0.5 text-[13px] text-subtle">{t('planner.subtitle')}</p>
        </div>
      </header>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-6">
        <PlannerNavBar items={items} active={tab} onChange={setTab} />
        {/* The column, not the page, is what narrows for a reading section —
            and it eases rather than snapping, so the change reads as the
            content settling instead of the layout jumping. */}
        <div
          className={cn(
            'min-w-0 flex-1 transition-[max-width] duration-300 ease-out',
            wide ? 'max-w-full' : 'max-w-5xl',
          )}
        >
          {panel}
        </div>
      </div>
    </div>
  )
}
