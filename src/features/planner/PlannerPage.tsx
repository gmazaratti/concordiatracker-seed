import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { useI18n } from '@/i18n/i18n'
import { CourseDirectory } from './CourseDirectory'
import { SeatWatchPanel } from './SeatWatchPanel'
import { MyRecordPanel } from './MyRecordPanel'
import { SavedCoursesPanel } from './SavedCoursesPanel'
import { ScheduleBuilder } from './ScheduleBuilder'
import { PrereqTree } from './PrereqTree'
import { ProgramProgress } from './ProgramProgress'
import { RadarPage } from '@/features/radar/RadarPage'
import { MoneyPage } from '@/features/money/MoneyPage'
import { PlannerDrawer, PlannerDrawerButton } from './PlannerDrawer'
import { PLANNER_TABS, PLANNER_TAB_IDS, type NavItem, type PlannerTab } from './tabs'

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

export function PlannerPage() {
  const { t } = useI18n()
  const [drawerOpen, setDrawerOpen] = useState(false)

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
  const tab: PlannerTab =
    fromUrl && PLANNER_TAB_IDS.has(fromUrl) ? (fromUrl as PlannerTab) : 'record'
  const setTab = (next: PlannerTab) => setParams(next === 'record' ? {} : { tab: next })

  // The schedule builder and the prerequisite graph are the only sections that
  // want more than a reading column, so they are the only ones that get it.
  const wide = tab === 'schedule' || tab === 'tree'
  const items: NavItem<PlannerTab>[] = PLANNER_TABS.map((item) => ({
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

      {/* Phones get the same rail, slid in from the left. A dropdown listed
          the eight sections as eight equal strings and lost what the rail
          exists to say — that they are a sequence, not a menu. */}
      <PlannerDrawerButton
        label={items.find((i) => i.id === tab)?.label ?? t('planner.title')}
        onClick={() => setDrawerOpen(true)}
      />
      <PlannerDrawer
        items={items}
        active={tab}
        onChange={setTab}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      {/* No rail here any more — the sections nest under Planner in the app
          sidebar, so the screen carries one navigation column instead of two
          and the schedule builder gets the width back. The column, not the
          page, is what narrows for a reading section, and it eases rather than
          snapping so the change reads as content settling. */}
      <div
        className={cn(
          'min-w-0 transition-[max-width] duration-300 ease-out',
          wide ? 'max-w-full' : 'max-w-5xl',
        )}
      >
        {panel}
      </div>
    </div>
  )
}
