import { useState } from 'react'
import { Bell, BookOpen, GitBranch, CalendarRange, GraduationCap } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useI18n } from '@/i18n/i18n'
import type { Key } from '@/i18n/en'
import { CourseDirectory } from './CourseDirectory'
import { SeatWatchPanel } from './SeatWatchPanel'
import { MyRecordPanel } from './MyRecordPanel'

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

type Tab = 'record' | 'seats' | 'directory' | 'tree' | 'schedule'

const TABS: { id: Tab; labelKey: Key; icon: typeof Bell; ready: boolean }[] = [
  { id: 'record', labelKey: 'planner.tab.record', icon: GraduationCap, ready: true },
  { id: 'seats', labelKey: 'planner.tab.seats', icon: Bell, ready: true },
  { id: 'directory', labelKey: 'planner.tab.directory', icon: BookOpen, ready: true },
  { id: 'tree', labelKey: 'planner.tab.tree', icon: GitBranch, ready: false },
  { id: 'schedule', labelKey: 'planner.tab.schedule', icon: CalendarRange, ready: false },
]

export function PlannerPage() {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('record')

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-5 sm:px-6">
      <header className="mb-4">
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
        className="mb-5 grid grid-cols-3 gap-1 border-b border-border sm:flex sm:gap-1"
      >
        {TABS.map((item) => {
          const Icon = item.icon
          const active = tab === item.id
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item.id)}
              className={cn(
                'inline-flex items-center justify-center gap-1.5 border-b-2 px-2 py-2.5 text-[12px] font-medium transition-colors duration-150 sm:shrink-0 sm:justify-start sm:px-3.5 sm:text-[13px] sm:whitespace-nowrap',
                active ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg',
              )}
            >
              <Icon size={14} aria-hidden className="shrink-0" />
              <span className="truncate">{t(item.labelKey)}</span>
              {/* Honest about what is not built yet, rather than an empty tab
                  that just looks broken. */}
              {!item.ready && (
                <span className="hidden rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-subtle uppercase sm:inline">
                  {t('planner.soon')}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {tab === 'record' && <MyRecordPanel />}
      {tab === 'seats' && <SeatWatchPanel />}
      {tab === 'directory' && <CourseDirectory />}
      {tab === 'tree' && (
        <Placeholder title={t('planner.tab.tree')} body={t('planner.tree.body')} />
      )}
      {tab === 'schedule' && (
        <Placeholder title={t('planner.tab.schedule')} body={t('planner.schedule.body')} />
      )}
    </div>
  )
}

function Placeholder({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <h2 className="font-display text-[17px] font-medium text-fg">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-subtle">{body}</p>
    </div>
  )
}
