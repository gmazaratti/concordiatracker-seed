import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Settings2 } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { useSettings } from '@/app/providers/settings'
import { Card } from '@/components/ui/Card'
import { courseColor } from '@/lib/course-color'
import { MoodleList } from './MoodleItems'
import { MoodleBanner } from './MoodleBrand'
import { splitByTime, useMoodleGroups } from './moodle-groups'

/**
 * /app/courses/moodle: Moodle opened like a class. A banner, then everything
 * Moodle has sent, one card per class (linked to the class itself), with the
 * items that name no class of yours at the end. Past items fold under
 * "N earlier" in each card.
 */
export function MoodlePage() {
  const { courses } = useAppData()
  const { openSettings } = useSettings()
  const { groups, pairedWith, total } = useMoodleGroups()
  const [now] = useState(() => Date.now())
  const all = [...groups.values()].flat()
  const open = splitByTime(all, now).upcoming.filter((t) => !t.done).length
  const done = all.filter((t) => t.done).length
  const entries = [...groups.entries()].sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : 0))

  return (
    <div className="mx-auto w-full max-w-[1600px] px-5 py-5 sm:px-6">
      <Link to="/app/courses" className="inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors duration-150 hover:text-fg">
        <ArrowLeft size={15} aria-hidden /> Courses
      </Link>

      <div className="ct-res-in mt-3 overflow-hidden rounded-3xl border border-border">
        <MoodleBanner className="h-[120px] sm:h-[150px]" />
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 bg-surface px-5 py-4 sm:px-8">
          <div>
            <h1 className="font-display text-[24px] font-semibold tracking-tight text-fg">Moodle</h1>
            <p className="text-[13.5px] text-muted">Deadlines your profs posted, kept in sync.</p>
          </div>
          <dl className="ml-auto flex gap-8 text-right">
            {[
              ['Coming up', open],
              ['Done', done],
              ['In all', total],
            ].map(([label, n]) => (
              <div key={label}>
                <dd className="font-display text-[28px] leading-none font-bold text-fg tabular-nums">{n}</dd>
                <dt className="mt-1 text-[12px] text-muted">{label}</dt>
              </div>
            ))}
          </dl>
          <button
            type="button"
            onClick={() => openSettings('moodle')}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-[13px] font-semibold text-muted transition-colors duration-150 hover:text-fg"
          >
            <Settings2 size={14} aria-hidden /> Manage sync
          </button>
        </div>
      </div>

      {total === 0 ? (
        <div className="mt-5 rounded-3xl border border-dashed border-border-strong px-6 py-14 text-center">
          <p className="font-display text-[20px] font-semibold text-fg">Nothing from Moodle yet</p>
          <p className="mt-1.5 text-[14px] text-muted">Connect Moodle and the deadlines your profs post show up here.</p>
          <button type="button" onClick={() => openSettings('moodle')} className="mt-5 rounded-full bg-accent px-5 py-2.5 text-[14px] font-semibold text-accent-contrast">
            Connect Moodle
          </button>
        </div>
      ) : (
        {/* Stretched, so the cards in a row share one height. */}
        <div className="mt-5 grid items-stretch gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {entries.map(([courseId, items]) => {
            const c = courses.find((x) => x.id === courseId)
            return (
              <Card key={courseId || 'none'} className="flex h-full flex-col overflow-hidden rounded-3xl">
                <div className="flex items-center gap-2.5 border-b border-border px-5 py-3.5">
                  {c && <span className="size-2.5 rounded-full" style={{ backgroundColor: courseColor(c.color).hex }} aria-hidden />}
                  {c ? (
                    <Link to={`/app/courses/${c.id}`} className="min-w-0 flex-1 truncate font-display text-[15.5px] font-semibold text-fg hover:underline">
                      {c.code} <span className="font-sans text-[13.5px] font-normal text-muted">{c.title}</span>
                    </Link>
                  ) : (
                    <span className="flex-1 font-display text-[15.5px] font-semibold text-muted">Not tied to one of your classes</span>
                  )}
                  <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[12px] font-semibold text-muted tabular-nums">{items.length}</span>
                </div>
                <MoodleList items={items} pairedWith={pairedWith} now={now} />
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
