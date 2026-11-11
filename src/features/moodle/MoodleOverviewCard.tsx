import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { useAppData } from '@/app/providers/app-data'
import { courseColor } from '@/lib/course-color'
import { cn } from '@/lib/cn'
import { MoodleList } from './MoodleItems'
import { splitByTime, useMoodleGroups } from './moodle-groups'

/**
 * Everything Moodle sent, on the Courses page, one group per class, plus the
 * items that name no class you have (a department space, a help centre).
 * Collapsed by default: it is a reference, not the page's job.
 */
export function MoodleOverviewCard() {
  const { courses } = useAppData()
  const { groups, pairedWith, total } = useMoodleGroups()
  const [open, setOpen] = useState(false)
  const [now] = useState(() => Date.now())
  if (total === 0) return null

  const upcomingCount = [...groups.values()].reduce((n, l) => n + splitByTime(l, now).upcoming.length, 0)
  const entries = [...groups.entries()].sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : 0))

  return (
    <Card className="mt-4 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left"
      >
        <span className="grid size-7 place-items-center rounded-md bg-[#f98012] text-[13px] font-bold text-white" aria-hidden>
          M
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold text-fg">Moodle</span>
          <span className="block text-[12px] text-subtle">
            {upcomingCount} coming up · {total} in all, across {groups.size - (groups.has('') ? 1 : 0)} class
            {groups.size - (groups.has('') ? 1 : 0) === 1 ? '' : 'es'}
          </span>
        </span>
        <ChevronDown size={16} className={cn('text-subtle transition-transform duration-200', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div className="border-t border-border">
          {entries.map(([courseId, items]) => {
            const c = courses.find((x) => x.id === courseId)
            return (
              <section key={courseId || 'none'} className="border-b border-border last:border-0">
                <div className="flex items-center gap-2 bg-surface-2/50 px-3.5 py-1.5">
                  {c && <span className="size-2 rounded-full" style={{ backgroundColor: courseColor(c.color).hex }} aria-hidden />}
                  {c ? (
                    <Link to={`/app/courses/${c.id}`} className="text-[12px] font-semibold text-fg hover:underline">
                      {c.code}
                    </Link>
                  ) : (
                    <span className="text-[12px] font-semibold text-muted">Not tied to one of your classes</span>
                  )}
                  <span className="text-[11.5px] text-subtle">{items.length}</span>
                </div>
                <MoodleList items={items} pairedWith={pairedWith} now={now} />
              </section>
            )
          })}
        </div>
      )}
    </Card>
  )
}
